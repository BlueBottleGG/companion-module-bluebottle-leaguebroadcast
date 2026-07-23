import type { ModuleInstance } from './main.js'
import {
	getCasterButtonChoices,
	getPageChoices,
	getPostgameButtonChoices,
	MOCK_PHASE_CHOICES,
	PLAYER_INDEX_CHOICES,
	POSTGAME_COMPONENT_CHOICES,
	TEAM_SIDE_CHOICES,
} from './choices.js'
import type { MockPhase, PostgameScope } from './client/rest.js'

// Action IDs are permanent public API — frozen at v1. Never rename or remove;
// upgrade scripts are the only escape hatch.

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		casterButtonPress: {
			name: 'Caster Button: Press',
			options: [
				{
					id: 'buttonId',
					type: 'dropdown',
					label: 'Caster Button',
					choices: getCasterButtonChoices(self.state),
					default: '',
				},
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'show', label: 'Show' },
						{ id: 'hide', label: 'Hide' },
					],
					default: 'toggle',
				},
			],
			callback: async (event) => {
				const buttonId = String(event.options.buttonId ?? '')
				if (!buttonId) {
					self.log('warn', 'casterButtonPress: no caster button selected')
					return
				}
				const mode = String(event.options.mode ?? 'toggle')
				let show: boolean
				if (mode === 'show') show = true
				else if (mode === 'hide') show = false
				else show = !self.state.activeOverlaysByButtonId.has(buttonId)
				try {
					const result = await self.commands.toggleOverlay(buttonId, show)
					self.handleCommandResult('casterButtonPress', result)
				} catch (err) {
					self.handleCommandError('casterButtonPress', err)
				}
			},
		},
		pageSwitch: {
			name: 'Caster Page: Switch',
			options: [
				{
					id: 'pageId',
					type: 'dropdown',
					label: 'Page',
					choices: getPageChoices(self.state),
					default: '',
				},
			],
			callback: async (event) => {
				const pageId = String(event.options.pageId ?? '')
				if (!pageId) {
					self.log('warn', 'pageSwitch: no page selected')
					return
				}
				try {
					const result = await self.commands.pageSwitch(pageId)
					self.handleCommandResult('pageSwitch', result)
				} catch (err) {
					self.handleCommandError('pageSwitch', err)
				}
			},
		},
		deactivateAll: {
			name: 'Deactivate All Overlays',
			options: [],
			callback: async () => {
				try {
					const result = await self.commands.deactivateAll()
					self.handleCommandResult('deactivateAll', result)
				} catch (err) {
					self.handleCommandError('deactivateAll', err)
				}
			},
		},
		damageRecap: {
			name: 'Damage Recap',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: [
						{ id: 'selectLatest', label: 'Select Latest' },
						{ id: 'deselect', label: 'Deselect' },
					],
					default: 'selectLatest',
				},
			],
			callback: async (event) => {
				try {
					const result =
						event.options.mode === 'deselect'
							? await self.commands.damageDeselect()
							: await self.commands.damageSelectLatest()
					self.handleCommandResult('damageRecap', result)
				} catch (err) {
					self.handleCommandError('damageRecap', err)
				}
			},
		},
		objectiveRecap: {
			name: 'Objective Recap',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: [
						{ id: 'selectLatest', label: 'Select Latest' },
						{ id: 'deselect', label: 'Deselect' },
					],
					default: 'selectLatest',
				},
				{
					id: 'dps',
					type: 'checkbox',
					label: 'DPS View',
					default: false,
					isVisible: (options) => options.mode === 'selectLatest',
				},
			],
			callback: async (event) => {
				try {
					const result =
						event.options.mode === 'deselect'
							? await self.commands.objectiveDeselect()
							: await self.commands.objectiveSelectLatest(Boolean(event.options.dps))
					self.handleCommandResult('objectiveRecap', result)
				} catch (err) {
					self.handleCommandError('objectiveRecap', err)
				}
			},
		},
		teamfightTrack: {
			name: 'Teamfight Tracking',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: [
						{ id: 'start', label: 'Start' },
						{ id: 'stop', label: 'Stop' },
					],
					default: 'start',
				},
			],
			callback: async (event) => {
				try {
					const result =
						event.options.mode === 'stop' ? await self.commands.teamfightStop() : await self.commands.teamfightStart()
					self.handleCommandResult('teamfightTrack', result)
				} catch (err) {
					self.handleCommandError('teamfightTrack', err)
				}
			},
		},
		teamfightOverlay: {
			name: 'Teamfight Overlay',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: 'Mode',
					choices: [
						{ id: 'selectLatest', label: 'Select Latest' },
						{ id: 'deselect', label: 'Deselect' },
					],
					default: 'selectLatest',
				},
			],
			callback: async (event) => {
				try {
					const result =
						event.options.mode === 'deselect'
							? await self.commands.teamfightDeselect()
							: await self.commands.teamfightSelectLatest()
					self.handleCommandResult('teamfightOverlay', result)
				} catch (err) {
					self.handleCommandError('teamfightOverlay', err)
				}
			},
		},
		championDetailPin: {
			name: 'Champion Detail: Pin Player',
			options: [
				{
					id: 'playerIndex',
					type: 'dropdown',
					label: 'Player',
					choices: PLAYER_INDEX_CHOICES,
					default: 0,
				},
			],
			callback: async (event) => {
				try {
					const result = await self.commands.championDetailPin(Number(event.options.playerIndex ?? 0))
					self.handleCommandResult('championDetailPin', result)
				} catch (err) {
					self.handleCommandError('championDetailPin', err)
				}
			},
		},
		postgameShow: {
			name: 'Post-Game: Show Configured Button',
			options: [
				{
					id: 'postgameId',
					type: 'dropdown',
					label: 'Postgame Button',
					choices: getPostgameButtonChoices(self.state),
					default: -1,
				},
			],
			callback: async (event) => {
				const postgameId = Number(event.options.postgameId ?? -1)
				if (postgameId < 0) {
					self.log('warn', 'postgameShow: no postgame button selected')
					return
				}
				try {
					const result = await self.commands.postgameShow(postgameId)
					self.handleCommandResult('postgameShow', result)
				} catch (err) {
					self.handleCommandError('postgameShow', err)
				}
			},
		},
		postgameShowComponent: {
			name: 'Post-Game: Show Component',
			options: [
				{
					id: 'componentType',
					type: 'dropdown',
					label: 'Component',
					choices: POSTGAME_COMPONENT_CHOICES,
					default: 'postgame-game',
				},
				{
					id: 'scope',
					type: 'dropdown',
					label: 'Scope',
					choices: [
						{ id: 'current', label: 'Current Game' },
						{ id: 'team', label: 'Team' },
						{ id: 'player', label: 'Player' },
					],
					default: 'current',
				},
				{
					id: 'teamSide',
					type: 'dropdown',
					label: 'Team',
					choices: TEAM_SIDE_CHOICES,
					default: 0,
					isVisible: (options) => options.scope === 'team',
				},
				{
					id: 'playerIndex',
					type: 'dropdown',
					label: 'Player',
					choices: PLAYER_INDEX_CHOICES,
					default: 0,
					isVisible: (options) => options.scope === 'player',
				},
			],
			callback: async (event) => {
				const componentType = String(event.options.componentType ?? '')
				const scope = String(event.options.scope ?? 'current') as PostgameScope
				try {
					await self.rest.postgameShowComponent(
						componentType,
						scope,
						Number(event.options.teamSide ?? 0),
						Number(event.options.playerIndex ?? 0),
					)
				} catch (err) {
					self.handleRestError('postgameShowComponent', err)
				}
			},
		},
		postgameClear: {
			name: 'Post-Game: Clear Component',
			options: [],
			callback: async () => {
				try {
					await self.rest.postgameClear()
				} catch (err) {
					self.handleRestError('postgameClear', err)
				}
			},
		},
		mockSet: {
			name: 'Mock Data: Set',
			options: [
				{
					id: 'phase',
					type: 'dropdown',
					label: 'Phase',
					choices: MOCK_PHASE_CHOICES,
					default: 'ingame',
				},
				{
					id: 'enabled',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'On' },
						{ id: 'off', label: 'Off' },
					],
					default: 'on',
				},
			],
			callback: async (event) => {
				const phase = String(event.options.phase ?? 'ingame') as MockPhase
				try {
					await self.rest.setMock(phase, event.options.enabled === 'on')
				} catch (err) {
					self.handleRestError('mockSet', err)
				}
			},
		},
		setBestOf: {
			name: 'Series: Set Best-Of',
			options: [
				{
					id: 'bestOf',
					type: 'dropdown',
					label: 'Best Of',
					choices: [
						{ id: 1, label: 'Best of 1' },
						{ id: 3, label: 'Best of 3' },
						{ id: 5, label: 'Best of 5' },
					],
					default: 3,
				},
			],
			callback: async (event) => {
				try {
					await self.rest.setBestOf(Number(event.options.bestOf ?? 3))
				} catch (err) {
					self.handleRestError('setBestOf', err)
				}
			},
		},
		swapSides: {
			name: 'Series: Swap Sides',
			options: [
				{
					id: 'seriesId',
					type: 'textinput',
					label: 'Series ID',
					tooltip: 'The series to swap sides for (supports variables)',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const seriesId = (await context.parseVariablesInString(String(event.options.seriesId ?? ''))).trim()
				if (!seriesId) {
					self.log('warn', 'swapSides: no series ID provided')
					return
				}
				try {
					await self.rest.swapSides(seriesId)
				} catch (err) {
					self.handleRestError('swapSides', err)
				}
			},
		},
		cinematicArm: {
			name: 'Cinematic: Arm',
			options: [
				{
					id: 'cinematicId',
					type: 'textinput',
					label: 'Cinematic ID',
					tooltip: 'The cinematic to arm — loaded and paused at its start, ready for Go (supports variables)',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const id = (await context.parseVariablesInString(String(event.options.cinematicId ?? ''))).trim()
				if (!id) {
					self.log('warn', 'cinematicArm: no cinematic ID provided')
					return
				}
				try {
					await self.commands.cinematicArm(id)
				} catch (err) {
					self.handleCommandError('cinematicArm', err)
				}
			},
		},
		cinematicGo: {
			name: 'Cinematic: Go',
			options: [],
			callback: async () => {
				try {
					await self.commands.cinematicGo()
				} catch (err) {
					self.handleCommandError('cinematicGo', err)
				}
			},
		},
		cinematicStop: {
			name: 'Cinematic: Stop',
			options: [],
			callback: async () => {
				try {
					await self.commands.cinematicStop()
				} catch (err) {
					self.handleCommandError('cinematicStop', err)
				}
			},
		},
		cinematicPlay: {
			name: 'Cinematic: Play',
			options: [
				{
					id: 'cinematicId',
					type: 'textinput',
					label: 'Cinematic ID',
					tooltip: 'The cinematic to play immediately (Arm + Go in one step; supports variables)',
					default: '',
					useVariables: true,
				},
			],
			callback: async (event, context) => {
				const id = (await context.parseVariablesInString(String(event.options.cinematicId ?? ''))).trim()
				if (!id) {
					self.log('warn', 'cinematicPlay: no cinematic ID provided')
					return
				}
				try {
					await self.commands.cinematicPlay(id)
				} catch (err) {
					self.handleCommandError('cinematicPlay', err)
				}
			},
		},
		hotkeysSet: {
			name: 'Keyboard Hotkeys: Set',
			options: [
				{
					id: 'enabled',
					type: 'dropdown',
					label: 'State',
					choices: [
						{ id: 'on', label: 'On' },
						{ id: 'off', label: 'Off' },
					],
					default: 'off',
				},
			],
			callback: async (event) => {
				try {
					await self.rest.setHotkeysEnabled(event.options.enabled === 'on')
				} catch (err) {
					self.handleRestError('hotkeysSet', err)
				}
			},
		},
	})
}
