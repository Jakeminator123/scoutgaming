// Only these server-owned codes may supply upload details to the browser.
const inspectionMessages=Object.freeze({
  studio_media_dimensions_mismatch:'Filens bildmått stämmer inte med uppladdningen. Välj filen igen.',
  studio_invalid_media_format:'Filen kunde inte verifieras. Välj en giltig bild eller video.',
  studio_media_inspection_limit:'Filen är för stor eller komplex för kontrollen. Välj en mindre fil.',
  studio_media_inspection_busy:'En fil kontrolleras redan. Försök igen om en stund.',
  studio_media_inspection_timeout:'Filkontrollen tog för lång tid. Försök med en mindre fil.',
  studio_media_inspection_cancelled:'Filkontrollen avbröts. Försök igen.',
  studio_media_inspection_failed:'Filkontrollen är inte tillgänglig just nu. Försök igen senare.',
});
export function layerMediaInspectionMessage(code) {
  return typeof code==='string'&&Object.hasOwn(inspectionMessages,code)?inspectionMessages[code]:null;
}
class LayerUploadResponseError extends Error {
  constructor(message,registrationRejected){super(message);this.registrationRejected=registrationRejected;}
}
export function layerUploadResponseError(status,body) {
  const message=layerMediaInspectionMessage(body?.code);
  const expected=body?.code==='studio_invalid_media_format'?[415,422]
    :body?.code==='studio_media_inspection_cancelled'?[408]
    :['studio_media_inspection_busy','studio_media_inspection_failed'].includes(body?.code)?[503]:[422];
  if(message&&expected.includes(status))return new LayerUploadResponseError(message,true);
  return new LayerUploadResponseError(status===409?'Projektet har ändrats.':'Lagerfilen kunde inte sparas.',false);
}
export function layerUploadFailureMessage(cause,{aborted=false,commitStarted=false}={}) {
  const known=cause instanceof LayerUploadResponseError;
  const uncertain=commitStarted&&!(known&&cause.registrationRejected)
    ?'Filen kan vara registrerad. Kontrollera biblioteket innan du laddar upp igen. ':'';
  if(aborted)return `${uncertain}Uppladdningen avbröts. Utkastet har behållits.`;
  return `${uncertain}${known?cause.message:'Uppladdningen misslyckades.'} Utkastet har behållits.`;
}
