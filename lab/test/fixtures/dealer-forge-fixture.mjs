// Shared in-memory fixture for Dealer Forge tests: fake repository, store, Runway, images and private Blob.
import { createHash } from 'node:crypto';
import { createSeedProject, addDealer } from '../../lib/studio-model.mjs';
import { createDealerForgeService } from '../../lib/dealer-forge-service.mjs';
import { validateStudioMedia } from '../../../web/storage/studio-contract.mjs';

export const scope = { environment: 'test', workspaceId: 'ws' };
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(64, 7)]);
export const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(40, 1)]);

export function fakeImages() {
  const normalize = async bytes => { const out = Buffer.concat([PNG, bytes.subarray(0, 8)]); return { bytes: out, width: 1080, height: 1920, contentType: 'image/png', sha256: sha(out), size: out.byteLength }; };
  return { normalizeAnchor: normalize, poseFromGenerated: normalize, markCardTarget: async (bytes, point) => Buffer.concat([bytes, Buffer.from(`${point.cx},${point.cy}`)]),
    tableGuide: async () => Buffer.from('guide-table'), backgroundGuide: async () => Buffer.from('guide-bg'),
    tableLayerFromMagenta: async bytes => { const out = Buffer.concat([Buffer.from('RIFF....WEBP'), bytes.subarray(0, 4)]); return { bytes: out, width: 1080, height: 1920, contentType: 'image/webp', sha256: sha(out), size: out.byteLength }; },
    backgroundLayer: async bytes => { const out = Buffer.concat([Buffer.from('RIFF....WEBP'), bytes.subarray(0, 4)]); return { bytes: out, width: 1920, height: 1080, contentType: 'image/webp', sha256: sha(out), size: out.byteLength }; } };
}

export function fakeStore() {
  const profiles = new Map(), jobs = new Map(); let ready = true, seq = 0;
  return { profiles, jobs, setReady: value => { ready = value; },
    async ready() { return ready; },
    async getProfile(dealerId) { return profiles.get(dealerId) ? structuredClone(profiles.get(dealerId)) : null; },
    async saveProfile(dealerId, profile, { expectedRevision = null }) {
      const current = profiles.get(dealerId);
      if (expectedRevision === null ? current : current?.revision !== expectedRevision) throw Object.assign(new Error('conflict'), { statusCode: 409, code: 'studio_forge_conflict' });
      const next = { dealerId, revision: (current?.revision ?? 0) + 1, profile: structuredClone(profile) }; profiles.set(dealerId, next); return structuredClone(next);
    },
    async insertJob(row) { const job = { ...structuredClone(row), jobId: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, provider: 'runway', createdAt: seq, updatedAt: seq, taskId: row.taskId ?? null, result: row.result ?? null, error: row.error ?? null }; jobs.set(job.jobId, job); return structuredClone(job); },
    async getJob(id) { return jobs.get(id) ? structuredClone(jobs.get(id)) : null; },
    async updateJob(id, { expectedStatus, status, taskId, result, error }) {
      const job = jobs.get(id); if (!job || (expectedStatus && job.status !== expectedStatus)) throw Object.assign(new Error('conflict'), { statusCode: 409, code: 'studio_forge_conflict' });
      Object.assign(job, { status, taskId: taskId ?? job.taskId, result: result === undefined || result === null ? job.result : structuredClone(result), error: error ?? null, updatedAt: ++seq }); return structuredClone(job);
    },
    async listJobs(dealerId) { return [...jobs.values()].filter(job => job.dealerId === dealerId).map(job => structuredClone(job)).reverse(); } };
}

export function fixture({ runway: runwayOverrides = {}, project } = {}) {
  const value = project ?? addDealer(createSeedProject(), 'paow', 'Paow');
  const documents = new Map([['project', { revision: 'rev-1', value: structuredClone(value) }]]);
  const media = new Map(), blobs = new Map(), registered = [];
  const repository = {
    scope,
    async readDocument(kind) { const doc = documents.get(kind); return doc ? structuredClone(doc) : null; },
    async saveDocument(kind, { expectedRevision, value: next }) { const doc = documents.get(kind); if (doc.revision !== expectedRevision) throw Object.assign(new Error('studio_conflict'), { statusCode: 409 }); const saved = { revision: `rev-${documents.size + Math.random()}`, value: structuredClone(next) }; documents.set(kind, saved); return structuredClone(saved); },
    async getMedia(id) { return media.get(id) ? structuredClone(media.get(id)) : null; },
    async listMedia() { return [...media.values()].map(row => structuredClone(row)); },
    async registerMedia(record) { validateStudioMedia(record); media.set(record.id, { ...structuredClone(record), revision: 'm1' }); registered.push(structuredClone(record)); return { duplicate: false }; },
    async transaction(work) { return work(); },
    async withTransactionClient(work) { return work({ query: async () => ({ rows: [] }) }); },
  };
  const tasks = new Map(), submitted = [];
  const runway = {
    async asset(bytes, type) { return `data:${type};base64,${Buffer.from(bytes).toString('base64').slice(0, 12)}`; },
    async imageToVideo(params) { submitted.push({ endpoint: 'image_to_video', params }); const id = `task-${submitted.length}`; tasks.set(id, { id, status: 'RUNNING', progress: 0.3 }); return id; },
    async textToImage(params) { submitted.push({ endpoint: 'text_to_image', params }); const id = `task-${submitted.length}`; tasks.set(id, { id, status: 'PENDING' }); return id; },
    async createAvatar(params) { submitted.push({ endpoint: 'avatars', params }); return { id: 'avatar-1', status: 'PROCESSING' }; },
    async avatar() { return { id: 'avatar-1', status: 'READY' }; },
    async avatarVideo(params) { submitted.push({ endpoint: 'avatar_videos', params }); const id = `task-${submitted.length}`; tasks.set(id, { id, status: 'RUNNING' }); return id; },
    async task(id) { const task = tasks.get(id); return { id, status: task.status, progress: task.progress ?? null, output: task.output ?? [], failure: task.failure ?? '', failureCode: '', credits: task.credits ?? 20 }; },
    async cancelTask() {},
    async download(url) { return Buffer.from(url.startsWith('https://out/png') ? PNG : MP4); },
    ...runwayOverrides,
  };
  const failPut = { once: false };
  const privateMedia = {
    async put(pathname, bytes, { sha256, size }) { if (failPut.once) { failPut.once = false; throw new Error('blob down'); } if (sha(bytes) !== sha256 || bytes.byteLength !== size) throw new Error('hash mismatch'); if (blobs.has(pathname)) throw new Error('overwrite'); blobs.set(pathname, Buffer.from(bytes)); },
    async get(record) { const bytes = blobs.get(record.pathname); return bytes ? new Response(bytes, { status: 200 }) : new Response('missing', { status: 404 }); },
  };
  const projectSaves = [];
  const gamePolicy = { projectStore: ({ actor }) => ({ save: async (next, expectedRevision) => { projectSaves.push({ actor, next }); return repository.saveDocument('project', { expectedRevision, value: next }); } }) };
  const videoRegistry = async () => ({ videos: [...media.values()].map(row => ({ id: row.id, label: row.classification.label, dealer: row.classification.dealerId, classification: row.classification, sha256: row.sha256, available: true, previewUrl: `/api/videos/${row.id}` })) });
  const store = fakeStore();
  const service = createDealerForgeService({ repository, scope, env: { RUNWAY_API_KEY: 'test-key-0123456789abcdef', CROUPIER_MEDIA_STORAGE: 'blob', BLOB_READ_WRITE_TOKEN: 'x' }, mutationTransaction: async work => work(),
    gamePolicy, videoRegistry, validateProjectBindings: async () => {}, now: () => 1_700_000_000_000, runwayFactory: () => runway, store, images: fakeImages(), privateMedia });
  return { service, store, repository, runway, tasks, submitted, registered, blobs, documents, projectSaves, media, failPut };
}

