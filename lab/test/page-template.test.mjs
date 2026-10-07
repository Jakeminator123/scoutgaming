import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageTemplate, UnsavedBar } from '../components/page-template.mjs';

test('page template renders eyebrow, title and intro without empty slots', () => {
  const html = renderToStaticMarkup(React.createElement(PageTemplate, {
    eyebrow: '// STUDIO',
    title: 'Dealers & klipp',
    intro: 'Välj dealer.',
    children: 'body',
  }));
  assert.match(html, /class="sg-eyebrow"/);
  assert.match(html, /\/\/ STUDIO/);
  assert.match(html, /<h1>Dealers &amp; klipp<\/h1>/);
  assert.match(html, /Välj dealer\./);
  assert.match(html, /body/);
  assert.doesNotMatch(html, /sg-page-actions|class="sg-tabs"/);
});

test('page template renders primary, status and tabs when provided', () => {
  const html = renderToStaticMarkup(React.createElement(PageTemplate, {
    eyebrow: '// OPENCLAW',
    title: 'Agentmodeller',
    intro: 'En rad.',
    primary: React.createElement('button', { type: 'button', className: 'sg-btn sg-btn-primary' }, 'Hämta aktuella val'),
    status: React.createElement('span', { className: 'sg-pill sg-pill-sparad' }, 'Sparad'),
    tabs: React.createElement('button', { type: 'button' }, 'Idle'),
  }));
  assert.match(html, /sg-btn-primary/);
  assert.match(html, /Hämta aktuella val/);
  assert.match(html, /sg-pill-sparad/);
  assert.match(html, /Sparad/);
  assert.match(html, /class="sg-tabs"/);
  assert.match(html, /Idle/);
});

test('unsaved bar shows the change count and both actions', () => {
  let saved = 0, undone = 0;
  const html = renderToStaticMarkup(React.createElement(UnsavedBar, {
    count: 3,
    onSave() { saved += 1; },
    onUndo() { undone += 1; },
  }));
  assert.match(html, /3 ändringar/);
  assert.match(html, /Spara alla/);
  assert.match(html, /Ångra/);
  assert.equal(saved, 0);
  assert.equal(undone, 0);
});
