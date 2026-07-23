import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'LeagueBroadcast Host',
			tooltip: 'Hostname or IP of the machine running LeagueBroadcast (v1 supports the local machine only)',
			width: 8,
			regex: Regex.HOSTNAME,
			default: '127.0.0.1',
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
	]
}
