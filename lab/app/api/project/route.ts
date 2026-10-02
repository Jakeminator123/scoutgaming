import { studioStore, connectionStatus, validateVideoBindings } from '@/lib/studio-server.mjs';
import { validateProject } from '@/lib/studio-model.mjs';
import { assertLocalRequest, readLocalJson, jsonResponse, errorResponse } from '@/lib/http-guard.mjs';
import { legacyClipControls } from '@/lib/legacy-clip-inventory.mjs';
import { StudioError } from '@/lib/project-store.mjs';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { assertLocalRequest(request); return jsonResponse({ project: await studioStore().load(), status: connectionStatus() }); }
  catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    const body = await readLocalJson(request);
    validateProject(body?.project);
    await validateVideoBindings(body.project);
    if (body.project.legacyClipPolicy?.length) {
      const clips = await legacyClipControls(body.project);
      if (clips.runtime.conflicts.length) throw new StudioError('En klippkoppling saknar exakt dealer/situation eller tillgänglig fil. Granska klippbiblioteket i Lab.');
    }
    return jsonResponse({ project: await studioStore().save(body.project, body?.expectedRevision) });
  }
  catch (error) { return errorResponse(error); }
}
