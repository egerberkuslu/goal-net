// Kept as the `npm run rooms` entry point. The registry itself now lives in
// packages/server so the combined web server can mount the same handler.
// Run: node server/room-list.mjs  (port 5200, override with PORT)
import { startRoomListServer } from '../packages/server/src/rooms.mjs';

startRoomListServer(process.env.PORT || 5200);
