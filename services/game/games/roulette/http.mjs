import { readFile } from 'node:fs/promises';
import {playerLobbyPath} from '../../../../packages/navigation/player-lobby.mjs';

const files = new Map([
  ['/play/roulette','index.html'], ['/roulette-rules.mjs','rules.mjs'], ['/roulette/app.mjs','app.mjs'], ['/roulette/style.css','style.css'], ['/roulette/scene.mjs','scene.mjs'],
  ['/roulette/media.mjs','media.mjs'], ['/roulette/assets/roulette-bord.png','assets/roulette-bord.png'],
  ['/roulette/table-layout.mjs','table-layout.mjs'],
  ['/roulette/wheel.mjs','wheel.mjs'], ['/roulette/wheel-motion.mjs','wheel-motion.mjs'],
]);
const headers = { 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow',
  'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" };
const documentHeaders = { ...headers, 'Content-Security-Policy': headers['Content-Security-Policy']
  .replace("connect-src 'self'", "connect-src 'self' https://api.d-id.com")
  .replace("media-src 'self'", "media-src 'self' blob: https://agents-results.d-id.com") };
export async function rouletteDocument(req,res,{ authenticated, guestPreview, resolveRoom }) {
  const url = new URL(req.url,'http://local');
  if (['/roulette','/roulette/','/play/roulette/'].includes(url.pathname)) {
    res.writeHead(308,{ ...headers, Location:'/play/roulette'+url.search }); res.end(); return true;
  }
  if (!files.has(url.pathname)) return false;
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{...headers,Allow:'GET, HEAD'}); res.end(); return true; }
  const context = Object.fromEntries(url.searchParams);
  if ([...url.searchParams.keys()].some(key=>!['operator','table','dealer'].includes(key)||url.searchParams.getAll(key).length!==1)) {
    res.writeHead(400,headers); res.end('Ogiltigt rumsval.'); return true;
  }
  if (url.pathname === '/play/roulette' && resolveRoom && !url.search) {
    res.writeHead(303,{...headers,Location:'/lobby'}); res.end(); return true;
  }
  if (url.pathname === '/play/roulette' && !authenticated && !guestPreview) {
    res.writeHead(303,{ ...headers,Location:'/player-login?returnTo='+encodeURIComponent('/play/roulette'+url.search) }); res.end(); return true;
  }
  let resolvedRoom;
  if (url.pathname === '/play/roulette' && resolveRoom) {
    try { resolvedRoom=(await resolveRoom(context)).room; }
    catch (error) { res.writeHead(error.statusCode ?? 503,{...headers,'Content-Type':'text/plain; charset=utf-8'}); res.end('Rummet är inte tillgängligt. Öppna ett publicerat rum från lobbyn.'); return true; }
  }
  const name = files.get(url.pathname);
  let content = await readFile(new URL(name === 'rules.mjs' ? './rules.mjs' : `../../public/roulette/${name}`,import.meta.url));
  if(name==='index.html'&&resolvedRoom?.operator) {
    const back=playerLobbyPath({operator:resolvedRoom.operator,room:resolvedRoom.id,dealer:resolvedRoom.dealer});
    content=Buffer.from(content.toString('utf8').replaceAll('href="/lobby"','href="'+back.replaceAll('&','&amp;').replaceAll('"','&quot;')+'"'));
  }
  const type = name.endsWith('.png') ? 'image/png' : (name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript')+'; charset=utf-8';
  res.writeHead(200,{ ...(name.endsWith('.html') ? documentHeaders : headers),'Content-Type':type });
  res.end(req.method === 'HEAD' ? undefined : content); return true;
}
