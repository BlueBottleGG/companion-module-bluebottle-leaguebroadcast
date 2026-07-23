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

import WsWebSocket from 'ws'
import type { CasterCommandDto, CasterCommandResultDto, CasterPanelStateDto } from './lb-types.js'
import { formatHostForUrl } from '../config.js'
import { FlatBufferReader, RpcClient, RpcError, type RpcClientOptions } from '../vendor/bluebottle-rpc/index.js'
import { createCaster_modeRpc, type Caster_modeRpc } from '../vendor/generated/caster-mode-rpc.js'
import { createCinematicsRpc, type CinematicsRpc } from '../vendor/generated/cinematics-rpc.js'

/**
 * 'invalid-url' is terminal for the connect cycle: the configured host/port
 * cannot be assembled into a parseable ws URL, so no RpcClient is ever built
 * and no reconnect loop runs — main.ts must surface ConnectionFailure instead
 * of stranding on Connecting.
 */
export type RpcConnectionEvent = 'connected' | 'disconnected' | 'reconnecting' | 'reconnect-failed' | 'invalid-url'

/**
 * Remote-only application-level heartbeat. Loopback sockets do not need a
 * liveness probe; remote sockets can otherwise remain half-open after a network
 * path silently disappears. The wire method matches the generated ping stub
 * (`ping.echo` in src/vendor/generated/ping-rpc.ts).
 */
const HEARTBEAT_METHOD = 'ping.echo'
const HEARTBEAT_INTERVAL_MS = 15_000

/**
 * Whether a configured host is unambiguously loopback without doing DNS.
 * Hostnames that merely resolve to loopback stay on the conservative remote
 * path because resolving here would make connection setup asynchronous.
 */
export function isLoopbackHost(host: string): boolean {
	const normalized = host
		.trim()
		.toLowerCase()
		.replace(/^\[|\]$/g, '')
		.replace(/\.$/, '')
	const address = normalized.split('%', 1)[0] // strip an IPv6 zone id

	return (
		address === 'localhost' ||
		address.endsWith('.localhost') ||
		/^127(?:\.\d{1,3}){3}$/.test(address) ||
		address === '::1' ||
		address === '0:0:0:0:0:0:0:1' ||
		/^::ffff:127(?:\.\d{1,3}){3}$/.test(address)
	)
}

const TIER_MESSAGE = 'Companion control requires the LeagueBroadcast Basic tier'
const AUTH_MESSAGE = 'This connection needs a pairing token (LeagueBroadcast Settings → Remote Control)'

/**
 * Exact Origin the app's RPC endpoint allowlists for remote Companion peers.
 * The server framework only evaluates the `Authorization: Bearer` pairing token
 * for allowlisted-Origin upgrades, so BOTH headers must travel together. Never
 * send it without a token: on loopback a foreign Origin would DOWNGRADE the
 * auto-`local` scope to anonymous.
 */
const COMPANION_ORIGIN = 'http://companion.bluebottle.invalid'

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

/**
 * Thrown when the app rejects a gated RPC call because the connection itself is
 * not authenticated (remote connection accepted in anonymous scope — no/expired
 * pairing token). Same wire code 401 as the tier gate, but a different problem
 * with a different fix (pair the connection, not upgrade the tier), so it gets
 * its own error type.
 */
export class AuthRequiredError extends Error {
	constructor(message?: string) {
		super(message ?? AUTH_MESSAGE)
		this.name = 'AuthRequiredError'
	}
}

/** True when the error means the connection needs a pairing token — the auth twin of isTierError. */
export function isAuthError(err: unknown): boolean {
	return err instanceof AuthRequiredError
}

/**
 * The app answers gated calls on an unauthenticated (anonymous-scope) connection
 * with RpcError 401 message "Not authenticated" — the same wire code the tier
 * gate uses, so the two 401 flavors MUST be told apart by message. This pattern
 * deliberately does NOT overlap isTierRpcFailure's message regex
 * (`unauthori[sz]ed|feature|tier` — none of which matches "Not authenticated").
 */
function isAuthRpcFailure(err: unknown): boolean {
	return err instanceof RpcError && err.code === 401 && /not authenticated/i.test(err.message)
}

function isTierRpcFailure(err: unknown): boolean {
	if (!(err instanceof RpcError)) return false
	// Connection-auth 401s are NOT tier rejections — check them first, since the
	// bare `code === 401` clause below would otherwise swallow them.
	if (isAuthRpcFailure(err)) return false
	return err.code === 401 || /unauthori[sz]ed|feature|tier/i.test(err.message)
}

/**
 * Map an RPC failure: connection-auth rejections → AuthRequiredError; tier
 * rejections → TierError; everything else rethrown with context.
 */
function mapRpcFailure(context: string, err: unknown): Error {
	const message = err instanceof Error ? err.message : String(err)
	if (isAuthRpcFailure(err)) {
		return new AuthRequiredError(`${AUTH_MESSAGE} (${context}: ${message})`)
	}
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

/**
 * TEST-ONLY tuning knobs forwarded verbatim to the underlying RpcClient so the
 * integration tests can drive reconnect/heartbeat cycles in milliseconds.
 * Production callers (main.ts) omit this — the values documented in `connect()`
 * apply (1 s base exponential backoff capped at 30 s, 250 ms jitter, Infinity
 * attempts, and a 15 s heartbeat for remote hosts only).
 */
export type RpcTuning = Partial<
	Pick<RpcClientOptions, 'reconnectDelay' | 'maxReconnectDelay' | 'reconnectJitter' | 'heartbeatIntervalMs'>
>

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
	/**
	 * Fired when the WebSocket upgrade is answered with a non-101 HTTP response
	 * (only possible on the pairing-token path — the `ws` factory is the only
	 * socket that reports upgrade responses). 401 = invalid/revoked pairing token:
	 * the server fails closed at upgrade. The rejected socket is destroyed here so
	 * the runtime's normal onclose → reconnect loop proceeds; fires again on every
	 * rejected retry.
	 */
	onUpgradeRejected?: (statusCode: number) => void
}

class LeagueBroadcastRpcTransport implements LeagueBroadcastRpc {
	onConnectionEvent?: (ev: RpcConnectionEvent, reconnectAttempt?: number) => void
	onPanelState?: (state: CasterPanelStateDto) => void
	onCinematicPlayback?: (playing: boolean) => void
	onSubscribeError?: (subscription: string, err: Error) => void
	onUpgradeRejected?: (statusCode: number) => void

	private readonly url: string
	private readonly urlValid: boolean
	private readonly pairingToken: string
	private readonly tuning: RpcTuning
	private client: RpcClient | null = null
	private casterMode: Caster_modeRpc | null = null
	private cinematics: CinematicsRpc | null = null
	private destroyed = false

	constructor(host: string, port: number, pairingToken?: string, tuning?: RpcTuning) {
		// formatHostForUrl brackets IPv6 literals so the ws URL parses.
		this.url = `ws://${formatHostForUrl(host)}:${port}/ws/rpc`
		// Validate BEFORE any RpcClient is constructed: an unparseable host/port
		// must become a distinct 'invalid-url' event (see connect()) instead of
		// an exception from deep inside the runtime's socket construction.
		this.urlValid = URL.canParse(this.url)
		this.pairingToken = pairingToken?.trim() ?? ''
		this.tuning = tuning ?? {}
	}

	/**
	 * Build the `ws`-package socket used when a pairing token is configured.
	 * Both upgrade headers travel together: the server framework only evaluates
	 * the Bearer token for peers whose Origin is on its allowlist
	 * (COMPANION_ORIGIN is the exact allowlisted string). Without a token the
	 * runtime's default native WebSocket is used instead — sending NO custom
	 * headers at all, because a foreign Origin on a loopback connection would
	 * downgrade the auto-`local` scope to anonymous.
	 */
	private readonly createPairedWebSocket = (url: string): WebSocket => {
		const socket = new WsWebSocket(url, {
			headers: {
				Origin: COMPANION_ORIGIN,
				Authorization: `Bearer ${this.pairingToken}`,
			},
			followRedirects: false,
		})
		// 'unexpected-response' is a ws-package-only event: the upgrade came back
		// as a plain HTTP response instead of 101 (invalid pairing token → HTTP 401
		// rejected at upgrade, fail closed). Attaching a listener suppresses ws's
		// built-in abort, so this handler must tear the socket down itself:
		// terminate() aborts the request and emits 'error' + 'close', which drives
		// the runtime's normal onclose → reconnect backoff path.
		socket.on('unexpected-response', (_req, res) => {
			this.onUpgradeRejected?.(res.statusCode ?? 0)
			res.resume() // drain so the underlying socket can be reclaimed
			socket.terminate()
		})
		// The runtime only uses the browser-style surface (binaryType/on*/send/
		// close), which the ws package implements — the cast bridges the ws class
		// to the native WebSocket type the vendored option is declared with.
		return socket as unknown as WebSocket
	}

	get connected(): boolean {
		return this.client?.isConnected ?? false
	}

	connect(): void {
		// One RpcClient per facade: main.ts creates a fresh facade per connect
		// cycle, so a live client here means connect() was already called.
		if (this.destroyed || this.client) return
		if (!this.urlValid) {
			// Fired synchronously — main.ts attaches its handlers before calling
			// connect(), and this cycle can never progress past this point.
			this.onConnectionEvent?.('invalid-url')
			return
		}

		const client = new RpcClient({
			url: this.url,
			reconnect: true, // runtime defaults: 1 s base exp backoff capped 30 s, 250 ms jitter, Infinity attempts
			heartbeatIntervalMs: isLoopbackHost(new URL(this.url).hostname) ? 0 : HEARTBEAT_INTERVAL_MS,
			heartbeatMethod: HEARTBEAT_METHOD,
			// Pairing token configured → inject the header-carrying ws socket.
			// No token → leave the factory unset so the runtime uses the native
			// WebSocket with NO custom headers (see createPairedWebSocket).
			...(this.pairingToken !== '' ? { webSocketFactory: this.createPairedWebSocket } : {}),
			// Test-only overrides (empty in production — see RpcTuning).
			...this.tuning,
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
		this.onUpgradeRejected = undefined
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
 *
 * `pairingToken` (optional): when non-empty, every connect attempt sends the
 * remote-pairing upgrade headers (allowlisted Origin + `Authorization: Bearer`).
 * Leave it empty on the same machine — loopback connections auto-authenticate
 * as `local` only when NO custom headers are sent.
 *
 * `tuning` (TEST-ONLY): reconnect/heartbeat timing overrides for the
 * integration tests — production callers must omit it (see RpcTuning).
 */
export function createRpcClient(
	host: string,
	port: number,
	pairingToken?: string,
	tuning?: RpcTuning,
): LeagueBroadcastRpc {
	return new LeagueBroadcastRpcTransport(host, port, pairingToken, tuning)
}
