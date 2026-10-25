import type { IdlePolicy } from '../../../packages/presentation/runtime/idle-policy.mjs';
import type { VideoInventory } from '../../../packages/presentation/contracts/media-inventory.mjs';
export function preparePaowIdleRotation(policy: IdlePolicy, inventory: VideoInventory): null | { policy: IdlePolicy | null; matched: number; total: number; error: string | null };
