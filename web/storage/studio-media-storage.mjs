import {StudioStorageError} from './studio-contract.mjs';

// The immutable 001-008 PostgreSQL schema accepts these two MIME types only.
// Parser/intake support for PNG or audio does not extend the storage constraint.
export const STUDIO_STORED_MEDIA_TYPES=Object.freeze(['video/mp4','video/webm']);
export const STUDIO_MEDIA_TYPE_UNSUPPORTED='studio_media_content_type_unsupported';
export const STUDIO_MEDIA_TYPE_MESSAGE='Studio-databasen stöder ännu bara MP4 och WebM. PNG och ljud kräver en separat databasuppdatering.';
export function assertStudioMediaStorageType(contentType){
  if(!STUDIO_STORED_MEDIA_TYPES.includes(contentType))
    throw new StudioStorageError(STUDIO_MEDIA_TYPE_UNSUPPORTED,415);
}
