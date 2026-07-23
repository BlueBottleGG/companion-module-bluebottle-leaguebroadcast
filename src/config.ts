import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
	/**
	 * bonjour-device selection. Companion stores the picked announcement as
	 * `"address:port"`; empty/null/undefined means "Manual" (use `host`).
	 * Resolve through `resolveConfigHost` — never read this directly.
	 */
	bonjourHost?: string | null
}

/**
 * Values of `secret-text` config fields. Companion keeps these in a separate
 * secrets store (not the config store) and delivers them alongside the config
 * in `init()`/`configUpdated()`.
 */
export interface ModuleSecrets {
	/**
	 * Remote pairing token (LeagueBroadcast → Settings → Remote Control).
	 * Empty/undefined on same-machine setups — loopback auto-authenticates.
	 */
	pairingToken?: string
}

/**
 * Effective host: the bonjour-discovered address when one is selected,
 * otherwise the manual `host` field.
 *
 * The port part of the bonjour value is deliberately IGNORED: current
 * LeagueBroadcast builds advertise `_leaguebroadcast._tcp` with a wrong port
 * (80), so only the discovered address is trusted and the configured `port`
 * (default 58869) is kept.
 *
 * Port-stripping heuristic (the stored value is a plain string, so IPv6 makes
 * it ambiguous):
 * - contains `]` → bracketed IPv6 (`[fe80::1]:80` or `[fe80::1]`): the address
 *   is the bracket contents; anything after `]` is a port suffix and dropped.
 * - contains 2+ colons and no `]` → treat the WHOLE value as a bare IPv6 host
 *   and do NOT strip a port. `fe80::1:80` is genuinely ambiguous (it is itself
 *   a valid IPv6 address) — a wrong "port" guess would corrupt the address,
 *   while keeping it whole is correct for the common bare-address announcement.
 * - one colon → `host:port`, strip the port.
 * - no colon → bare host.
 */
export function resolveConfigHost(config: ModuleConfig): string {
	const bonjour = config.bonjourHost ?? ''
	if (bonjour !== '') {
		let address: string
		const closeBracket = bonjour.indexOf(']')
		if (closeBracket >= 0) {
			address = bonjour.slice(bonjour.startsWith('[') ? 1 : 0, closeBracket)
		} else if (bonjour.indexOf(':') !== bonjour.lastIndexOf(':')) {
			address = bonjour // bare IPv6 — see heuristic above
		} else {
			const cut = bonjour.lastIndexOf(':')
			address = cut > 0 ? bonjour.slice(0, cut) : bonjour
		}
		if (address !== '') return address
	}
	return config.host
}

/**
 * Format a host for embedding in a URL: IPv6 literals (any host containing a
 * colon) must be bracketed; already-bracketed values and everything else pass
 * through unchanged. Used for both the REST base URL and the RPC ws URL.
 */
export function formatHostForUrl(host: string): string {
	return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			// Companion watches the manifest's bonjourQueries entry of the same id
			// (`_leaguebroadcast._tcp`) and offers discovered apps here; "Manual"
			// (empty) falls back to the host field below.
			type: 'bonjour-device',
			id: 'bonjourHost',
			label: 'LeagueBroadcast (discovered)',
			tooltip: 'Pick a LeagueBroadcast instance found on the network, or Manual to enter a hostname/IP yourself',
			width: 12,
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'LeagueBroadcast Host',
			tooltip: 'Hostname or IP of the machine running LeagueBroadcast',
			width: 8,
			regex: Regex.HOSTNAME,
			default: '127.0.0.1',
			isVisibleExpression: '!$(options:bonjourHost)',
		},
		{
			type: 'static-text',
			id: 'hostFiller',
			label: 'LeagueBroadcast Host',
			value: 'Using the discovered address (port below still applies)',
			width: 8,
			isVisibleExpression: '!!$(options:bonjourHost)',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			tooltip: 'LeagueBroadcast local API port',
			width: 4,
			min: 1,
			max: 65535,
			default: 58869,
		},
		{
			type: 'secret-text',
			id: 'pairingToken',
			label: 'Pairing token (remote only)',
			tooltip:
				'Only needed when Companion runs on a different machine than LeagueBroadcast. ' +
				'Generate in LeagueBroadcast → Settings → Remote Control. Leave empty on the same machine.',
			width: 12,
			default: '',
		},
	]
}
