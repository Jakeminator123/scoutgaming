import { isGameLaneId } from '../../packages/presentation/contracts/game-lane-id.mjs';

// Select exactly one application entrypoint from the server's saved room choice.
// No query, DOM script, or local preference can enable the shared writer.
export function withSharedRoomEntry(html, { enabled = false, selection } = {}) {
  if (typeof html !== 'string' || typeof enabled !== 'boolean') throw new TypeError('Invalid game entry');
  if (!enabled || selection?.roomId === undefined) return html;
  const roomId=selection.roomId;
  if (!isGameLaneId(roomId) || !/^[a-z0-9_-]{1,128}$/.test(roomId)
    || !html.includes('data-game-room-id="'+roomId+'"') || /\bdata-shared-room\s*=/.test(html)) {
    throw new Error('Shared room entry is not bound to a saved room');
  }
  const pattern=/<script\b[^>]*\bsrc=(["'])(?:\/)?app\.mjs\1[^>]*>\s*<\/script>/g;
  const entries=[...html.matchAll(pattern)];
  if (entries.length!==1 || !/\btype=(["'])module\1/.test(entries[0][0]) || !/<html(?=[\s>])/i.test(html)) {
    throw new Error('Shared room entrypoint unavailable');
  }
  return html.replace(entries[0][0],entries[0][0].replace(/\bsrc=(["'])(?:\/)?app\.mjs\1/,'src="/shared-room-app.mjs"'))
    .replace(/<html(?=[\s>])/i,'<html data-shared-room="1"');
}
