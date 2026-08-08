// @goalnet/net — host-authoritative netcode over the deterministic core.
//
// Transport-agnostic on purpose. Nothing in this package knows what a
// RTCDataChannel is: sessions consume and produce ArrayBuffers, and take the
// clock as an argument. Wire them to PeerJS, to a WebSocket, or to an
// in-process fake (see test/channel.mjs) without changing a line here.
//
// Channel mapping the caller is expected to honour (brain/20-tech-spec/netcode-p2p.md)
//   game channel   { ordered: false, maxRetransmits: 0 }  inputs + snapshots
//   lobby channel  ordered + reliable                     hello / resync
// Ordering is recovered at the application level from the `seq` word, which is
// why the game channel is allowed to be as lossy as it likes.
//
// ---------------------------------------------------------------- host loop
//
//   import { createHostSession } from '@goalnet/net';
//
//   const host = createHostSession({
//     playerCount: 4,
//     hostPlayerId: 0,
//     snapshotHz: 20,
//     botSlots: [2, 3],
//     botPolicy: ({ world, tick, playerIndex }) => myBot(world, tick, playerIndex),
//   });
//   host.addPeer('peer-a', 1, performance.now());
//   gameChannelA.onmessage = (e) => host.receive('peer-a', e.data, performance.now());
//
//   function frame(now) {
//     host.setLocalInput(readKeyboard());          // the host's own player
//     for (const { to, buffer } of host.update(now)) channels[to].send(buffer);
//     render(readState(host.world));               // the host renders live state
//     requestAnimationFrame(frame);
//   }
//
// -------------------------------------------------------------- client loop
//
//   import { createClientSession } from '@goalnet/net';
//
//   const client = createClientSession({ localPlayerId: 1, interpolationMs: 100 });
//   lobbyChannel.send(client.hello());             // asks for a full snapshot
//   gameChannel.onmessage = (e) => client.receive(e.data, performance.now());
//
//   function frame(now) {
//     while (fixedStepDue(now)) {                  // once per 60 Hz tick
//       const { buffer } = client.sendInput(readKeyboard());
//       gameChannel.send(buffer);
//     }
//     if (client.needsFull) lobbyChannel.send(client.hello());
//     const view = client.sample(now);             // ~100 ms behind, interpolated,
//     if (view) render(view);                      // local player predicted
//     requestAnimationFrame(frame);
//   }
//
// Bots run on the host and only on the host. `createClientSession` has no bot
// hook and never will: a client authoring input for a slot it does not own is
// rejected by the host as a spoof.

export { createHostSession, DEFAULT_LIMITS } from './hostSession.js';
export { createClientSession } from './clientSession.js';

export {
  NET_MAGIC,
  PROTOCOL_VERSION,
  MSG_HELLO,
  MSG_INPUT,
  MSG_SNAPSHOT,
  MAX_MESSAGE_BYTES,
  MAX_PROTOCOL_PLAYERS,
  HEADER_WORDS,
  HELLO_BYTES,
  INPUT_BYTES,
  SNAPSHOT_FIXED_WORDS,
  ProtocolError,
  decodeMessage,
  encodeHello,
  encodeInput,
  encodeSnapshotMessages,
  encodeDeltaWords,
  applyDeltaWords,
  snapshotHeaderBytes,
  snapshotChunkCapacity,
  stateChecksumInt,
  checksumHex,
} from './protocol.js';

export const NET_VERSION = '0.1.0';
