import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

export default generateEslintConfig({
	enableTypescript: true,
	// Vendored code (RPC runtime + generated stubs) is copied verbatim from the
	// LeagueBroadcast repo and must not be reformatted or lint-fixed here.
	ignores: ['src/vendor/**'],
})
