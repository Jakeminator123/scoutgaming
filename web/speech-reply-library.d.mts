export interface SpeechReplyItem {
  id: string; dealerId: string; exactText: string; language: string; createdAt: string; profileRevision: string;
  revision: number; categories: string[]; reviewStatus: 'pending';
  media: Record<'audio'|'video', {available: true; sha256: string; contentType: string; size: number}>;
}
export class SpeechReplyLibraryError extends Error { code: string; status: number; statusCode: number; }
export function createSpeechReplyLibrary(options?: {mediaStore: {putPrivateMedia: (...args: any[]) => Promise<any>; getPrivateMedia: (...args: any[]) => Promise<Response>; deletePrivateMedia: (...args: any[]) => Promise<any>}; repository: {scope: {environment: string; workspaceId: string}; read: (...args: any[]) => Promise<any>; list: (...args: any[]) => Promise<any>; create: (...args: any[]) => Promise<any>; update: (...args: any[]) => Promise<any>}; environment: string; workspaceId: string; env?: NodeJS.ProcessEnv; blobClient?: unknown; cacheDir?: string; now?: () => Date}): {
  save(input: {dealerId: string; id?: string; exactText: string; language?: string; profileRevision: string; audio: {bytes: Buffer; contentType: string}; video: {bytes: Buffer; contentType: string}}): Promise<SpeechReplyItem>;
  list(input: {dealerId: string; category?: string; cursor?: string}): Promise<{items: SpeechReplyItem[]; nextCursor: string|null}>;
  get(input: {dealerId: string; id: string}): Promise<SpeechReplyItem>;
  categorize(input: {dealerId: string; id: string; categories: string[]; expectedRevision: number; stillAuthorized?: () => Promise<unknown>}): Promise<SpeechReplyItem>;
  media(input: {dealerId: string; id: string; kind: 'audio'|'video'; request: Request}): Promise<Response>;
};
