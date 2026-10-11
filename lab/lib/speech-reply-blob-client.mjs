// Keep SDK resolution with the existing Lab dependency. Importing is lazy;
// constructors and Next builds do not contact storage.
export async function speechReplyBlobClient() { return import('@vercel/blob'); }
