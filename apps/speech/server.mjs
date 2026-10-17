import {createSpeechIngress} from './service.mjs';

// Vercel's Node framework captures listen() from this explicit service entrypoint.
// Merely exporting servers under a Next.js app's /api directory omits the routes.
const server = createSpeechIngress();
server.listen(Number(process.env.PORT ?? 3000));
