import { createSeedProject } from '../../lib/studio-model.mjs';
// Imported project fixture; video tests count only their own media audit writes.
export function seedSavedVideoProject(pool, scope, project = createSeedProject()) {
  pool.corruptDocument(scope, 'project', () => ({environment_id:scope.environment,workspace_id:scope.workspaceId,kind:'project',revision:project.revision,value:project,updated_at:new Date('2026-10-08T12:00:00Z')}));
  return project;
}
