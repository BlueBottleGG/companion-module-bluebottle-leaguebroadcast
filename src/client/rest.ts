/**
 * Transition-only REST fallbacks for LeagueBroadcast surfaces that have no RPC
 * namespace yet (postgame push, mock toggles, match control, hotkeys, status).
 *
 * Every function here is tagged with `TRANSITION(REST)` — each one is deleted
 * as its RPC twin lands in the app. This file hitting zero functions is the
 * "migration done" signal for the module (design.md §10).
 */

import { formatHostForUrl } from '../config.js'

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

/**
 * True when the error is the app's REST tier gate. The app rejects gated REST
 * calls with HTTP 402 Payment Required (FeatureEntitlementFilter /
 * RequiresFeatureAttribute and the ingame showing overlay gate all use
 * Status402PaymentRequired); 403 is kept as a defensive alias.
 */
export function isForbiddenError(err: unknown): boolean {
	return err instanceof RestHttpError && (err.status === 402 || err.status === 403)
}

export type MockPhase = 'pregame' | 'ingame' | 'postgame'
export type PostgameScope = 'current' | 'team' | 'player'
export type StylePhase = 'pregame' | 'ingame' | 'postgame'

/** One series (match) known to the app, reduced to what dropdowns and labels need. */
export interface SeriesSummary {
	id: number
	label: string
	completed: boolean
}

/** Result of one slow (30 s) poll cycle for series and style-set state. */
export interface SlowPolledState {
	/** `null` = request failed (freeze the last known list). */
	seriesList: SeriesSummary[] | null
	/** `undefined` = request failed (freeze); `null` = the app has no current series (404). */
	currentSeriesId: number | null | undefined
	/** Per phase: `null` = request failed (freeze the last known names). */
	styleSets: Record<StylePhase, string[] | null>
	/** True when any polled request was rejected by the tier gate. */
	sawForbidden: boolean
}

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

/**
 * Reduce the GET api/match payload (MatchWithGamesAndTeams[]) to dropdown
 * summaries. Label preference: match name → "TeamA vs TeamB" → "Series {id}".
 * Completed = LifecycleState.Completed (2) or a winner is set — the app
 * rejects switching to those.
 */
function parseSeriesSummaries(value: unknown): SeriesSummary[] | null {
	if (!Array.isArray(value)) return null
	const list: SeriesSummary[] = []
	for (const item of value) {
		if (item === null || typeof item !== 'object') continue
		const obj = item as Record<string, unknown>
		if (typeof obj.matchId !== 'number') continue
		const teamNames = (Array.isArray(obj.teams) ? obj.teams : [])
			.map((team) => (team !== null && typeof team === 'object' ? (team as Record<string, unknown>).name : undefined))
			.filter((name): name is string => typeof name === 'string' && name.length > 0)
		const name = typeof obj.name === 'string' && obj.name.length > 0 ? obj.name : ''
		const label = name || (teamNames.length >= 2 ? `${teamNames[0]} vs ${teamNames[1]}` : `Series ${obj.matchId}`)
		const completed = obj.lifecycleState === 2 || (obj.winnerId !== null && obj.winnerId !== undefined)
		list.push({ id: obj.matchId, label, completed })
	}
	return list
}

/** Parse the GET api/style/set/{phase} StyleSetNameCollection `{ preset, custom }`. */
function parseStyleSetNames(value: unknown): string[] | null {
	if (value === null || typeof value !== 'object') return null
	const obj = value as Record<string, unknown>
	const collect = (names: unknown): string[] =>
		Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string' && name.length > 0) : []
	return [...collect(obj.preset), ...collect(obj.custom)]
}

/**
 * The game whose team order defines the on-screen blue/red sides — the same
 * pick the app's own Swap Sides button uses (webui useCurrentMatch
 * `sideReferenceGame`): active game, else first incomplete game, else the
 * first game of the series.
 */
function pickSideReferenceGame(match: unknown): { gameId: number; teamIds: number[] } | null {
	if (match === null || typeof match !== 'object') return null
	const games = (match as Record<string, unknown>).games
	if (!Array.isArray(games)) return null
	const parsed = games
		.map((game) => {
			if (game === null || typeof game !== 'object') return null
			const obj = game as Record<string, unknown>
			if (typeof obj.gameId !== 'number') return null
			const teamIds = (Array.isArray(obj.teams) ? obj.teams : [])
				.map((team) =>
					team !== null && typeof team === 'object' ? (team as Record<string, unknown>).teamId : undefined,
				)
				.filter((id): id is number => typeof id === 'number')
			return { gameId: obj.gameId, teamIds, isActive: obj.isActive === true, isComplete: obj.isComplete === true }
		})
		.filter((game) => game !== null)
	return parsed.find((game) => game.isActive) ?? parsed.find((game) => !game.isComplete) ?? parsed[0] ?? null
}

export class LeagueBroadcastRest {
	private readonly baseUrl: string

	constructor(host: string, port: number) {
		// formatHostForUrl brackets IPv6 literals so the URL parses.
		this.baseUrl = `http://${formatHostForUrl(host)}:${port}`
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

	/**
	 * Show/hide one raw overlay via the legacy showing endpoint. The minimal
	 * bare-bool body `{ "<jsonKey>": bool }` is accepted (the app registers
	 * IngameStateSettingsWrapperJsonConverter for exactly this legacy
	 * Stream-Deck shape), and POST merges per-overlay: absent/null overlays
	 * stay untouched (IngameOverlayStateService.ApplySerializationPatch only
	 * applies non-null wrappers). The app answers 400 "Game not running."
	 * outside a running/mocked game and 402 when the overlay's feature gate
	 * rejects a show.
	 */
	// TRANSITION(REST): replace with an RPC raw-overlay twin when one lands
	async setOverlayShowing(overlayName: string, show: boolean): Promise<void> {
		// JSON key = camelCased serialization property name (web JSON defaults).
		const jsonKey = overlayName.charAt(0).toLowerCase() + overlayName.slice(1)
		await this.request('POST', '/api/ingame/showing', { [jsonKey]: show })
	}

	// TRANSITION(REST): replace with RPC twin when available
	async selectSeries(seriesId: string): Promise<void> {
		await this.request('POST', `/api/match/current/${encodeURIComponent(seriesId)}`)
	}

	// TRANSITION(REST): replace with RPC twin when available
	async setBestOf(n: number): Promise<void> {
		await this.request('PUT', '/api/match/current/bestof', n)
	}

	/**
	 * Swap the blue/red sides of a series by reversing the team order of its
	 * side-reference game — the exact operation behind the app's own Swap
	 * Sides button (webui useCurrentMatch.swapTeamSides →
	 * PUT api/game/{gameId}/teams). `seriesId` empty/undefined targets the
	 * current series. NOTE: this replaces the earlier (wrong) call to
	 * POST api/match/current/{id}/switch, which switches the current match.
	 */
	// TRANSITION(REST): replace with RPC twin when available
	async swapSides(seriesId?: string): Promise<void> {
		const path = seriesId ? `/api/match/${encodeURIComponent(seriesId)}` : '/api/match/current'
		const match = await this.request('GET', path)
		const game = pickSideReferenceGame(match)
		if (!game) {
			throw new Error('No game found to swap sides on (no current series, or the series has no games)')
		}
		if (game.teamIds.length < 2) {
			throw new Error('The series game has fewer than two teams — nothing to swap')
		}
		await this.request('PUT', `/api/game/${game.gameId}/teams`, [...game.teamIds].reverse())
	}

	/**
	 * Activate a style set for one phase. The route binds friendly phase names
	 * (pregame/ingame/postgame) via the app's SetPhaseTypeModelBinder; the set
	 * name travels as a query parameter (PUT api/style/set/{phase}/active?name=).
	 */
	// TRANSITION(REST): replace with RPC twin when available
	async activateStyleSet(phase: StylePhase, name: string): Promise<void> {
		await this.request('PUT', `/api/style/set/${phase}/active?name=${encodeURIComponent(name)}`)
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

	/**
	 * One slow (30 s) poll cycle for series and style-set state — the dynamic
	 * sources behind the seriesSelect / styleSetActivate dropdowns and the
	 * currentSeries variable. Individual request failures are tolerated the
	 * same way fetchPolledState tolerates them.
	 */
	// TRANSITION(REST): replace with RPC twin when available
	async fetchSlowPolledState(): Promise<SlowPolledState> {
		let sawForbidden = false

		const tryGet = async (path: string): Promise<unknown> => {
			try {
				return await this.request('GET', path)
			} catch (err) {
				if (isForbiddenError(err)) sawForbidden = true
				return undefined
			}
		}

		/** `undefined` = request failed; `null` = the app reports no current series (404). */
		const getCurrentSeriesId = async (): Promise<number | null | undefined> => {
			try {
				const value = await this.request('GET', '/api/match/current/id')
				if (typeof value === 'number' && Number.isFinite(value)) return value
				if (typeof value === 'string' && value.length > 0) {
					const parsed = Number(value)
					if (Number.isFinite(parsed)) return parsed
				}
				return undefined
			} catch (err) {
				if (err instanceof RestHttpError && err.status === 404) return null
				if (isForbiddenError(err)) sawForbidden = true
				return undefined
			}
		}

		const [seriesListRaw, currentSeriesId, pregameSets, ingameSets, postgameSets] = await Promise.all([
			tryGet('/api/match'),
			getCurrentSeriesId(),
			tryGet('/api/style/set/pregame'),
			tryGet('/api/style/set/ingame'),
			tryGet('/api/style/set/postgame'),
		])

		return {
			seriesList: seriesListRaw === undefined ? null : parseSeriesSummaries(seriesListRaw),
			currentSeriesId,
			styleSets: {
				pregame: pregameSets === undefined ? null : parseStyleSetNames(pregameSets),
				ingame: ingameSets === undefined ? null : parseStyleSetNames(ingameSets),
				postgame: postgameSets === undefined ? null : parseStyleSetNames(postgameSets),
			},
			sawForbidden,
		}
	}
}
