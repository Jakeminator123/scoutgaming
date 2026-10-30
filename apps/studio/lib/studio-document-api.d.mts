import type { NeonDocumentRepository } from './neon-project-store.mjs';
import type { NativeStudioSession } from '../../../packages/studio-access/studio-native-auth.mjs';
import type { NativeStudioConfiguration } from './studio-native-runtime.mjs';
import type { StudioProject } from '../../../packages/presentation/contracts/studio-model.mjs';
export function createStudioDocumentApi(options: {
  repository: NeonDocumentRepository;
  authorize(request: Request): Promise<NativeStudioSession>;
  config: NativeStudioConfiguration;
  validateProjectBindings?(project: StudioProject): Promise<void>;
  mutationTransaction?<T>(work: () => Promise<T>): Promise<T>;
  /** Dealers with a moving bank here; a new motion reference for another dealer is refused (default: none). */
  movingSpeechDealers?(): readonly string[];
  gamePolicy?: {projectStore(options: {actor: string}): {load(): Promise<StudioProject>; save(next: StudioProject, expectedRevision: string): Promise<StudioProject>}};
}): { handle(request: Request): Promise<Response> };
export function handleNativeStudioDocument(request: Request): Promise<Response>;
export function readStudioDocumentJson(request: Request): Promise<Record<string, any>>;
