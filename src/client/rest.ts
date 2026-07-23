/**
 * Transition-only REST fallbacks for LeagueBroadcast surfaces that have no RPC
 * namespace yet (postgame push, mock toggles, match control, hotkeys, status).
 *
 * Every function here is tagged with `TRANSITION(REST)` — each one is deleted
 * as its RPC twin lands in the app. This file hitting zero functions is the
 * "migration done" signal for the module (design.md §10).
 */

const REQUEST_TIMEOUT_MS = 10_000

/** Error thrown for non-2xx REST responses, carrying the HTTP status code. */
export class RestHttpError extends Error {
	readonly status: number

	constructor(status: number, message: string) {
		super(message)
		this.name = 'RestHttpError'
		this.status = status
	}
}

/** True when the error is a 403 — used for tier/entitlement messaging. */
export function isForbiddenError(err: unknown): boolean {
	return err instanceof RestHttpError && err.status === 403
}

export type MockPhase = 'pregame' | 'ingame' | 'postgame'
export type PostgameScope = 'current' | 'team' | 'player'

/** Result of one poll cycle. `null` pieces mean that individual request failed. */
export interface PolledState {
	/** Mirrors the 'pregame' (champion select) mock flag. */
	championSelectMock: boolean | null
	ingameMock: boolean | null
	postgameMock: boolean | null
	/** `null` = request failed; `''` = no component active. */
	postgameActiveComponent: string | null
	hotkeysEnabled: boolean | null
	/** True when any polled request was rejected with HTTP 403 (tier gate). */
	sawForbidden: boolean
}

function coerceBoolean(value: unknown): boolean | null {
	if (typeof value === 'boolean') return value
	if (typeof value === 'number') return value !== 0
	if (typeof value === 'string') {
		const lower = value.trim().toLowerCase()
		if (lower === 'true') return true
		if (lower === 'false') return false
		return null
	}
	if (value !== null && typeof value === 'object') {
		const obj = value as Record<string, unknown>
		for (const key of ['enabled', 'active', 'mock', 'value']) {
			const nested = coerceBoolean(obj[key])
			if (nested !== null) return nested
		}
	}
	return null
}

function coerceString(value: unknown): string | null {
	if (typeof value === 'string') return value.length > 0 ? value : null
	if (value !== null && typeof value === 'object') {
		const obj = value as Record<string, unknown>
		for (const key of ['componentType', 'component', 'name', 'type', 'version', 'value']) {
			const nested = obj[key]
			if (typeof nested === 'string' && nested.length > 0) return nested
		}
	}
	return null
}

export class LeagueBroadcastRest {
	private readonly baseUrl: string

	constructor(host: string, port: number) {
		this.baseUrl = `http://${host}:${port}`
	}

	private async request(method: string, path: string, jsonBody?: unknown): Promise<unknown> {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
		try {
			const res = await fetch(`${this.baseUrl}${path}`, {
				method,
				signal: controller.signal,
				headers: jsonBody !== undefined ? { 'Content-Type': 'application/json' } : undefined,
				body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
			})
			if (!res.ok) {
				throw new RestHttpError(res.status, `${method} ${path} failed with HTTP ${res.status}`)
			}
			const text = await res.text()
			if (text.length === 0) return null
			try {
				return JSON.parse(text) as unknown
			} catch (_err) {
				return text
			}
		} finally {
			clearTimeout(timeout)
		}
	}

	// TRANSITION(REST): replace with RPC twin when available
	async setMock(phase: MockPhase, enabled: boolean): Promise<void> {
		// The app routes api/pregame/ as an alias of api/championselect/ — the pregame alias matches the module's 'pregame' phase id.
		await this.request('POST', `/api/${phase}/mock/${enabled}`)
	}

	// TRANSITION(REST): replace with RPC twin when available
	async postgameShowComponent(
		componentType: string,
		scope: PostgameScope,
		teamSide?: string | number,
		playerIndex?: number,
	): Promise<void> {
		let path = `/api/postgame/active/${encodeURIComponent(componentType)}/current`
		if (scope === 'team' && teamSide !== undefined) {
			path += `/team/${teamSide}`
		} else if (scope === 'player' && playerIndex !== undefined) {
			path += `/player/${playerIndex}`
		}
		await this.request('POST', path)
	}

	// TRANSITION(REST): replace with RPC twin when available
	async postgameClear(): Promise<void> {
		await this.request('DELETE', '/api/postgame/active-component')
	}

	// TRANSITION(REST): replace with RPC twin when available
	async selectSeries(seriesId: string): Promise<void> {
		await this.request('POST', `/api/match/current/${encodeURIComponent(seriesId)}`)
	}

	// TRANSITION(REST): replace with RPC twin when available
	async setBestOf(n: number): Promise<void> {
		await this.request('PUT', '/api/match/current/bestof', n)
	}

	// TRANSITION(REST): replace with RPC twin when available
	async swapSides(seriesId: string): Promise<void> {
		await this.request('POST', `/api/match/current/${encodeURIComponent(seriesId)}/switch`)
	}

	// TRANSITION(REST): replace with RPC twin when available
	async setHotkeysEnabled(enabled: boolean): Promise<void> {
		await this.request('POST', `/api/settings/hotkeys/${enabled ? 'enable' : 'disable'}`)
	}

	// TRANSITION(REST): replace with RPC twin when available
	async getVersion(): Promise<string | null> {
		const value = await this.request('GET', '/api/status/version')
		return coerceString(value)
	}

	/**
	 * One slow-poll cycle for state that has no RPC subscription yet.
	 * Individual request failures are tolerated: the corresponding piece is
	 * returned as `null` and everything else still comes through.
	 */
	// TRANSITION(REST): replace with RPC twin when available
	async fetchPolledState(): Promise<PolledState> {
		let sawForbidden = false

		const tryGet = async (path: string): Promise<unknown> => {
			try {
				return await this.request('GET', path)
			} catch (err) {
				if (isForbiddenError(err)) sawForbidden = true
				return undefined
			}
		}

		const [championSelectMock, ingameMock, postgameMock, activeComponent, hotkeysEnabled] = await Promise.all([
			// api/pregame/ is the app's alias of api/championselect/ — used to match the module's 'pregame' phase id.
			tryGet('/api/pregame/mock'),
			tryGet('/api/ingame/mock'),
			tryGet('/api/postgame/mock'),
			tryGet('/api/postgame/active-component'),
			tryGet('/api/settings/hotkeys/enabled'),
		])

		return {
			championSelectMock: championSelectMock === undefined ? null : coerceBoolean(championSelectMock),
			ingameMock: ingameMock === undefined ? null : coerceBoolean(ingameMock),
			postgameMock: postgameMock === undefined ? null : coerceBoolean(postgameMock),
			postgameActiveComponent: activeComponent === undefined ? null : (coerceString(activeComponent) ?? ''),
			hotkeysEnabled: hotkeysEnabled === undefined ? null : coerceBoolean(hotkeysEnabled),
			sawForbidden,
		}
	}
}
