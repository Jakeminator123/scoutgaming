import { readFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { assertLocalRequest, errorResponse } from '@/lib/http-guard.mjs';

export const runtime = 'nodejs';
const root = basename(process.cwd()) === 'lab' ? resolve(process.cwd(), '..') : process.cwd();

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    const image = await readFile(resolve(root, 'emil/dealklipp-v1/astrid_startbild_spel_1080x1920.png'));
    return new Response(image, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return errorResponse(error); }
}
