import { createHash } from 'node:crypto';

const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export function avatarBinding(avatar) {
  if (avatar == null) return null;
  if (!avatar || Object.keys(avatar).sort().join(',') !== 'dealerId,imageBase64,imageSha256,profileRevision,schemaVersion'
    || avatar.schemaVersion !== 1 || !/^[a-z][a-z0-9-]{0,63}$/.test(avatar.dealerId ?? '')
    || !hash(avatar.profileRevision) || !hash(avatar.imageSha256)
    || typeof avatar.imageBase64 !== 'string' || avatar.imageBase64.length > 11184812
    || avatar.imageBase64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(avatar.imageBase64)) throw Error('Invalid worker avatar');
  const bytes = Buffer.from(avatar.imageBase64, 'base64');
  if (!bytes.length || bytes.length > 8 * 1024 * 1024 || bytes.toString('base64') !== avatar.imageBase64 || createHash('sha256').update(bytes).digest('hex') !== avatar.imageSha256) throw Error('Invalid worker avatar');
  return Object.freeze({dealerId:avatar.dealerId,profileRevision:avatar.profileRevision,imageSha256:avatar.imageSha256,protocolVersion:3});
}
export const sameBinding = (a, b) => a !== undefined && b !== undefined && JSON.stringify(a) === JSON.stringify(b);
export function acceptsWorkerBinding(expected, headers) {
  if (expected === undefined) return false;
  const actual = {
    dealerId:headers['x-dealer-id'],profileRevision:headers['x-speech-profile-revision'],
    imageSha256:headers['x-speech-image-sha256'],protocolVersion:headers['x-speech-protocol'],
  };
  if (expected === null) return Object.values(actual).every(value => value === undefined);
  return actual.dealerId === expected.dealerId && actual.profileRevision === expected.profileRevision
    && actual.imageSha256 === expected.imageSha256 && actual.protocolVersion === '3';
}
