// @ts-nocheck — vendored verbatim; exempt from this project's tsc strictness (noUnusedLocals/noUnusedParameters).
// Vendored from the LeagueBroadcast repository — DO NOT HAND-EDIT; re-vendor from source.
// Source: web/shared/src/rpc/generated/cinematics-rpc.ts (auto-generated from the C# RPC interfaces)
// Repo:   BlueBottleGG/LeagueBroadcast
// Vendored: 2026-07-23
// Local change: '@bluebottle/rpc' imports rewritten to '../bluebottle-rpc/index.js'.
// Auto-generated RPC client for cinematics
// DO NOT EDIT — regenerate from C# interface ICinematicsRpc

import { RpcClient, FlatBufferReader, FlatBufferWriter } from '../bluebottle-rpc/index.js';
import type { RpcSubscription } from '../bluebottle-rpc/index.js';

/** Opaque FlatBuffer type — raw bytes from the server. Use domain-specific deserializer. */
export type Cinematic = Uint8Array;

/** Opaque FlatBuffer type — raw bytes from the server. Use domain-specific deserializer. */
export type CinematicList = Uint8Array;

/** Opaque FlatBuffer type — raw bytes from the server. Use domain-specific deserializer. */
export type CinematicPlayback = Uint8Array;

/** Opaque FlatBuffer type — raw bytes from the server. Use domain-specific deserializer. */
export type CinematicProp = Uint8Array;

export interface CameraRenderSnapshotDto {
  cameraPositionX: number;
  cameraPositionY: number;
  cameraPositionZ: number;
  cameraRotationX: number;
  cameraRotationY: number;
  cameraRotationZ: number;
  fieldOfView: number;
  nearClip: number;
  farClip: number;
  playbackTime: number;
}

export interface CameraSequenceDetailDto {
  name: string;
  sequenceJson: string;
  startTime: number;
  endTime: number;
  duration: number;
  skyboxRotation: number;
  skyboxOffset: number;
  tracks: CameraSequenceTrackSummaryDto[];
}

export interface CameraSequenceListDto {
  sequences: CameraSequenceSummaryDto[];
  currentSequence: string;
}

export interface CameraSequenceSummaryDto {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  skyboxRotation: number;
  skyboxOffset: number;
  tracks: CameraSequenceTrackSummaryDto[];
}

export interface CameraSequenceTrackSummaryDto {
  name: string;
  displayName: string;
  valueType: string;
  keyTimes: number[];
}

export interface CinematicFontListDto {
  fonts: (string | null)[];
}

export interface CinematicPlaybackSettingsDto {
  autoStopOnComplete: boolean;
}

function decodeCameraRenderSnapshotDto(r: FlatBufferReader): CameraRenderSnapshotDto {
  return {
    cameraPositionX: r.readFloat(0),
    cameraPositionY: r.readFloat(1),
    cameraPositionZ: r.readFloat(2),
    cameraRotationX: r.readFloat(3),
    cameraRotationY: r.readFloat(4),
    cameraRotationZ: r.readFloat(5),
    fieldOfView: r.readFloat(6),
    nearClip: r.readFloat(7),
    farClip: r.readFloat(8),
    playbackTime: r.readFloat(9),
  };
}

function decodeCameraSequenceDetailDto(r: FlatBufferReader): CameraSequenceDetailDto {
  return {
    name: r.readString(0) ?? '',
    sequenceJson: r.readString(1) ?? '',
    startTime: r.readFloat(2),
    endTime: r.readFloat(3),
    duration: r.readFloat(4),
    skyboxRotation: r.readFloat(5),
    skyboxOffset: r.readFloat(6),
    tracks: r.readTableVector(7, decodeCameraSequenceTrackSummaryDto) ?? [],
  };
}

function decodeCameraSequenceListDto(r: FlatBufferReader): CameraSequenceListDto {
  return {
    sequences: r.readTableVector(0, decodeCameraSequenceSummaryDto) ?? [],
    currentSequence: r.readString(1) ?? '',
  };
}

function decodeCameraSequenceSummaryDto(r: FlatBufferReader): CameraSequenceSummaryDto {
  return {
    name: r.readString(0) ?? '',
    startTime: r.readFloat(1),
    endTime: r.readFloat(2),
    duration: r.readFloat(3),
    skyboxRotation: r.readFloat(4),
    skyboxOffset: r.readFloat(5),
    tracks: r.readTableVector(6, decodeCameraSequenceTrackSummaryDto) ?? [],
  };
}

function decodeCameraSequenceTrackSummaryDto(r: FlatBufferReader): CameraSequenceTrackSummaryDto {
  return {
    name: r.readString(0) ?? '',
    displayName: r.readString(1) ?? '',
    valueType: r.readString(2) ?? '',
    keyTimes: r.readFloatVector(3) ?? [],
  };
}

function decodeCinematicFontListDto(r: FlatBufferReader): CinematicFontListDto {
  return {
    fonts: r.readStringVector(0) ?? [],
  };
}

function decodeCinematicPlaybackSettingsDto(r: FlatBufferReader): CinematicPlaybackSettingsDto {
  return {
    autoStopOnComplete: r.readBool(0),
  };
}

function buildCameraRenderSnapshotDto_Args(v: CameraRenderSnapshotDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeFloat(0, v.cameraPositionX);
  writer.writeFloat(1, v.cameraPositionY);
  writer.writeFloat(2, v.cameraPositionZ);
  writer.writeFloat(3, v.cameraRotationX);
  writer.writeFloat(4, v.cameraRotationY);
  writer.writeFloat(5, v.cameraRotationZ);
  writer.writeFloat(6, v.fieldOfView);
  writer.writeFloat(7, v.nearClip);
  writer.writeFloat(8, v.farClip);
  writer.writeFloat(9, v.playbackTime);
  return writer.finish(10);
}

function buildCameraSequenceDetailDto_Args(v: CameraSequenceDetailDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  writer.writeString(1, v.sequenceJson);
  writer.writeFloat(2, v.startTime);
  writer.writeFloat(3, v.endTime);
  writer.writeFloat(4, v.duration);
  writer.writeFloat(5, v.skyboxRotation);
  writer.writeFloat(6, v.skyboxOffset);
  writer.writeTableVector(7, v.tracks.map((e: any) => buildCameraSequenceTrackSummaryDto_Args(e)));
  return writer.finish(8);
}

function buildCameraSequenceListDto_Args(v: CameraSequenceListDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeTableVector(0, v.sequences.map((e: any) => buildCameraSequenceSummaryDto_Args(e)));
  writer.writeString(1, v.currentSequence);
  return writer.finish(2);
}

function buildCameraSequenceSummaryDto_Args(v: CameraSequenceSummaryDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  writer.writeFloat(1, v.startTime);
  writer.writeFloat(2, v.endTime);
  writer.writeFloat(3, v.duration);
  writer.writeFloat(4, v.skyboxRotation);
  writer.writeFloat(5, v.skyboxOffset);
  writer.writeTableVector(6, v.tracks.map((e: any) => buildCameraSequenceTrackSummaryDto_Args(e)));
  return writer.finish(7);
}

function buildCameraSequenceTrackSummaryDto_Args(v: CameraSequenceTrackSummaryDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  writer.writeString(1, v.displayName);
  writer.writeString(2, v.valueType);
  writer.writeFloatVector(3, v.keyTimes);
  return writer.finish(4);
}

function buildCinematicFontListDto_Args(v: CinematicFontListDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeStringVector(0, v.fonts);
  return writer.finish(1);
}

function buildCinematicPlaybackSettingsDto_Args(v: CinematicPlaybackSettingsDto): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeBool(0, v.autoStopOnComplete);
  return writer.finish(1);
}

export interface GetCinematicParams {
  id: string;
}

export interface CreateCinematicParams {
  name: string;
}

export interface DuplicateCinematicParams {
  sourceId: string;
  targetName: string;
}

export interface DeleteCinematicParams {
  id: string;
}

export interface AddBoundTextParams {
  requestB64: string;
}

export interface AddLogoBillboardParams {
  requestB64: string;
}

export interface RemovePropParams {
  id: string;
  propId: string;
}

export interface SetTrackParams {
  requestB64: string;
}

export interface SetPropStyleParams {
  requestB64: string;
}

export interface SetCameraSequenceParams {
  id: string;
  sequenceName: string;
}

export interface GetSequenceParams {
  name: string;
}

export interface CreateSequenceParams {
  name: string;
}

export interface ImportSequenceParams {
  name: string;
  sequenceJson: string;
  skyboxRotation: number;
  skyboxOffset: number;
}

export interface DuplicateSequenceParams {
  sourceName: string;
  targetName: string;
}

export interface SaveSequenceParams {
  name: string;
  sequenceJson: string;
  skyboxRotation: number;
  skyboxOffset: number;
  applyIfActive: boolean;
}

export interface RenameSequenceParams {
  oldName: string;
  newName: string;
}

export interface DeleteSequenceParams {
  name: string;
}

export interface PreviewSequenceDraftParams {
  sequenceJson: string;
  skyboxRotation: number;
  skyboxOffset: number;
  preservePlaybackTime: boolean;
}

export interface SetSequenceAppliedParams {
  applied: boolean;
}

export interface ArmParams {
  id: string;
}

export interface PlayParams {
  id: string;
}

export interface PlayRelativeParams {
  id: string;
}

export interface SeekParams {
  time: number;
}

export interface SetAutoStopOnCompleteParams {
  enabled: boolean;
}

function buildGetCinematic_Args(v: GetCinematicParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.id);
  return writer.finish(1);
}

function buildCreateCinematic_Args(v: CreateCinematicParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  return writer.finish(1);
}

function buildDuplicateCinematic_Args(v: DuplicateCinematicParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.sourceId);
  writer.writeString(1, v.targetName);
  return writer.finish(2);
}

function buildDeleteCinematic_Args(v: DeleteCinematicParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.id);
  return writer.finish(1);
}

function buildAddBoundText_Args(v: AddBoundTextParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.requestB64);
  return writer.finish(1);
}

function buildAddLogoBillboard_Args(v: AddLogoBillboardParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.requestB64);
  return writer.finish(1);
}

function buildRemoveProp_Args(v: RemovePropParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.id);
  writer.writeString(1, v.propId);
  return writer.finish(2);
}

function buildSetTrack_Args(v: SetTrackParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.requestB64);
  return writer.finish(1);
}

function buildSetPropStyle_Args(v: SetPropStyleParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.requestB64);
  return writer.finish(1);
}

function buildSetCameraSequence_Args(v: SetCameraSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.id);
  writer.writeString(1, v.sequenceName);
  return writer.finish(2);
}

function buildGetSequence_Args(v: GetSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  return writer.finish(1);
}

function buildCreateSequence_Args(v: CreateSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  return writer.finish(1);
}

function buildImportSequence_Args(v: ImportSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  writer.writeString(1, v.sequenceJson);
  writer.writeFloat(2, v.skyboxRotation);
  writer.writeFloat(3, v.skyboxOffset);
  return writer.finish(4);
}

function buildDuplicateSequence_Args(v: DuplicateSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.sourceName);
  writer.writeString(1, v.targetName);
  return writer.finish(2);
}

function buildSaveSequence_Args(v: SaveSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  writer.writeString(1, v.sequenceJson);
  writer.writeFloat(2, v.skyboxRotation);
  writer.writeFloat(3, v.skyboxOffset);
  writer.writeBool(4, v.applyIfActive);
  return writer.finish(5);
}

function buildRenameSequence_Args(v: RenameSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.oldName);
  writer.writeString(1, v.newName);
  return writer.finish(2);
}

function buildDeleteSequence_Args(v: DeleteSequenceParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.name);
  return writer.finish(1);
}

function buildPreviewSequenceDraft_Args(v: PreviewSequenceDraftParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.sequenceJson);
  writer.writeFloat(1, v.skyboxRotation);
  writer.writeFloat(2, v.skyboxOffset);
  writer.writeBool(3, v.preservePlaybackTime);
  return writer.finish(4);
}

function buildSetSequenceApplied_Args(v: SetSequenceAppliedParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeBool(0, v.applied);
  return writer.finish(1);
}

function buildArm_Args(v: ArmParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.id);
  return writer.finish(1);
}

function buildPlay_Args(v: PlayParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.id);
  return writer.finish(1);
}

function buildPlayRelative_Args(v: PlayRelativeParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.id);
  return writer.finish(1);
}

function buildSeek_Args(v: SeekParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeFloat(0, v.time);
  return writer.finish(1);
}

function buildSetAutoStopOnComplete_Args(v: SetAutoStopOnCompleteParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeBool(0, v.enabled);
  return writer.finish(1);
}

export interface CinematicsRpc {
  listCinematics(): Promise<CinematicList>;
  getCinematic(id: string): Promise<Cinematic>;
  createCinematic(name: string): Promise<Cinematic>;
  duplicateCinematic(sourceId: string, targetName: string): Promise<Cinematic>;
  deleteCinematic(id: string): Promise<void>;
  addBoundText(requestB64: string): Promise<CinematicProp>;
  addLogoBillboard(requestB64: string): Promise<CinematicProp>;
  removeProp(id: string, propId: string): Promise<void>;
  setTrack(requestB64: string): Promise<void>;
  setPropStyle(requestB64: string): Promise<void>;
  listFonts(): Promise<CinematicFontListDto>;
  setCameraSequence(id: string, sequenceName: string): Promise<void>;
  listSequences(): Promise<CameraSequenceListDto>;
  getSequence(name: string): Promise<CameraSequenceDetailDto>;
  createSequence(name: string): Promise<CameraSequenceDetailDto>;
  importSequence(name: string, sequenceJson: string, skyboxRotation: number, skyboxOffset: number): Promise<CameraSequenceDetailDto>;
  duplicateSequence(sourceName: string, targetName: string): Promise<CameraSequenceDetailDto>;
  saveSequence(name: string, sequenceJson: string, skyboxRotation: number, skyboxOffset: number, applyIfActive: boolean): Promise<CameraSequenceDetailDto>;
  renameSequence(oldName: string, newName: string): Promise<CameraSequenceDetailDto>;
  deleteSequence(name: string): Promise<void>;
  captureRenderState(): Promise<CameraRenderSnapshotDto>;
  previewSequenceDraft(sequenceJson: string, skyboxRotation: number, skyboxOffset: number, preservePlaybackTime: boolean): Promise<void>;
  setSequenceApplied(applied: boolean): Promise<void>;
  arm(id: string): Promise<void>;
  go(): Promise<void>;
  play(id: string): Promise<void>;
  playRelative(id: string): Promise<void>;
  stop(): Promise<void>;
  seek(time: number): Promise<void>;
  getPlaybackStatus(): Promise<CinematicPlayback>;
  getPlaybackSettings(): Promise<CinematicPlaybackSettingsDto>;
  setAutoStopOnComplete(enabled: boolean): Promise<void>;
  subscribePlayback(): Promise<RpcSubscription<CinematicPlayback>>;
}

export function createCinematicsRpc(client: RpcClient): CinematicsRpc {
  return {
    listCinematics() {
      return client.rpc('cinematics.list_cinematics', {  }, undefined);
    },
    getCinematic(id) {
      return client.rpc('cinematics.get_cinematic', { id }, buildGetCinematic_Args);
    },
    createCinematic(name) {
      return client.rpc('cinematics.create_cinematic', { name }, buildCreateCinematic_Args);
    },
    duplicateCinematic(sourceId, targetName) {
      return client.rpc('cinematics.duplicate_cinematic', { sourceId, targetName }, buildDuplicateCinematic_Args);
    },
    deleteCinematic(id) {
      return client.rpc('cinematics.delete_cinematic', { id }, buildDeleteCinematic_Args);
    },
    addBoundText(requestB64) {
      return client.rpc('cinematics.add_bound_text', { requestB64 }, buildAddBoundText_Args);
    },
    addLogoBillboard(requestB64) {
      return client.rpc('cinematics.add_logo_billboard', { requestB64 }, buildAddLogoBillboard_Args);
    },
    removeProp(id, propId) {
      return client.rpc('cinematics.remove_prop', { id, propId }, buildRemoveProp_Args);
    },
    setTrack(requestB64) {
      return client.rpc('cinematics.set_track', { requestB64 }, buildSetTrack_Args);
    },
    setPropStyle(requestB64) {
      return client.rpc('cinematics.set_prop_style', { requestB64 }, buildSetPropStyle_Args);
    },
    listFonts() {
      return client.rpc('cinematics.list_fonts', {  }, undefined, (data) => decodeCinematicFontListDto(new FlatBufferReader(data)));
    },
    setCameraSequence(id, sequenceName) {
      return client.rpc('cinematics.set_camera_sequence', { id, sequenceName }, buildSetCameraSequence_Args);
    },
    listSequences() {
      return client.rpc('cinematics.list_sequences', {  }, undefined, (data) => decodeCameraSequenceListDto(new FlatBufferReader(data)));
    },
    getSequence(name) {
      return client.rpc('cinematics.get_sequence', { name }, buildGetSequence_Args, (data) => decodeCameraSequenceDetailDto(new FlatBufferReader(data)));
    },
    createSequence(name) {
      return client.rpc('cinematics.create_sequence', { name }, buildCreateSequence_Args, (data) => decodeCameraSequenceDetailDto(new FlatBufferReader(data)));
    },
    importSequence(name, sequenceJson, skyboxRotation, skyboxOffset) {
      return client.rpc('cinematics.import_sequence', { name, sequenceJson, skyboxRotation, skyboxOffset }, buildImportSequence_Args, (data) => decodeCameraSequenceDetailDto(new FlatBufferReader(data)));
    },
    duplicateSequence(sourceName, targetName) {
      return client.rpc('cinematics.duplicate_sequence', { sourceName, targetName }, buildDuplicateSequence_Args, (data) => decodeCameraSequenceDetailDto(new FlatBufferReader(data)));
    },
    saveSequence(name, sequenceJson, skyboxRotation, skyboxOffset, applyIfActive) {
      return client.rpc('cinematics.save_sequence', { name, sequenceJson, skyboxRotation, skyboxOffset, applyIfActive }, buildSaveSequence_Args, (data) => decodeCameraSequenceDetailDto(new FlatBufferReader(data)));
    },
    renameSequence(oldName, newName) {
      return client.rpc('cinematics.rename_sequence', { oldName, newName }, buildRenameSequence_Args, (data) => decodeCameraSequenceDetailDto(new FlatBufferReader(data)));
    },
    deleteSequence(name) {
      return client.rpc('cinematics.delete_sequence', { name }, buildDeleteSequence_Args);
    },
    captureRenderState() {
      return client.rpc('cinematics.capture_render_state', {  }, undefined, (data) => decodeCameraRenderSnapshotDto(new FlatBufferReader(data)));
    },
    previewSequenceDraft(sequenceJson, skyboxRotation, skyboxOffset, preservePlaybackTime) {
      return client.rpc('cinematics.preview_sequence_draft', { sequenceJson, skyboxRotation, skyboxOffset, preservePlaybackTime }, buildPreviewSequenceDraft_Args);
    },
    setSequenceApplied(applied) {
      return client.rpc('cinematics.set_sequence_applied', { applied }, buildSetSequenceApplied_Args);
    },
    arm(id) {
      return client.rpc('cinematics.arm', { id }, buildArm_Args);
    },
    go() {
      return client.rpc('cinematics.go', {  }, undefined);
    },
    play(id) {
      return client.rpc('cinematics.play', { id }, buildPlay_Args);
    },
    playRelative(id) {
      return client.rpc('cinematics.play_relative', { id }, buildPlayRelative_Args);
    },
    stop() {
      return client.rpc('cinematics.stop', {  }, undefined);
    },
    seek(time) {
      return client.rpc('cinematics.seek', { time }, buildSeek_Args);
    },
    getPlaybackStatus() {
      return client.rpc('cinematics.get_playback_status', {  }, undefined);
    },
    getPlaybackSettings() {
      return client.rpc('cinematics.get_playback_settings', {  }, undefined, (data) => decodeCinematicPlaybackSettingsDto(new FlatBufferReader(data)));
    },
    setAutoStopOnComplete(enabled) {
      return client.rpc('cinematics.set_auto_stop_on_complete', { enabled }, buildSetAutoStopOnComplete_Args);
    },
    subscribePlayback() {
      return client.subscribe('cinematics.subscribe_playback', {  }, undefined);
    },
  };
}
