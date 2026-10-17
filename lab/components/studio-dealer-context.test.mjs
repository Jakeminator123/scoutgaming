import {createLegacyProject} from '../test/fixtures/legacy-project.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { addDealer, createSeedProject, normalizeProject } from '../../packages/presentation/contracts/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
function loadTs(fileUrl, overrides = {}) {
  const source = readFileSync(fileUrl, 'utf8');
  const output = transformSync(source, { filename: fileURLToPath(fileUrl), jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} }, localRequire = createRequire(fileUrl);
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone, URL, URLSearchParams, Request, Headers,
    window: new Proxy({}, { get: (_target, key) => globalThis.window?.[key] }),
    require: name => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === './gateway-panel') return { modeLabels: {}, modeExplanations: {}, GatewayPanel: () => null };
      if (name.startsWith('./') || name.startsWith('../')) {
        for (const suffix of ['', '.tsx', '.ts', '.mjs', '.js']) {
          const candidate = new URL(name + suffix, fileUrl), path = fileURLToPath(candidate);
          if (!existsSync(path)) continue;
          return /\.(mjs|js|json)$/.test(path) ? localRequire(path) : loadTs(candidate, overrides);
        }
      }
      return localRequire(name);
    },
  }, { filename: fileURLToPath(fileUrl) });
  return module.exports;
}

test('PAOW event editor keeps clip identity in every dealer tab and shows no Astrid chat', () => {
  const { ControlEventsPage } = loadTs(new URL('./control-events-page.tsx', import.meta.url));
  const project = addDealer(createSeedProject(), 'paow', 'PAOW');
  const variant = project.lines.find(line => line.dealerId === 'paow' && line.eventId === 'deal.player.right').variants[0];
  const html = renderToStaticMarkup(React.createElement(ControlEventsPage, {
    initialProject: project, initialVideos: { videos: [] }, initialStatus: { configured: false },
    initialDealerId: 'paow', initialEventId: 'deal.player.right', initialVariantId: variant.id, initialSituation: 'box6', initialTab: 'triggers',
  }));
  assert.match(html, /aria-label="Studio för PAOW"/);
  const nav = html.match(/<nav aria-label="Studio för PAOW"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  const links = [...nav.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&'), 'https://studio.invalid'));
  assert.equal(links.length, 7);
  assert.equal(links.filter(link => link.pathname.endsWith('/control/compositions')).length, 0);
  assert.equal(links.filter(link=>link.pathname.endsWith('/control/replies')).length,1);
  for (const link of links) {
    assert.equal(link.searchParams.get('dealer'), 'paow');
    assert.equal(link.searchParams.get('event'), 'deal.player.right');
    assert.equal(link.searchParams.get('variant'), variant.id);
    assert.equal(link.searchParams.get('situation'), 'box6');
  }
  assert.doesNotMatch(html, /ASTRID · SOCIALT LABBSVAR|Meddelande till Astrid|aria-label="Chatt med Astrid"/);
});

test('switching away from Astrid hides her chat and an already prepared social reply', () => {
  const { EventsPreview } = loadTs(new URL('./events-preview.tsx', import.meta.url), {
    './social-chat-panel': { SocialChatPanel: () => React.createElement('aside', { 'data-social-chat': 'astrid' }) },
  });
  const props = { isIdleEditor: true, managed: false, observedStep: null, showStage: false, showTest: false,
    socialReply: 'ASTRID PRIVATE REPLY', isIdleCopy: true, social: { dealerId: 'astrid', eventId: 'social.chat' },
  };
  const astrid = renderToStaticMarkup(React.createElement(EventsPreview, { ...props, dealerId: 'astrid' }));
  assert.match(astrid, /data-social-chat="astrid"/);
  assert.match(astrid, /ASTRID PRIVATE REPLY/);
  for (const dealerId of ['paow', 'vera', 'amira', 'mei']) {
    const other = renderToStaticMarkup(React.createElement(EventsPreview, { ...props, dealerId }));
    assert.doesNotMatch(other, /data-social-chat|ASTRID PRIVATE REPLY|ASTRID · SOCIALT LABBSVAR|Visa chatten/);
  }
});

test('authenticated administration route forwards the first selected dealer to the review workspace', async () => {
  const config = { apiBase: '/studio/api/admin', allowedOrigins: ['https://studio.invalid'] };
  const Page = loadTs(new URL('../app/control/administration/page.tsx', import.meta.url), {
    'next/headers': { headers: async () => new Headers({ host: 'studio.invalid' }) },
    'next/navigation': { redirect: () => assert.fail('Authenticated fixture should not redirect') },
    '@/components/native-administration': { NativeAdministration: () => null },
    '@/components/studio-types':loadTs(new URL('./studio-types.ts',import.meta.url)),
    '../public-redirect':{redirectToPublicControl:()=>assert.fail('media review remains an administration view')},
    '@/lib/studio-native-request.mjs': { normalizeNativeStudioPageRequest: request => request },
    '@/lib/studio-native-runtime.mjs': {
      nativeStudioAdminConfiguration: () => config,
      assertNativeStudioRequest: () => {},
      studioNativeRuntime: async () => ({ config, authorize: async () => ({ role: 'admin' }), api: { availableActions: () => [] } }),
    },
    '@/lib/next-page-navigation.mjs': { nextStudioLoginRedirect: () => '/control/login' },
  }).default;
  const page = await Page({ searchParams: Promise.resolve({ tab: 'media-review', dealer: ['paow', 'astrid'] }) });
  assert.equal(page.props.initialGroup, 'media-review');
  assert.equal(page.props.initialDealerId, 'paow');
});


test('retired dealer links and active pickers are rejected without deleting saved dealer history',()=>{
  const project=normalizeProject(createLegacyProject()),before=structuredClone(project);
  assert.ok(project.dealers.some(row=>row.id==='amira'));
  const {activeStudioDealers,resolveStudioDealerId}=loadTs(new URL('./studio-types.ts',import.meta.url));
  assert.equal(resolveStudioDealerId(project,'amira'),'');
  assert.equal(activeStudioDealers(project).some(row=>row.id==='amira'),false);
  const overrides={'next/navigation':{usePathname:()=>'/control/events',useSearchParams:()=>new URLSearchParams('dealer=amira')},
    './studio-session':{useStudioSession:()=>assert.fail('retired selection cannot enter a dealer editor')}};
  for(const [file,name] of [['control-events-page','ControlEventsPage'],['control-tree-page','ControlTreePage'],['control-probe-page','ControlProbePage'],['control-videos-page','ControlVideosPage'],['control-openclaw-chat','ControlOpenClawChat'],['control-activity-page','ControlActivityPage']]){
    const Component=loadTs(new URL('./'+file+'.tsx',import.meta.url),overrides)[name];
    assert.equal(typeof Component,'function',name);
    const html=renderToStaticMarkup(React.createElement(Component,{initialProject:project,initialVideos:{videos:[]},initialStatus:{configured:false},initialDealerId:'amira'}));
    assert.match(html,/Välj (en )?dealer/i,name);
    assert.doesNotMatch(html,/dealer=amira|Studio för Amira|aria-label="Chatt med Amira"/,name);
    assert.match(html,/dealer=astrid/,name);
  }
  assert.deepEqual(project,before,'UI selection must preserve stored dealer, media and line history');
});
