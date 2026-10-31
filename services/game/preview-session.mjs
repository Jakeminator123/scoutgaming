import { createHash, randomBytes } from 'node:crypto';

// Admission stays with the server's player/administrator/guest gates.
export function createPreviewPlayer({ db, createPlayer, getPlayer }) {
  return async function previewPlayer(req, res) {
    const token = (req.headers.cookie ?? '').match(/(?:^|;\s*)preview_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    const digest = value => createHash('sha256').update(value).digest('hex');
    const existing = token && await db.prepare('SELECT player_id FROM preview_sessions WHERE digest=? AND expires>?').get(digest(token), Date.now());
    if (existing && await getPlayer(existing.player_id)) return existing.player_id;
    const player = await createPlayer({ name: 'Product preview' }), fresh = randomBytes(32).toString('hex');
    await db.prepare('DELETE FROM preview_sessions WHERE expires<=?').run(Date.now());
    await db.prepare('INSERT INTO preview_sessions VALUES (?,?,?)').run(digest(fresh), player.id, Date.now() + 7 * 86400000);
    const secure = req.socket.encrypted || process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `preview_session=${fresh}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`);
    return player.id;
  };
}
