/**
 * DTO types of the LeagueBroadcast RPC surface.
 *
 * Re-exported from the vendored generated stubs (src/vendor/generated/) so the
 * module's types can never drift from the app's RPC schema — re-vendoring the
 * stubs updates these too. Only `CasterCommandType` is defined here: the set of
 * command strings accepted by `caster_mode.Execute` is app behavior, not part
 * of the generated schema.
 */

export type {
	CasterActiveOverlayDto,
	CasterButtonDto,
	CasterCommandDto,
	CasterCommandResultDto,
	CasterPageStateDto,
	CasterPanelStateDto,
	CasterPlayerPickDto,
	CasterPostgameButtonDto,
	CasterRosterEntryDto,
} from '../vendor/generated/caster-mode-rpc.js'

/** The command types accepted by `caster_mode.Execute` (CasterCommandDto.commandType). */
export type CasterCommandType =
	| 'toggle-overlay'
	| 'deactivate-all'
	| 'postgame-show'
	| 'champion-detail-pin'
	| 'damage-select-latest'
	| 'damage-deselect'
	| 'objective-select-latest'
	| 'objective-deselect'
	| 'teamfight-select-latest'
	| 'teamfight-start'
	| 'teamfight-stop'
	| 'teamfight-deselect'
	| 'page-switch'
