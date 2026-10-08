import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { errorResponse } from '../../../lib/http-guard.mjs';
import { openPreviewFile, parseByteRange, previewAuthorizationRequest, previewBuildDirectory } from '../../../lib/preview-files.mjs';
import { authorizeUiPage } from '../../../lib/ui-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function privateHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  };
}

function fileBody(stream: ReturnType<typeof createReadStream>) {
  return Readable.toWeb(stream) as unknown as BodyInit;
}

async function previewResponse(request: Request, segments: string[] | undefined, head: boolean) {
  try {
    await authorizeUiPage(previewAuthorizationRequest(request));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const response = errorResponse(error);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
  const opened = await openPreviewFile(previewBuildDirectory, Array.isArray(segments) ? segments : []);
  if (!opened) return new Response(null, { status: 404, headers: privateHeaders() });
  const headers = privateHeaders({
    'Content-Type': opened.contentType,
    'Accept-Ranges': 'bytes',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  const range = parseByteRange(request.headers.get('range'), opened.size);
  if (!range) {
    headers['Content-Length'] = String(opened.size);
    if (head || opened.size === 0) return new Response(null, { status: 200, headers });
    return new Response(fileBody(createReadStream(opened.file)), { status: 200, headers });
  }
  if (range.status !== 'ok') {
    headers['Content-Range'] = `bytes */${opened.size}`;
    return new Response(null, { status: 416, headers });
  }
  headers['Content-Range'] = `bytes ${range.start}-${range.end}/${opened.size}`;
  headers['Content-Length'] = String(range.end - range.start + 1);
  if (head) return new Response(null, { status: 206, headers });
  return new Response(fileBody(createReadStream(opened.file, { start: range.start, end: range.end })), { status: 206, headers });
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return previewResponse(request, (await context.params).path, false);
}

export async function HEAD(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return previewResponse(request, (await context.params).path, true);
}
