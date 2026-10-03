import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeStudioMail } from '../lib/studio-native-mail.mjs';

const origin = 'https://studio-fixture.invalid';
const env = { RESEND_API_KEY: 'synthetic-provider-key', CROUPIER_STUDIO_MAIL_FROM: 'studio@owned-fixture.invalid', CROUPIER_PUBLIC_ORIGIN: origin };
const invitation = { to: 'own-test+studio@fixture.invalid', kind: 'invite', link: `${origin}/studio/set-password?t=${'a'.repeat(43)}` };

test('a key without an explicit mailbox never enables the old sender or any provider request', () => {
  let calls = 0;
  for (const change of [{ CROUPIER_STUDIO_MAIL_FROM: undefined }, { CROUPIER_STUDIO_MAIL_FROM: '' },
    { CROUPIER_STUDIO_MAIL_FROM: 'Label <studio@fixture.invalid>' }, { CROUPIER_STUDIO_MAIL_FROM: 'studio@127.0.0.1' },
    { CROUPIER_STUDIO_MAIL_FROM: 'studio@fixture.invalid\r\nBcc: foreign@fixture.invalid' },
    { RESEND_API_KEY: undefined }, { RESEND_API_KEY: ' padded-key ' }, { CROUPIER_PUBLIC_ORIGIN: 'http://fixture.invalid' },
    { CROUPIER_PUBLIC_ORIGIN: `${origin}/studio` }]) {
    assert.equal(createNativeStudioMail({ env: { ...env, ...change }, fetchImpl: () => { ++calls; } }), undefined);
  }
  assert.equal(calls, 0);
});

test('invite and reset send exactly the configured server sender and owned token link', async () => {
  const calls = [];
  const mail = createNativeStudioMail({ env, fetchImpl: async (url, init) => { calls.push({ url, init }); return Response.json({ id: 'synthetic-receipt' }); } });
  for (const kind of ['invite','reset']) assert.deepEqual(await mail.send({ ...invitation, kind }), { sent: true });
  assert.equal(calls.length, 2);
  for (const { url, init } of calls) {
    assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`); assert.equal(init.signal.aborted, false);
    const body = JSON.parse(init.body);
    assert.equal(body.from, `Croupier Studio <${env.CROUPIER_STUDIO_MAIL_FROM}>`);
    assert.deepEqual(body.to, [invitation.to]); assert.ok(body.text.endsWith(invitation.link));
    assert.match(body.text, /Croupier-konto/); assert.doesNotMatch(body.text, /Studio-konto/);
    assert.equal(JSON.stringify(body).includes(env.RESEND_API_KEY), false); assert.doesNotMatch(JSON.stringify(body), /axelio/);
  }
  assert.notEqual(JSON.parse(calls[0].init.body).subject, JSON.parse(calls[1].init.body).subject);
});

test('foreign origins, duplicate tokens, malformed recipients and unsupported mail never reach provider', async () => {
  let calls = 0;
  const mail = createNativeStudioMail({ env, fetchImpl: async () => { ++calls; return Response.json({}); } });
  for (const change of [{ kind: 'custom' }, { to: 'a@fixture.invalid,b@fixture.invalid' },
    { to: 'own@fixture.invalid\nBcc: other@fixture.invalid' }, { link: 'https://foreign.invalid/studio/set-password?t=' + 'a'.repeat(43) },
    { link: invitation.link + '&t=' + 'b'.repeat(43) }, { link: invitation.link + '&extra=1' }, { link: invitation.link + '#fragment' },
    { link: `${origin}/other?t=${'a'.repeat(43)}` }, { link: `${origin}/studio/set-password?t=short` },
    { link: 'https://user:pass@studio-fixture.invalid/studio/set-password?t=' + 'a'.repeat(43) }]) {
    assert.deepEqual(await mail.send({ ...invitation, ...change }), { sent: false });
  }
  assert.equal(calls, 0);
});

test('rejected, uncertain or redirected delivery returns failure with no automatic retry', async () => {
  for (const outcome of [async () => new Response(null, { status: 401 }), async () => new Response(null, { status: 307 }),
    async () => { throw Error('private-provider-diagnostic'); }]) {
    let calls = 0;
    const mail = createNativeStudioMail({ env, fetchImpl: async (...args) => { ++calls; return outcome(...args); } });
    assert.deepEqual(await mail.send(invitation), { sent: false }); assert.equal(calls, 1);
  }
});
