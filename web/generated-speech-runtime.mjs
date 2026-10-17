import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireGeneratedSpeechRuntime } from '../packages/presentation/server/generated-speech-runtime.mjs';

export const { getGeneratedSpeechService, generatedSpeechStatus, configureGeneratedSpeechJournal,
  registerBoundedAiQaFullfileAuthority, boundedAiQaAllowsFullfile } = acquireGeneratedSpeechRuntime({
  repositoryRoot: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
});
