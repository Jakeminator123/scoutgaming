import { decidePresentation } from './presentation-director.mjs';
import { readLocalJson, jsonResponse, errorResponse } from './http-guard.mjs';

export async function presentationDecisionResponse(request, decide = decidePresentation) {
  try { return jsonResponse(await decide(await readLocalJson(request))); }
  catch (error) { return errorResponse(error); }
}
