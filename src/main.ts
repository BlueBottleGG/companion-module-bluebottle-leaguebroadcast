import { InstanceBase, runEntrypoint, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { LeagueBroadcastState } from './state.js'
import { createRpcClient, isTierError, type LeagueBroadcastRpc, type RpcConnectionEvent } from './client/rpc.js'
import { isForbiddenError, LeagueBroadcastRest } from './client/rest.js'
import { LeagueBroadcastCommands } from './client/commands.js'
import type { CasterCommandResultDto, CasterPanelStateDto } from './client/lb-types.js'

const POLL_INTERVAL_MS = 5000
const TIER_MESSAGE = 'Companion control requires the LeagueBroadcast Basic tier'

function isUnauthorizedMessage(message: string): boolean {
	return message.toLowerCase().includes('unauthorized')
}

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	state = new LeagueBroadcastState()
	rest!: LeagueBroadcastRest
	commands!: LeagueBroadcastCommands

	private rpc: LeagueBroadcastRpc | null = null
	private pollTimer: NodeJS.Timeout | null = null
	private pollInFlight = false
	private lastChoicesHash = ''
	private versionFetched = false
	/**
	 * Bumped by setupConnection/teardownConnection/destroy. Async continuations
	 * (handleConnected, pollTick, fetchVersionOnce) capture it at entry and
	 * re-check after every await — a stale cycle's landing continuation must
	 * never touch the new cycle's state, status, or variables.
	 */
	private connectionGeneration = 0

	constructor(internal: unknown) {
		super(internal)
	}

	get rpcConnected(): boolean {
		return this.rpc?.connected ?? false
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updatePresets() // export presets
		this.updateVariableDefinitions() // export variable definitions

		this.setupConnection()
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
		this.connectionGeneration++
		this.teardownConnection()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.teardownConnection()
		this.config = config
		this.setupConnection()
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	// --- connection lifecycle ---

	private setupConnection(): void {
		this.connectionGeneration++
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No host configured')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)

		this.state = new LeagueBroadcastState()
		this.state.connectionState = 'connecting'
		this.lastChoicesHash = this.state.choicesHash()
		this.versionFetched = false
		this.initVariableValues()

		this.rest = new LeagueBroadcastRest(this.config.host, this.config.port)
		const rpc = createRpcClient(this.config.host, this.config.port)
		this.rpc = rpc
		this.commands = new LeagueBroadcastCommands(rpc)
		rpc.onConnectionEvent = (ev, reconnectAttempt) => this.handleConnectionEvent(ev, reconnectAttempt)
		rpc.onPanelState = (panel) => this.handlePanelState(panel)
		rpc.onCinematicPlayback = (playing) => this.handleCinematicPlayback(playing)
		rpc.onSubscribeError = (subscription, err) => {
			if (isTierError(err)) {
				this.markTierBlocked()
				return
			}
			this.log('warn', `Subscription ${subscription} failed: ${err.message}`)
		}
		rpc.connect()

		// The 5 s REST poll ticks only while the RPC transport is connected
		// (pollTick self-gates on rpcConnected): the app is one process, so an
		// unreachable RPC endpoint means REST is down too. While disconnected
		// the polled state freezes and variables keep their last values.
		this.pollTimer = setInterval(() => void this.pollTick(), POLL_INTERVAL_MS)
	}

	private teardownConnection(): void {
		this.connectionGeneration++
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
		}
		this.pollInFlight = false
		if (this.rpc) {
			this.rpc.onConnectionEvent = undefined
			this.rpc.onPanelState = undefined
			this.rpc.onCinematicPlayback = undefined
			this.rpc.onSubscribeError = undefined
			this.rpc.destroy()
			this.rpc = null
		}
	}

	private initVariableValues(): void {
		this.setVariableValues({
			gamePhase: 'none',
			blueTeamName: '',
			redTeamName: '',
			activePage: '',
			activeOverlayCount: 0,
			postgameComponent: '',
			hotkeysEnabled: '',
			tier: 'ok',
			appVersion: '',
			connectionState: this.state.connectionState,
		})
	}

	private handleConnectionEvent(ev: RpcConnectionEvent, reconnectAttempt?: number): void {
		// state.connectionState is the single source for the connectionState
		// variable — publish only when the value actually changed.
		const change = this.state.applyConnectionState(ev)
		if (Object.keys(change.changedVariables).length > 0) {
			this.setVariableValues(change.changedVariables)
		}
		if (change.affectedFeedbacks.length > 0) {
			this.checkFeedbacks(...change.affectedFeedbacks)
		}

		switch (ev) {
			case 'reconnecting':
				// The runtime retries forever (maxReconnectAttempts: Infinity), so
				// 'reconnect-failed' never fires on its own — surface an unreachable
				// app by attempt count instead while the retry loop keeps running.
				if (reconnectAttempt !== undefined && reconnectAttempt >= 3) {
					this.updateStatus(
						InstanceStatus.ConnectionFailure,
						`LeagueBroadcast not reachable at ${this.config.host}:${this.config.port} — is the app running?`,
					)
				} else {
					this.updateStatus(InstanceStatus.Connecting)
				}
				break
			case 'connected':
				void this.handleConnected()
				break
			case 'reconnect-failed':
				this.updateStatus(
					InstanceStatus.ConnectionFailure,
					`LeagueBroadcast not reachable at ${this.config.host}:${this.config.port} — is the app running?`,
				)
				break
			case 'disconnected':
				this.updateStatus(InstanceStatus.Disconnected)
				break
		}
	}

	private async handleConnected(): Promise<void> {
		const generation = this.connectionGeneration
		const rpc = this.rpc
		if (!rpc) return

		// Gated liveness/tier probe ONLY — the result is deliberately discarded.
		// The panel-state subscription is the authoritative state source: the
		// server pushes a full snapshot on every (re)subscribe and the runtime
		// replays subscriptions on reconnect, so state population happens
		// exclusively through applyPanelState.
		try {
			await rpc.getActiveOverlays()
			if (generation !== this.connectionGeneration) return
			// A successful gated call proves entitlement — clear any stale tier block.
			this.clearTierBlocked()
		} catch (err) {
			if (generation !== this.connectionGeneration) return
			const message = err instanceof Error ? err.message : String(err)
			if (isTierError(err)) {
				this.markTierBlocked()
				return
			}
			this.log('warn', `Gated liveness probe failed: ${message}`)
		}

		await this.fetchVersionOnce(generation)
		if (generation !== this.connectionGeneration) return
		// Kick a poll cycle immediately — the interval only ticks while connected.
		void this.pollTick()

		if (!this.state.tierBlocked) {
			this.updateStatus(InstanceStatus.Ok)
		}
	}

	private handlePanelState(panel: CasterPanelStateDto): void {
		// Runs synchronously in the subscription dispatch path — a throw here
		// must never propagate (it would take down the module process).
		try {
			const change = this.state.applyPanelState(panel)
			if (Object.keys(change.changedVariables).length > 0) {
				this.setVariableValues(change.changedVariables)
			}
			if (change.affectedFeedbacks.length > 0) {
				this.checkFeedbacks(...change.affectedFeedbacks)
			}

			// Rebuild action & feedback definitions only when the dynamic dropdown
			// sources (pages/buttons/overlay names) actually changed.
			const hash = this.state.choicesHash()
			if (hash !== this.lastChoicesHash) {
				this.lastChoicesHash = hash
				this.updateActions()
				this.updateFeedbacks()
			}
		} catch (err) {
			this.log('error', `Panel state handling failed: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	private handleCinematicPlayback(playing: boolean): void {
		// Subscription dispatch path — contain throws (see handlePanelState).
		try {
			if (this.state.cinematicPlaying === playing) return
			this.state.cinematicPlaying = playing
			this.checkFeedbacks('cinematicPlaying')
		} catch (err) {
			this.log('error', `Cinematic playback handling failed: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	private async pollTick(): Promise<void> {
		// Poll only while the RPC transport is connected — on disconnect the
		// polled state freezes and variables keep their last values.
		if (this.pollInFlight || !this.rest || !this.rpcConnected) return
		const generation = this.connectionGeneration
		this.pollInFlight = true
		try {
			const polled = await this.rest.fetchPolledState()
			if (generation !== this.connectionGeneration) return
			const change = this.state.applyPolledState(polled)
			if (Object.keys(change.changedVariables).length > 0) {
				this.setVariableValues(change.changedVariables)
			}
			if (change.affectedFeedbacks.length > 0) {
				this.checkFeedbacks(...change.affectedFeedbacks)
			}
			if (polled.sawForbidden) {
				this.markTierBlocked()
			}
			// Deliberately NO clearTierBlocked here: some of the polled GETs may
			// be ungated, so a "clean" poll proves nothing about entitlement —
			// clearing on it would oscillate the status every 5 s against the
			// gated calls. The block clears only when a GATED call succeeds
			// (getActiveOverlays in handleConnected, caster_mode execute).
			if (!this.versionFetched) {
				await this.fetchVersionOnce(generation)
			}
		} catch (err) {
			if (generation !== this.connectionGeneration) return
			// fetchPolledState tolerates per-request failures internally; this is a safety net.
			this.log('debug', `Poll failed: ${err instanceof Error ? err.message : String(err)}`)
		} finally {
			// Only the current cycle may clear its own overlap guard — a stale
			// cycle's landing poll must not unblock the new cycle's in-flight
			// gate (teardownConnection already reset the flag for the new cycle).
			if (generation === this.connectionGeneration) {
				this.pollInFlight = false
			}
		}
	}

	private async fetchVersionOnce(generation: number): Promise<void> {
		if (this.versionFetched || !this.rest) return
		try {
			const version = await this.rest.getVersion()
			if (generation !== this.connectionGeneration) return
			if (version) {
				this.versionFetched = true
				this.state.appVersion = version
				this.setVariableValues({ appVersion: version })
			}
		} catch (err) {
			if (generation !== this.connectionGeneration) return
			if (isForbiddenError(err)) {
				this.markTierBlocked()
			} else {
				this.log('debug', `Version fetch failed: ${err instanceof Error ? err.message : String(err)}`)
			}
		}
	}

	// --- tier gating ---

	markTierBlocked(): void {
		if (!this.state.tierBlocked) {
			this.state.tierBlocked = true
			this.setVariableValues({ tier: 'blocked' })
			this.checkFeedbacks('tierEntitled')
		}
		// Always (re)assert the status, even when already blocked: a reconnect
		// may have set Connecting after the block was first raised, and an
		// early-return here would strand the instance on Connecting forever.
		// InstanceStatus.InsufficientPermissions does not exist in
		// @companion-module/base 1.14 — AuthenticationFailure is the closest
		// sanctioned status for entitlement problems on this API version.
		this.updateStatus(InstanceStatus.AuthenticationFailure, TIER_MESSAGE)
	}

	clearTierBlocked(): void {
		if (!this.state.tierBlocked) return
		this.state.tierBlocked = false
		this.setVariableValues({ tier: 'ok' })
		this.checkFeedbacks('tierEntitled')
		this.updateStatus(this.rpcConnected ? InstanceStatus.Ok : InstanceStatus.Connecting)
	}

	// --- error handling helpers used by actions.ts ---

	handleCommandResult(actionId: string, result: CasterCommandResultDto): void {
		if (result.ok) {
			// caster_mode.execute is a gated call — success proves entitlement,
			// so clear any stale tier block (no-op when not blocked).
			this.clearTierBlocked()
			return
		}
		if (isUnauthorizedMessage(result.error)) {
			this.markTierBlocked()
		}
		this.log('error', `${actionId}: command failed: ${result.error}`)
	}

	handleCommandError(actionId: string, err: unknown): void {
		const message = err instanceof Error ? err.message : String(err)
		if (isTierError(err)) {
			this.markTierBlocked()
			this.log('warn', `${actionId}: ${message}`)
			return
		}
		this.log('error', `${actionId}: ${message}`)
	}

	handleRestError(actionId: string, err: unknown): void {
		if (isForbiddenError(err)) {
			this.markTierBlocked()
			this.log('warn', `${actionId}: ${TIER_MESSAGE}`)
			return
		}
		this.log('error', `${actionId}: ${err instanceof Error ? err.message : String(err)}`)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
