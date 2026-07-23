import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		environment: 'node',
		include: ['src/__tests__/**/*.spec.ts'],
		// Generous but bounded — the RPC integration tests run real sockets and
		// reconnect cycles (tuned to milliseconds via the RpcTuning test hook).
		testTimeout: 15_000,
		hookTimeout: 15_000,
	},
})
