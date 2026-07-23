// @ts-nocheck — vendored verbatim; exempt from this project's tsc strictness (noUnusedLocals/noUnusedParameters).
// Vendored from the LeagueBroadcast repository — DO NOT HAND-EDIT; re-vendor from source.
// Source: web/shared/src/rpc/generated/ping-rpc.ts (auto-generated from the C# RPC interfaces)
// Repo:   BlueBottleGG/LeagueBroadcast
// Vendored: 2026-07-23
// Local change: '@bluebottle/rpc' imports rewritten to '../bluebottle-rpc/index.js'.
// Auto-generated RPC client for ping
// DO NOT EDIT — regenerate from C# interface IPingRpc

import { RpcClient, FlatBufferReader, FlatBufferWriter } from '../bluebottle-rpc/index.js';
import type { RpcSubscription } from '../bluebottle-rpc/index.js';

export interface EchoParams {
  message: string;
}

function buildEcho_Args(v: EchoParams): Uint8Array {
  const writer = new FlatBufferWriter();
  writer.writeString(0, v.message);
  return writer.finish(1);
}

export interface PingRpc {
  echo(message: string): Promise<string>;
}

export function createPingRpc(client: RpcClient): PingRpc {
  return {
    echo(message) {
      return client.rpc('ping.echo', { message }, buildEcho_Args, (data) => new FlatBufferReader(data).readString(0) ?? '');
    },
  };
}
