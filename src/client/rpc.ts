/**
 * FlatBuffers RPC transport for LeagueBroadcast (design.md §3.3, rev 2).
 *
 * Wraps the vendored @bluebottle/rpc runtime + generated namespace stubs
 * (src/vendor/) behind the stable `LeagueBroadcastRpc` seam that main.ts and
 * commands.ts are written against.
 *
 * Lifecycle:
 * - A FRESH RpcClient is constructed per connect cycle. The runtime's
 *   `disconnect()` permanently disables that instance's reconnect loop, so
 *   `destroy()` drops the instance; the next connect cycle (a new facade from
 *   `createRpcClient`) builds a new one.
 * - Subscriptions are issued exactly ONCE per RpcClient instance — the runtime
 *   replays every tracked subscription channel itself on reconnect.
 * - `connect()` never rejects: initial-connect failures are handled by the
 *   runtime's own reconnect loop ('reconnecting' events fire).
 */

import type { CasterCommandDto, CasterCommandResultDto, CasterPanelStateDto } from './lb-types.js'
import { FlatBufferReader, RpcClient, RpcError } from '../vendor/bluebottle-rpc/index.js'
import { createCaster_modeRpc, type Caster_modeRpc } from '../vendor/generated/caster-mode-rpc.js'
import { createCinematicsRpc, type CinematicsRpc } from '../vendor/generated/cinematics-rpc.js'

export type RpcConnectionEvent = 'connected' | 'disconnected' | 'reconnecting' | 'reconnect-failed'

/**
 * Application-level heartbeat: probe method + interval. The wire method matches
 * the generated ping stub (`ping.echo` in src/vendor/generated/ping-rpc.ts),
 * which is also the runtime's default — pinned here so a future default change
 * in the runtime cannot silently break the heartbeat.
 */
const HEARTBEAT_METHOD = 'ping.echo'
const HEARTBEAT_INTERVAL_MS = 15_000

const TIER_MESSAGE = 'Companion control requires the LeagueBroadcast Basic tier'

/**
 * Thrown when the app rejects an RPC call for tier/entitlement reasons
 * (`RpcException.Unauthorized`, wire code 401 — the app throws it from
 * `caster_mode.execute` for feature-gate rejections specifically so external
 * callers can key on the code). The RPC twin of rest.ts's `isForbiddenError`.
 */
export class TierError extends Error {
	constructor(message?: string) {
		super(message ?? TIER_MESSAGE)
		this.name = 'TierError'
	}
}

/** True when the error is a tier/entitlement rejection — mirrors rest.ts's isForbiddenError. */
export function isTierError(err: unknown): boolean {
	return err instanceof TierError
}

function isTierRpcFailure(err: unknown): boolean {
	if (!(err instanceof RpcError)) return false
	return err.code === 401 || /unauthori[sz]ed|feature|tier/i.test(err.message)
}

/** Map an RPC failure: tier rejections → TierError; everything else rethrown with context. */
function mapRpcFailure(context: string, err: unknown): Error {
	const message = err instanceof Error ? err.message : String(err)
	if (isTierRpcFailure(err)) {
		return new TierError(`${TIER_MESSAGE} (${context}: ${message})`)
	}
	return new Error(`${context} failed: ${message}`, { cause: err })
}

/**
 * Decode the cinematics playback push. The payload is the FlatSharp-serialized
 * `BlueBottleIPC.LeagueBroadcast.Cinematics.CinematicPlayback` table (a standard
 * FlatBuffer, no size prefix): cinematic_id:string(0), time:float(1),
 * length:float(2), state:string(3), playing:bool(4). The module only needs the
 * `playing` bool for the cinematicPlaying feedback.
 */
function decodePlaybackPlaying(raw: Uint8Array): boolean {
	return new FlatBufferReader(raw).readBool(4)
}

export interface LeagueBroadcastRpc {
	connect(): void
	destroy(): void
	readonly connected: boolean
	execute(cmd: CasterCommandDto): Promise<CasterCommandResultDto>
	getConfigJson(): Promise<string>
	getActiveOverlays(): Promise<string[]>
	// cinematics playback transport (design.md §5.4):
	cinematicArm(id: string): Promise<void>
	cinematicGo(): Promise<void>
	cinematicStop(): Promise<void>
	cinematicPlay(id: string): Promise<void>
	// events wired by main.ts:
	/** `reconnectAttempt` is only set for 'reconnecting' — the runtime's attempt counter (1-based). */
	onConnectionEvent?: (ev: RpcConnectionEvent, reconnectAttempt?: number) => void
	onPanelState?: (state: CasterPanelStateDto) => void
	onCinematicPlayback?: (playing: boolean) => void
	onSubscribeError?: (subscription: string, err: Error) => void
}

class LeagueBroadcastRpcTransport implements LeagueBroadcastRpc {
	onConnectionEvent?: (ev: RpcConnectionEvent, reconnectAttempt?: number) => void
	onPanelState?: (state: CasterPanelStateDto) => void
	onCinematicPlayback?: (playing: boolean) => void
	onSubscribeError?: (subscription: string, err: Error) => void

	private readonly url: string
	private client: RpcClient | null = null
	private casterMode: Caster_modeRpc | null = null
	private cinematics: CinematicsRpc | null = null
	private destroyed = false

	constructor(host: string, port: number) {
		this.url = `ws://${host}:${port}/ws/rpc`
	}

	get connected(): boolean {
		return this.client?.isConnected ?? false
	}

	connect(): void {
		// One RpcClient per facade: main.ts creates a fresh facade per connect
		// cycle, so a live client here means connect() was already called.
		if (this.destroyed || this.client) return

		const client = new RpcClient({
			url: this.url,
			reconnect: true, // runtime defaults: 1 s base exp backoff capped 30 s, 250 ms jitter, Infinity attempts
			heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
			heartbeatMethod: HEARTBEAT_METHOD,
		})
		this.client = client
		const casterMode = createCaster_modeRpc(client)
		const cinematics = createCinematicsRpc(client)
		this.casterMode = casterMode
		this.cinematics = cinematics

		// Subscribe once per RpcClient instance; the runtime re-issues tracked
		// channels itself on every reconnect (do NOT resubscribe per 'connected').
		let subscriptionsIssued = false
		client.on('connected', () => {
			this.onConnectionEvent?.('connected')
			if (!subscriptionsIssued) {
				subscriptionsIssued = true
				void this.issueSubscriptions(casterMode, cinematics)
			}
		})
		client.on('disconnected', () => this.onConnectionEvent?.('disconnected'))
		// Pass the runtime's attempt counter through so main.ts can surface a
		// ConnectionFailure after repeated failures (the runtime retries forever
		// by default, so 'reconnect-failed' never fires on its own).
		client.on('reconnecting', (info) => this.onConnectionEvent?.('reconnecting', info.attempt))
		client.on('reconnect-failed', () => this.onConnectionEvent?.('reconnect-failed'))

		// Initial-connect failure is handled by the runtime's own reconnect
		// loop — never let this promise reject unhandled.
		client.connect().catch(() => {})
	}

	destroy(): void {
		this.destroyed = true
		const client = this.client
		this.client = null
		this.casterMode = null
		this.cinematics = null
		this.onConnectionEvent = undefined
		this.onPanelState = undefined
		this.onCinematicPlayback = undefined
		this.onSubscribeError = undefined
		// disconnect() permanently disables this instance's reconnect — the
		// instance is dropped here and never reused.
		client?.disconnect()
	}

	private async issueSubscriptions(casterMode: Caster_modeRpc, cinematics: CinematicsRpc): Promise<void> {
		try {
			const panel = await casterMode.subscribeLocalPanelState()
			panel.onEvent((state) => this.onPanelState?.(state))
		} catch (err) {
			this.onSubscribeError?.(
				'caster_mode.subscribe_local_panel_state',
				mapRpcFailure('caster_mode.subscribe_local_panel_state', err),
			)
		}

		try {
			const playback = await cinematics.subscribePlayback()
			playback.onEvent((raw) => {
				try {
					this.onCinematicPlayback?.(decodePlaybackPlaying(raw))
				} catch (err) {
					this.onSubscribeError?.(
						'cinematics.subscribe_playback',
						mapRpcFailure('cinematics.subscribe_playback (decode)', err),
					)
				}
			})
		} catch (err) {
			this.onSubscribeError?.('cinematics.subscribe_playback', mapRpcFailure('cinematics.subscribe_playback', err))
		}
	}

	private requireCasterMode(): Caster_modeRpc {
		if (!this.casterMode) throw new Error('RPC transport not started (connect() not called)')
		return this.casterMode
	}

	private requireCinematics(): CinematicsRpc {
		if (!this.cinematics) throw new Error('RPC transport not started (connect() not called)')
		return this.cinematics
	}

	async execute(cmd: CasterCommandDto): Promise<CasterCommandResultDto> {
		try {
			return await this.requireCasterMode().execute(cmd)
		} catch (err) {
			throw mapRpcFailure('caster_mode.execute', err)
		}
	}

	async getConfigJson(): Promise<string> {
		try {
			const config = await this.requireCasterMode().getConfig()
			return config.json
		} catch (err) {
			throw mapRpcFailure('caster_mode.get_config', err)
		}
	}

	async getActiveOverlays(): Promise<string[]> {
		try {
			const result = await this.requireCasterMode().getActiveOverlays()
			return result.overlays.filter((name): name is string => name !== null && name !== '')
		} catch (err) {
			throw mapRpcFailure('caster_mode.get_active_overlays', err)
		}
	}

	async cinematicArm(id: string): Promise<void> {
		try {
			await this.requireCinematics().arm(id)
		} catch (err) {
			throw mapRpcFailure('cinematics.arm', err)
		}
	}

	async cinematicGo(): Promise<void> {
		try {
			await this.requireCinematics().go()
		} catch (err) {
			throw mapRpcFailure('cinematics.go', err)
		}
	}

	async cinematicStop(): Promise<void> {
		try {
			await this.requireCinematics().stop()
		} catch (err) {
			throw mapRpcFailure('cinematics.stop', err)
		}
	}

	async cinematicPlay(id: string): Promise<void> {
		try {
			await this.requireCinematics().play(id)
		} catch (err) {
			throw mapRpcFailure('cinematics.play', err)
		}
	}
}

/**
 * Create the RPC transport for a LeagueBroadcast host. One facade per connect
 * cycle: `connect()` builds the underlying RpcClient, `destroy()` tears it
 * down permanently (a new cycle calls `createRpcClient` again).
 */
export function createRpcClient(host: string, port: number): LeagueBroadcastRpc {
	return new LeagueBroadcastRpcTransport(host, port)
}
