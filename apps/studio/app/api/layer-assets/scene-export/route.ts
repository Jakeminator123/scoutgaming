import {handleSceneExportRequest} from '@/lib/scene-export-api.mjs';

// Exportera miljöbild: reads up to two images from private Blob, renders one still with sharp and stores it.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) { return handleSceneExportRequest(request); }
