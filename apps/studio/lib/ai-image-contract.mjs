// Browser-safe vocabulary for "Skapa bakgrund med AI", shared by the route and
// the Admin dialog. Only these fixed codes and labels reach the browser.
export const AI_IMAGE_ERROR_CODES = Object.freeze(['ai_image_unavailable','ai_image_limit_reached','ai_image_rejected','ai_image_invalid_request']);
export const AI_IMAGE_ROLES = Object.freeze(['background','table']);
export const AI_IMAGE_PROMPT_LENGTH = Object.freeze({min:3,max:600});
export const AI_IMAGE_MAX_PROPOSALS = 4;
export const AI_IMAGE_REFERENCE_TYPES = Object.freeze(['image/png','image/jpeg','image/webp']);
// The decoded server limit keeps a base64 JSON body under Vercel's 4.5 MB
// request limit. The dialog accepts files up to 8 MB and shrinks larger ones.
export const AI_IMAGE_REFERENCE_MAX_BYTES = 3*1024*1024;
export const AI_IMAGE_REFERENCE_FILE_MAX_BYTES = 8*1024*1024;
// The scene's desktop format; phones show its centre strip.
export const AI_BACKGROUND_SIZE = Object.freeze({width:1920,height:1080});
// Presets match the generic backgrounds. "Fri" sends only the staff text.
export const AI_IMAGE_PRESETS = Object.freeze([
  Object.freeze({id:'dark-studio',label:'Mörk studio'}),
  Object.freeze({id:'warm-lounge',label:'Varm lounge'}),
  Object.freeze({id:'light-studio',label:'Ljus studio'}),
  Object.freeze({id:'casino',label:'Casino'}),
  Object.freeze({id:'free',label:'Fri'}),
]);

// The material label: "AI · <short prompt>", within the layer contract's 80
// characters and without control characters or angle brackets.
export function aiImageLabel(prompt) {
  const text=String(prompt??'').replace(/[\u0000-\u001f\u007f-\u009f<>]/gu,' ').replace(/\s+/g,' ').trim();
  return 'AI · '+(text.length>60?text.slice(0,59).trimEnd()+'…':text||'bild');
}
