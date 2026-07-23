/**
 * Integration tests for the transition REST client. A real local HTTP server
 * verifies method/path selection and the app's current-match JSON shapes.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { LeagueBroadcastRest } from '../client/rest.js'

interface RecordedRequest {
	method: string
	path: string
	body: string
}

const servers: Server[] = []

afterEach(async () => {
	for (const server of servers.splice(0)) {
		server.closeAllConnections()
		await new Promise<void>((resolve) => server.close(() => resolve()))
	}
})

async function startRestServer(
	handle: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ client: LeagueBroadcastRest; requests: RecordedRequest[] }> {
	const requests: RecordedRequest[] = []
	const server = createServer((req, res) => {
		let body = ''
		req.setEncoding('utf8')
		req.on('data', (chunk: string) => {
			body += chunk
		})
		req.on('end', () => {
			requests.push({ method: req.method ?? '', path: req.url ?? '', body })
			handle(req, res)
		})
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	servers.push(server)
	const port = (server.address() as AddressInfo).port
	return { client: new LeagueBroadcastRest('127.0.0.1', port), requests }
}

function json(res: ServerResponse, value: unknown): void {
	res.writeHead(200, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify(value))
}

function ok(res: ServerResponse): void {
	res.writeHead(200)
	res.end()
}

describe('setGameWinner', () => {
	it('resolves the active game and its current red-side team at press time', async () => {
		const { client, requests } = await startRestServer((req, res) => {
			if (req.method === 'GET' && req.url === '/api/match/current') {
				json(res, {
					games: [
						{
							gameId: 40,
							isActive: false,
							isComplete: false,
							teams: [{ teamId: 1 }, { teamId: 2 }],
						},
						{
							gameId: 41,
							isActive: true,
							isComplete: false,
							teams: [{ teamId: 9 }, { teamId: 7 }],
						},
					],
				})
			} else {
				ok(res)
			}
		})

		await client.setGameWinner('red')

		expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
			'GET /api/match/current',
			'PUT /api/game/41/winner/7',
		])
	})

	it('targets an explicit game id and follows that game’s blue-side ordering', async () => {
		const { client, requests } = await startRestServer((req, res) => {
			if (req.method === 'GET' && req.url === '/api/game/88') {
				json(res, {
					gameId: 88,
					isActive: false,
					isComplete: true,
					teams: [{ teamId: 22 }, { teamId: 11 }],
				})
			} else {
				ok(res)
			}
		})

		await client.setGameWinner('blue', 88)

		expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
			'GET /api/game/88',
			'PUT /api/game/88/winner/22',
		])
	})

	it('clears the winner through the DELETE endpoint', async () => {
		const { client, requests } = await startRestServer((req, res) => {
			if (req.method === 'GET' && req.url === '/api/game/88') {
				json(res, { gameId: 88, teams: [{ teamId: 22 }, { teamId: 11 }] })
			} else {
				ok(res)
			}
		})

		await client.setGameWinner('clear', 88)

		expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
			'GET /api/game/88',
			'DELETE /api/game/88/winner',
		])
	})

	it('fails locally when the selected side has no team', async () => {
		const { client, requests } = await startRestServer((req, res) => {
			json(res, { games: [{ gameId: 42, isActive: true, teams: [{ teamId: 5 }] }] })
		})

		await expect(client.setGameWinner('red')).rejects.toThrow('Game 42 has no red team')
		expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual(['GET /api/match/current'])
	})
})

describe('getVersion', () => {
	it('formats the app SemanticVersion JSON shape', async () => {
		const { client, requests } = await startRestServer((_req, res) => {
			json(res, {
				major: 7,
				minor: 2,
				patch: 7,
				releaseLabels: [],
				release: '',
				isPrerelease: false,
			})
		})

		await expect(client.getVersion()).resolves.toBe('7.2.7')
		expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual(['GET /api/status/version'])
	})

	it('preserves prerelease labels and legacy string responses', async () => {
		let requestCount = 0
		const { client } = await startRestServer((_req, res) => {
			requestCount++
			json(res, requestCount === 1 ? { major: 7, minor: 3, patch: 0, releaseLabels: ['beta', '2'] } : '7.3.0')
		})

		await expect(client.getVersion()).resolves.toBe('7.3.0-beta.2')
		await expect(client.getVersion()).resolves.toBe('7.3.0')
	})
})
