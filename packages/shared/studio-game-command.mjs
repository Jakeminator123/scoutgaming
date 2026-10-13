import { createHmac } from 'node:crypto';

// Shared wire signature for Studio's sender and the game engine's receiver.
// Authorization, scope checks and replay protection remain with each caller.
export function studioCommandSignature(secret, timestamp, body) {
  return createHmac('sha256', secret).update(`studio-game-command-v1\n${timestamp}\n${body}`).digest('hex');
}
