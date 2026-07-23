// @ts-nocheck — vendored verbatim; exempt from this project's tsc strictness (noUnusedLocals/noUnusedParameters).
// Vendored from the LeagueBroadcast repository — DO NOT HAND-EDIT; re-vendor from source.
// Source: web/shared/src/rpc/generated/caster-mode-rpc.ts (auto-generated from the C# RPC interfaces)
// Repo:   BlueBottleGG/LeagueBroadcast
// Vendored: 2026-07-23
// Local change: '@bluebottle/rpc' imports rewritten to '../bluebottle-rpc/index.js'.
// Auto-generated RPC client for caster_mode
// DO NOT EDIT — regenerate from C# interface ICasterModeRpc

import { RpcClient, FlatBufferReader, FlatBufferWriter } from '../bluebottle-rpc/index.js';
import type { RpcSubscription } from '../bluebottle-rpc/index.js';

export interface CasterActiveOverlayDto {
  overlayName: string;
  buttonId: string;
  timePeriod: number;
  team: number;
  players: CasterPlayerPickDto[];
}

export interface CasterActiveOverlaysDto {
  overlays: (string | null)[];
}

export interface CasterButtonDto {
  buttonId: string;
  name: string;
  overlayName: string;
  backgroundColor: string;
  hasSettings: boolean;
  allowSinglePlayers: boolean;
  allowTimePeriod: boolean;
  available: boolean;
  pageId: string;
  position: number;
  label: string;
  actionType: string;
  targetPageId: string;
  allowTeams: boolean;
}

export interface CasterCommandDto {
  roomName: string;
  commandId: string;
  senderMemberId: string;
  senderName: string;
  commandType: string;
  buttonId: string;
  postgameId: number;
  show: boolean;
  timePeriod: number;
  team: number;
  players: CasterPlayerPickDto[];
  playerIndex: number;
  displayMode: number;
  dps: boolean;
  pageId: string;
  clearTargeting: boolean;
}

export interface CasterCommandResultDto {
  ok: boolean;
  error: string;
  entryJson: string;
}

export interface CasterModeConfigJsonDto {
  json: string;
}

export interface CasterPageStateDto {
  pageId: string;
  name: string;
  order: number;
}

export interface CasterPanelStateDto {
  roomName: string;
  revision: bigint;
  sessionActive: boolean;
  gamePhase: number;
  gameName: string;
  blueTeamName: string;
  redTeamName: string;
  ingameButtons: CasterButtonDto[];
  postgameButtons: CasterPostgameButtonDto[];
  activeOverlays: CasterActiveOverlayDto[];
  disabledOverlays: (string | null)[];
  roster: CasterRosterEntryDto[];
  pages: CasterPageStateDto[];
  activePageId: string;
  rosterHidden: boolean;
  eventFeedHidden: boolean;
  teamfightHidden: boolean;
  postgameHidden: boolean;
}

export interface CasterPlayerPickDto {
  team: number;
  role: number;
}

export interface CasterPostgameButtonDto {
  id: number;
  name: string;
  componentName: string;
  backgroundColor: string;
  allowPlayers: boolean;
  allowTeams: boolean;
  requiresCompletedGame: boolean;
  available: boolean;
}

export interface CasterRosterEntryDto {
  playerIndex: number;
  summonerName: string;
  championName: string;
  team: number;
}

function decodeCasterActiveOverlayDto(r: FlatBufferReader): CasterActiveOverlayDto {
  return {
    overlayName: r.readString(0) ?? '',
    buttonId: r.readString(1) ?? '',
    timePeriod: r.readInt(2),
    team: r.readInt(3),
    players: r.readTableVector(4, decodeCasterPlayerPickDto) ?? [],
  };
}

function decodeCasterActiveOverlaysDto(r: FlatBufferReader): CasterActiveOverlaysDto {
  return {
    overlays: r.readStringVector(0) ?? [],
  };
}

function decodeCasterButtonDto(r: FlatBufferReader): CasterButtonDto {
  return {
    buttonId: r.readString(0) ?? '',
    name: r.readString(1) ?? '',
    overlayName: r.readString(2) ?? '',
    backgroundColor: r.readString(3) ?? '',
    hasSettings: r.readBool(4),
    allowSinglePlayers: r.readBool(5),
    allowTimePeriod: r.readBool(6),
    available: r.readBool(7),
    pageId: r.readString(8) ?? '',
    position: r.readInt(9),
    label: r.readString(10) ?? '',
    actionType: r.readString(11) ?? '',
    targetPageId: r.readString(12) ?? '',
    allowTeams: r.readBool(13),
  };
}

function decodeCasterCommandDto(r: FlatBufferReader): CasterCommandDto {
  return {
    roomName: r.readString(0) ?? '',
    commandId: r.readString(1) ?? '',
    senderMemberId: r.readString(2) ?? '',
    senderName: r.readString(3) ?? '',
    commandType: r.readString(4) ?? '',
    buttonId: r.readString(5) ?? '',
    postgameId: r.readInt(6),
    show: r.readBool(7),
    timePeriod: r.readInt(8),
    team: r.readInt(9),
    players: r.readTableVector(10, decodeCasterPlayerPickDto) ?? [],
    playerIndex: r.readInt(11),
    displayMode: r.readInt(12),
    dps: r.readBool(13),
    pageId: r.readString(14) ?? '',
    clearTargeting: r.readBool(15),
  };
}

function decodeCasterCommandResultDto(r: FlatBufferReader): CasterCommandResultDto {
  return {
    ok: r.readBool(0),
    error: r.readString(1) ?? '',
    entryJson: r.readString(2) ?? '',
  };
}

function decodeCasterModeConfigJsonDto(r: FlatBufferReader): CasterModeConfigJsonDto {
  return {
    json: r.readString(0) ?? '',
  };
}

function decodeCasterPageStateDto(r: FlatBufferReader): CasterPageStateDto {
  return {
    pageId: r.readString(0) ?? '',
    name: r.readString(1) ?? '',
    order: r.readInt(2),
  };
}

function decodeCasterPanelStateDto(r: FlatBufferReader): CasterPanelStateDto {
  return {
    roomName: r.readString(0) ?? '',
    revision: r.readLong(1),
    sessionActive: r.readBool(2),
    gamePhase: r.readInt(3),
    gameName: r.readString(4) ?? '',
    blueTeamName: r.readString(5) ?? '',
    redTeamName: r.readString(6) ?? '',
    ingameButtons: r.readTableVector(7, decodeCasterButtonDto) ?? [],
    postgameButtons: r.readTableVector(8, decodeCasterPostgameButtonDto) ?? [],
    activeOverlays: r.readTableVector(9, decodeCasterActiveOverlayDto) ?? [],
    disabledOverlays: r.readStringVector(10) ?? [],
    roster: r.readTableVector(11, decodeCasterRosterEntryDto) ?? [],
    pages: r.readTableVector(12, decodeCasterPageStateDto) ?? [],
    activePageId: r.readString(13) ?? '',
    rosterHidden: r.readBool(14),
    eventFeedHidden: r.readBool(15),
    teamfightHidden: r.readBool(16),
    postgameHidden: r.readBool(17),
  };
}

function decodeCasterPlayerPickDto(r: FlatBufferReader): CasterPlayerPickDto {
  return {
    team: r.readInt(0),
    role: r.readInt(1),
  };
}

function decodeCasterPostgameButtonDto(r: FlatBufferReader): CasterPostgameButtonDto {
  return {
    id: r.readInt(0),
    name: r.readString(1) ?? '',
    componentName: r.readString(2) ?? '',
    backgroundColor: r.readString(3) ?? '',
    allowPlayers: r.readBool(4),
    allowTeams: r.readBool(5),
    requiresCompletedGame: r.readBool(6),
    available: r.readBool(7),
  };
}

function decodeCasterRosterEntryDto(r: FlatBufferReader): CasterRosterEntryDto {
  return {
    playerIndex: r.readInt(0),
    summonerName: r.readString(1) ?? '',
    championName: r.readString(2) ?? '',
    team: r.readInt(3),
  };
}

function buildCasterActiveOverlayDto_Args(v: CasterActiveOverlayDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.overlayName);
  writer.writeString(1, v.buttonId);
  writer.writeInt(2, v.timePeriod);
  writer.writeInt(3, v.team);
  writer.writeTableVector(4, v.players.map((e: any) => buildCasterPlayerPickDto_Args(e)));
  return writer.finish(5);
}

function buildCasterActiveOverlaysDto_Args(v: CasterActiveOverlaysDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeStringVector(0, v.overlays);
  return writer.finish(1);
}

function buildCasterButtonDto_Args(v: CasterButtonDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.buttonId);
  writer.writeString(1, v.name);
  writer.writeString(2, v.overlayName);
  writer.writeString(3, v.backgroundColor);
  writer.writeBool(4, v.hasSettings);
  writer.writeBool(5, v.allowSinglePlayers);
  writer.writeBool(6, v.allowTimePeriod);
  writer.writeBool(7, v.available);
  writer.writeString(8, v.pageId);
  writer.writeInt(9, v.position);
  writer.writeString(10, v.label);
  writer.writeString(11, v.actionType);
  writer.writeString(12, v.targetPageId);
  writer.writeBool(13, v.allowTeams);
  return writer.finish(14);
}

function buildCasterCommandDto_Args(v: CasterCommandDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.roomName);
  writer.writeString(1, v.commandId);
  writer.writeString(2, v.senderMemberId);
  writer.writeString(3, v.senderName);
  writer.writeString(4, v.commandType);
  writer.writeString(5, v.buttonId);
  writer.writeInt(6, v.postgameId);
  writer.writeBool(7, v.show);
  writer.writeInt(8, v.timePeriod);
  writer.writeInt(9, v.team);
  writer.writeTableVector(10, v.players.map((e: any) => buildCasterPlayerPickDto_Args(e)));
  writer.writeInt(11, v.playerIndex);
  writer.writeInt(12, v.displayMode);
  writer.writeBool(13, v.dps);
  writer.writeString(14, v.pageId);
  writer.writeBool(15, v.clearTargeting);
  return writer.finish(16);
}

function buildCasterCommandResultDto_Args(v: CasterCommandResultDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeBool(0, v.ok);
  writer.writeString(1, v.error);
  writer.writeString(2, v.entryJson);
  return writer.finish(3);
}

function buildCasterModeConfigJsonDto_Args(v: CasterModeConfigJsonDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.json);
  return writer.finish(1);
}

function buildCasterPageStateDto_Args(v: CasterPageStateDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.pageId);
  writer.writeString(1, v.name);
  writer.writeInt(2, v.order);
  return writer.finish(3);
}

function buildCasterPanelStateDto_Args(v: CasterPanelStateDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.roomName);
  writer.writeLong(1, v.revision);
  writer.writeBool(2, v.sessionActive);
  writer.writeInt(3, v.gamePhase);
  writer.writeString(4, v.gameName);
  writer.writeString(5, v.blueTeamName);
  writer.writeString(6, v.redTeamName);
  writer.writeTableVector(7, v.ingameButtons.map((e: any) => buildCasterButtonDto_Args(e)));
  writer.writeTableVector(8, v.postgameButtons.map((e: any) => buildCasterPostgameButtonDto_Args(e)));
  writer.writeTableVector(9, v.activeOverlays.map((e: any) => buildCasterActiveOverlayDto_Args(e)));
  writer.writeStringVector(10, v.disabledOverlays);
  writer.writeTableVector(11, v.roster.map((e: any) => buildCasterRosterEntryDto_Args(e)));
  writer.writeTableVector(12, v.pages.map((e: any) => buildCasterPageStateDto_Args(e)));
  writer.writeString(13, v.activePageId);
  writer.writeBool(14, v.rosterHidden);
  writer.writeBool(15, v.eventFeedHidden);
  writer.writeBool(16, v.teamfightHidden);
  writer.writeBool(17, v.postgameHidden);
  return writer.finish(18);
}

function buildCasterPlayerPickDto_Args(v: CasterPlayerPickDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeInt(0, v.team);
  writer.writeInt(1, v.role);
  return writer.finish(2);
}

function buildCasterPostgameButtonDto_Args(v: CasterPostgameButtonDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeInt(0, v.id);
  writer.writeString(1, v.name);
  writer.writeString(2, v.componentName);
  writer.writeString(3, v.backgroundColor);
  writer.writeBool(4, v.allowPlayers);
  writer.writeBool(5, v.allowTeams);
  writer.writeBool(6, v.requiresCompletedGame);
  writer.writeBool(7, v.available);
  return writer.finish(8);
}

function buildCasterRosterEntryDto_Args(v: CasterRosterEntryDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeInt(0, v.playerIndex);
  writer.writeString(1, v.summonerName);
  writer.writeString(2, v.championName);
  writer.writeInt(3, v.team);
  return writer.finish(4);
}

export interface SetConfigParams {
  update: CasterModeConfigJsonDto;
}

export interface ExecuteParams {
  cmd: CasterCommandDto;
}

function buildSetConfig_Args(v: SetConfigParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeTable(0, buildCasterModeConfigJsonDto_Args(v.update));
  return writer.finish(1);
}

function buildExecute_Args(v: ExecuteParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeTable(0, buildCasterCommandDto_Args(v.cmd));
  return writer.finish(1);
}

export interface Caster_modeRpc {
  getConfig(): Promise<CasterModeConfigJsonDto>;
  setConfig(update: CasterModeConfigJsonDto): Promise<void>;
  getActiveOverlays(): Promise<CasterActiveOverlaysDto>;
  execute(cmd: CasterCommandDto): Promise<CasterCommandResultDto>;
  subscribeLocalPanelState(): Promise<RpcSubscription<CasterPanelStateDto>>;
}

export function createCaster_modeRpc(client: RpcClient): Caster_modeRpc {
  return {
    getConfig() {
      return client.rpc('caster_mode.get_config', {  }, undefined, (data) => decodeCasterModeConfigJsonDto(new FlatBufferReader(data)));
    },
    setConfig(update) {
      return client.rpc('caster_mode.set_config', { update }, buildSetConfig_Args);
    },
    getActiveOverlays() {
      return client.rpc('caster_mode.get_active_overlays', {  }, undefined, (data) => decodeCasterActiveOverlaysDto(new FlatBufferReader(data)));
    },
    execute(cmd) {
      return client.rpc('caster_mode.execute', { cmd }, buildExecute_Args, (data) => decodeCasterCommandResultDto(new FlatBufferReader(data)));
    },
    subscribeLocalPanelState() {
      return client.subscribe('caster_mode.subscribe_local_panel_state', {  }, undefined, (data) => decodeCasterPanelStateDto(new FlatBufferReader(data)));
    },
  };
}
