import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createSeedProject } from '../lib/studio-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('next/dist/build/swc');
const empty = () => null;
const mocks = {
  './event-tree': { EventTree: empty },
  './stage': { Stage: empty },
  './social-chat-panel': { SocialChatPanel: empty },
  './trigger-editor': { TriggerEditor: empty, categoryLabels: {}, defaultValue: () => null },
  './video-library': { VideoLibrary: empty, VariantVideoBinding: empty },
  './gateway-panel': { GatewayPanel: empty, ModeSelector: empty, modeLabels: { rules: 'Regler' } },
  './test-context': { TestContextPanel: empty, neutralContext: {} },
};
function loadComponent(relativeFile) {
  const source = readFileSync(new URL(relativeFile, import.meta.url), 'utf8');
  const output = transformSync(source, { filename: relativeFile, jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  const module = { exports: {} };
  vm.runInNewContext(output.code, {
    module, exports: module.exports, structuredClone,
    require: name => name.endsWith('.module.css') ? { __esModule: true, default: {} }
      : name === './studio-types' ? loadComponent('./studio-types.ts')
        : mocks[name] ?? require(name),
  }, { filename: relativeFile });
  return module.exports;
}
const { Studio } = loadComponent('./studio.tsx');
const render = project => renderToStaticMarkup(React.createElement(Studio, { initialProject: project, initialVideos: { videos: [] }, initialStatus: {} }));

test('legacy incompatible selections are visible with a repair action and are not silently changed', () => {
  const project = createSeedProject();
  const event = project.events[0];
  const line = project.lines.find(item => item.dealerId === 'astrid' && item.eventId === event.id);
  const incompatible = project.assets.find(item => item.animation === 'deal-left');
  line.variants[0].assetId = incompatible.id;
  const before = JSON.stringify(project);
  const html = render(project);
  assert.match(html, /1 animationskopplingar behöver rättas/);
  assert.match(html, /Rätta första kopplingen/);
  assert.match(html, /Inget har ändrats automatiskt/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /disabled="" selected=""/);
  assert.match(html, /behöver bytas \(matchar inte eventet\)/);
  assert.equal(JSON.stringify(project), before);
});

test('normal seed does not show a repair warning or invalid animation option', () => {
  const html = render(createSeedProject());
  assert.doesNotMatch(html, /animationskopplingar behöver rättas/);
  assert.doesNotMatch(html, /behöver bytas \(matchar inte eventet\)/);
  assert.match(html, /aria-invalid="false"/);
});

test('repair banner counts problems outside the currently selected dealer and event', () => {
  const project = createSeedProject();
  const wave = project.assets.find(item => item.animation === 'wave');
  for (const dealerId of ['vera', 'mei']) {
    const line = project.lines.find(item => item.dealerId === dealerId && item.eventId === 'deal.player.left');
    line.variants[0].assetId = wave.id;
  }
  assert.match(render(project), /2 animationskopplingar behöver rättas/);
});

test('editor labels align with the selected node and distinguish event-test context from social chat', () => {
  const html = render(createSeedProject());
  assert.match(html, /Redigera vald nod/);
  assert.match(html, /Samma nod som i nodträdet/);
  assert.match(html, /Så väljs variant när du testar ett event/);
  assert.match(html, /<details class="event-test-tools"><summary>Regeltest &amp; OpenClaw/);
  assert.match(html, /Prova spelarchatten → Astrids vänteläge/);
  assert.doesNotMatch(html, /Din regi|En tydlig kedja, hela vägen/);
  const { TestContextPanel, neutralContext } = loadComponent('./test-context.tsx');
  const contextHtml = renderToStaticMarkup(React.createElement(TestContextPanel, { value: neutralContext, onChange() {} }));
  assert.match(contextHtml, /Simulera kontext för eventtest/);
  assert.match(contextHtml, /inte OpenClaws verkliga minne eller Astrids personlighet/);
  assert.match(contextHtml, /spelarchatten med Astrid använder inte dessa fält/);
  assert.doesNotMatch(contextHtml, /Vad vet croupiern just nu/);
});
