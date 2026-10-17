import {NATIVE_MEDIA_FILE_TYPES,mediaContentType} from '../../packages/shared/media-file-types.mjs';
import {MAX_VIDEO_BYTES} from '../../packages/presentation/contracts/video-intake.mjs';

export const NATIVE_MEDIA_ACCEPT=Object.values(NATIVE_MEDIA_FILE_TYPES).map(extension=>'.'+extension).join(',');
export function nativeMediaFileError(file,contentType=mediaContentType(file?.name??'')){
  if(!(file instanceof Blob)||!Object.hasOwn(NATIVE_MEDIA_FILE_TYPES,contentType))
    return 'Välj MP4 eller WebM. PNG och ljud stöds ännu inte i detta mediaregister.';
  return file.size<16||file.size>MAX_VIDEO_BYTES?'Filen måste vara mellan 16 byte och 128 MB.':'';
}
// Check the entire unsaved selection before any file is hashed, decoded or sent.
export function assertNativeMediaFiles(files){
  for(const file of files){const error=nativeMediaFileError(file);if(error)throw Error(error);}
}
