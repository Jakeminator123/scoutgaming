import test from 'node:test';
import assert from 'node:assert/strict';
import { createNativeStudioMail } from '../lib/studio-native-mail.mjs';

const origin = 'https://studio-fixture.invalid';
const env = { RESEND_API_KEY: 'synthetic-provider-key', CROUPIER_STUDIO_MAIL_FROM: 'studio@owned-fixture.invalid', CROUPIER_PUBLIC_ORIGIN: origin };
const invitation = { to: 'own-test+studio@fixture.invalid', kind: 'invite', role: 'admin', link: `${origin}/studio/set-password?t=${'a'.repeat(43)}` };

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
    assert.equal(body.from, `ScoutGamingGroup <${env.CROUPIER_STUDIO_MAIL_FROM}>`);
    assert.deepEqual(body.to, [invitation.to]); assert.ok(body.text.includes(invitation.link));
    assert.match(body.subject, /adminpersonal, nivå 1/);
    for (const content of [body.text, body.html]) {
      assert.match(content, /intern adminpersonal/); assert.match(content, /hela nivå 1.*nivå 3/);
      assert.match(content, /nivå 2 \(spelbolagens arbetsytor\)/);
      assert.match(content, /samma konto och lösenord på alla tre nivåerna/);
      assert.match(content, /kundval aktiveras när spelbolag ansluts/);
      assert.ok(content.includes(invitation.to)); assert.ok(content.includes(origin + '/play'));
      assert.ok(content.includes(origin + '/studio/login?returnTo=%2Fcontrol'));
      assert.match(content, /kan användas en gång/); assert.match(content, /Lösenord skickas aldrig via e-post/);
    }
    assert.ok(body.html.includes(`href="${invitation.link}"`));
    assert.equal(JSON.stringify(body).includes(env.RESEND_API_KEY), false); assert.doesNotMatch(JSON.stringify(body), /axelio/);
  }
  assert.notEqual(JSON.parse(calls[0].init.body).subject, JSON.parse(calls[1].init.body).subject);
  assert.match(JSON.parse(calls[0].init.body).text, /72 timmar/);
  assert.match(JSON.parse(calls[0].init.body).html, /Aktivera kontot och välj lösenord/);
  assert.match(JSON.parse(calls[1].init.body).text, /2 timmar/);
  assert.match(JSON.parse(calls[1].init.body).html, /Välj nytt lösenord/);
});

test('mail uses stored account roles: legacy admin aliases get all three levels; game-only accounts never claim staff access', async () => {
  const calls = [];
  const mail = createNativeStudioMail({ env, fetchImpl: async (_url, init) => { calls.push(JSON.parse(init.body)); return Response.json({}); } });
  for (const role of ['superadmin','reader','staff','player']) for (const kind of ['invite','reset']) {
    assert.deepEqual(await mail.send({ ...invitation, role, kind }), { sent: true });
    const sent = calls.at(-1);
    if (role === 'superadmin') assert.match(sent.subject, /adminpersonal, nivå 1/);
    else {
      assert.match(sent.subject, /spelare, nivå 3/);
      assert.doesNotMatch(sent.subject + sent.text + sent.html, /adminpersonal|nivå [12]|kundval|\/studio\/login/);
      assert.ok(sent.text.includes(origin + '/player-login'));
    }
  }
});

test('HTML escapes mailbox characters while keeping the literal recipient in the provider envelope and text', async () => {
  const to = "a&'b@fixture.invalid"; let sent;
  const mail = createNativeStudioMail({ env, fetchImpl: async (_url, init) => { sent = JSON.parse(init.body); return Response.json({}); } });
  assert.deepEqual(await mail.send({ ...invitation, to }), { sent: true });
  assert.deepEqual(sent.to, [to]); assert.ok(sent.text.includes(to));
  assert.ok(sent.html.includes('a&amp;&#39;b@fixture.invalid')); assert.equal(sent.html.includes(to), false);
});

test('foreign origins, duplicate tokens, malformed recipients and unsupported mail never reach provider', async () => {
  let calls = 0;
  const mail = createNativeStudioMail({ env, fetchImpl: async () => { ++calls; return Response.json({}); } });
  for (const change of [{ kind: 'custom' }, { role: undefined }, { role: 'unknown' }, { role: 'partner-admin' }, { to: 'a@fixture.invalid,b@fixture.invalid' },
    { to: 'own@fixture.invalid\nBcc: other@fixture.invalid' }, { link: 'https://foreign.invalid/studio/set-password?t=' + 'a'.repeat(43) },
    { link: invitation.link + '&t=' + 'b'.repeat(43) }, { link: invitation.link + '&extra=1' }, { link: invitation.link + '#fragment' },
    { link: `${origin}/other?t=${'a'.repeat(43)}` }, { link: `${origin}/studio/set-password?t=short` },
    { link: 'https://user:pass@studio-fixture.invalid/studio/set-password?t=' + 'a'.repeat(43) }]) {
    assert.deepEqual(await mail.send({ ...invitation, ...change }), { sent: false });
  }
  assert.equal(calls, 0);
});

test('partner mail uses the operator set-password link and refuses the Studio link', async () => {
  const calls = [];
  const mail = createNativeStudioMail({ env, fetchImpl: async (_url, init) => { calls.push(JSON.parse(init.body)); return Response.json({}); } });
  const token = 'c'.repeat(43);
  const link = `${origin}/partner/set-password?t=${token}`;
  assert.deepEqual(await mail.send({
    to: invitation.to, kind: 'invite', role: 'partner', link,
    operatorName: 'North & Co', roleLabel: 'Viewer "ett"',
  }), { sent: true });
  const sent = calls[0];
  assert.match(sent.subject, /Inbjudan – operatörspersonal, nivå 2/);
  assert.match(sent.text, /hos North & Co/);
  assert.match(sent.text, /med rollen Viewer "ett"/);
  assert.ok(sent.text.includes(link));
  assert.ok(sent.text.includes(`${origin}/partner/login`));
  assert.equal(sent.text.includes(`${origin}/play`), false);
  assert.doesNotMatch(sent.subject + sent.text, /adminpersonal|spelare, nivå 3|hela nivå 1/);
  assert.ok(sent.html.includes('North &amp; Co'));
  assert.ok(sent.html.includes('Viewer &quot;ett&quot;'));
  assert.equal(sent.html.includes('North & Co'), false);
  assert.equal(calls.length, 1);
  calls.length = 0;
  assert.deepEqual(await mail.send({ ...invitation, role: 'partner', kind: 'reset', link, operatorName: '', roleLabel: '' }), { sent: true });
  assert.match(calls[0].subject, /Återställ lösenord – operatörspersonal, nivå 2/);
  assert.doesNotMatch(calls[0].text, /hos |rollen/);
  let refused = 0;
  const blocked = createNativeStudioMail({ env, fetchImpl: async () => { refused += 1; return Response.json({}); } });
  assert.deepEqual(await blocked.send({ ...invitation, role: 'partner' }), { sent: false });
  assert.deepEqual(await blocked.send({ ...invitation, role: 'admin', link }), { sent: false });
  assert.equal(refused, 0);
});

test('rejected, uncertain or redirected delivery returns failure with no automatic retry', async () => {
  for (const outcome of [async () => new Response(null, { status: 401 }), async () => new Response(null, { status: 307 }),
    async () => { throw Error('private-provider-diagnostic'); }]) {
    let calls = 0;
    const mail = createNativeStudioMail({ env, fetchImpl: async (...args) => { ++calls; return outcome(...args); } });
    assert.deepEqual(await mail.send(invitation), { sent: false }); assert.equal(calls, 1);
  }
});
