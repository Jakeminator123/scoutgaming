import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as navigation from '../../../packages/navigation/admin-navigation.mjs';
import { jsxRequire } from './fixtures/jsx-require.mjs';

const browserModule = process.env.CROUPIER_BROWSER_FIXTURE_MODULE;

// Render the current menus, not a copy of their classes or a source-CSS cascade.
function menus() {
  const admin = new URL('../client/admin/components/studio/studio-sidebar.tsx', import.meta.url);
  const { StudioMenu } = jsxRequire(admin, {
    'next/link': { __esModule: true, default: 'a' }, 'next/navigation': { usePathname: () => '/admin' },
    '../../lib/admin-navigation': navigation,
    './admin-logout': { AdminLogout: () => null }, './theme-toggle': { ThemeToggle: () => null },
  })('./studio-sidebar.tsx');
  const partner = new URL('../components/partner/partner-operator-workspace.jsx', import.meta.url);
  const { PartnerOperatorWorkspace } = jsxRequire(partner, {
    '../partner-session-actions': jsxRequire(partner)('../partner-session-actions.tsx'),
    './views/team.jsx': { TeamView: () => null },
  })('./partner-operator-workspace.jsx');
  const operator = { id: 'focus-fixture', slug: 'focus-fixture', name: 'Fokusprov' };
  return {
    admin: renderToStaticMarkup(React.createElement(StudioMenu)),
    partner: renderToStaticMarkup(React.createElement(PartnerOperatorWorkspace, {
      surface: 'partner', user: 'focus-fixture', apiBase: '/fixture/snapshot',
      initialSnapshot: { preview: false, operator, operators: [operator], tables: [], team: [], permissions: ['overview.read'] },
    })),
  };
}

function contrast(color, background) {
  const rgba = text => text.match(/[\d.]+/g).map(Number);
  const fg = rgba(color), bg = rgba(background), alpha = fg[3] ?? 1;
  const luminance = rgb => rgb.slice(0, 3).map(value => {
    const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const [light, dark] = [luminance(fg.map((value, index) => value * alpha + bg[index] * (1 - alpha))), luminance(bg)].sort((a, b) => b - a);
  return (light + .05) / (dark + .05);
}

test('selected Admin and partner menu entries retain keyboard focus contrast in both themes and forced colours', { skip: !browserModule }, async () => {
  const require = createRequire(new URL('../client/package.json', import.meta.url));
  const postcss = require('postcss'), tailwind = require('@tailwindcss/postcss');
  const globals = new URL('../client/admin/app/globals.css', import.meta.url);
  const css = (await postcss([tailwind({ base: fileURLToPath(new URL('../client/admin/', import.meta.url)) })])
    .process(await readFile(globals, 'utf8'), { from: fileURLToPath(globals) })).css
    + await readFile(new URL('../components/partner/partner-portal.css', import.meta.url), 'utf8');
  const html = menus();
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const browser = await chromium.launch({ headless: true, ...(process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL ? { channel: process.env.CROUPIER_BROWSER_FIXTURE_CHANNEL } : {}) });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/theme.css') return route.fulfill({ contentType: 'text/css', body: css });
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html class="' + url.searchParams.get('mode') + '"><head><link rel="stylesheet" href="/theme.css"></head><body><button>Före</button>' + html[url.searchParams.get('surface')] + '</body></html>' });
    });
    for (const forcedColors of ['none', 'active']) for (const mode of ['dark', 'light']) for (const surface of ['admin', 'partner']) {
      await page.emulateMedia({ forcedColors });
      await page.goto('https://menu-focus.fixture.invalid/?surface=' + surface + '&mode=' + mode);
      const selected = page.locator('nav a[aria-current="page"]').first(), label = [surface, mode, forcedColors].join('/');
      const textSamples = await page.locator('aside').evaluateAll(sidebars => {
        const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const rgba = color => {
          context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
          return [r, g, b, a / 255];
        };
        const over = (fg, bg) => {
          const alpha = fg[3] + bg[3] * (1 - fg[3]);
          return alpha ? [...fg.slice(0, 3).map((value, index) => (value * fg[3] + bg[index] * bg[3] * (1 - fg[3])) / alpha), alpha] : [0, 0, 0, 0];
        };
        const samples = [];
        for (const sidebar of sidebars) {
          const walker = document.createTreeWalker(sidebar, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const node = walker.currentNode, element = node.parentElement, text = node.textContent.trim();
            if (!text || !element.checkVisibility() || element.closest('[aria-hidden="true"],svg')) continue;
            let foreground = rgba(getComputedStyle(element).color), background = [0, 0, 0, 0];
            for (let parent = element; parent; parent = parent.parentElement) {
              const css = getComputedStyle(parent), fill = rgba(css.backgroundColor);
              foreground = over(foreground, fill); background = over(background, fill);
              foreground[3] *= Number(css.opacity); background[3] *= Number(css.opacity);
            }
            foreground = over(foreground, [255, 255, 255, 1]).slice(0, 3);
            background = over(background, [255, 255, 255, 1]).slice(0, 3);
            samples.push({ text, color: `rgb(${foreground.join(',')})`, background: `rgb(${background.join(',')})` });
          }
        }
        return samples;
      });
      assert.ok(textSamples.length > 0, label + ': sidebar text was measured');
      for (const sample of textSamples) assert.ok(contrast(sample.color, sample.background) >= 4.5, label + ': ' + sample.text + ' reaches 4.5:1');

      await selected.focus();
      await page.keyboard.press('Shift+Tab');
      const style = () => selected.evaluate(node => {
        const css = getComputedStyle(node);
        let surface = parseFloat(css.outlineOffset) < 0 ? node : node.parentElement, background;
        while (surface) {
          background = getComputedStyle(surface).backgroundColor;
          if (background !== 'transparent' && !/^rgba\([^)]*,\s*0\)$/.test(background)) break;
          surface = surface.parentElement;
        }
        return { outline: css.outline, outlineStyle: css.outlineStyle, width: parseFloat(css.outlineWidth), color: css.outlineColor, shadow: css.boxShadow, background };
      });
      const idle = await style();
      await page.keyboard.press('Tab');
      assert.ok(await selected.evaluate(node => document.activeElement === node), label + ': Tab reaches the selected entry');
      await selected.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
      const focused = await style(), colors = [];
      if (focused.outline !== idle.outline && focused.width > 0 && !['none', 'hidden'].includes(focused.outlineStyle)) colors.push(focused.color);
      if (focused.shadow !== idle.shadow) for (const match of focused.shadow.matchAll(/(rgba?\([^)]+\)) ([^,]+)/g)) {
        if (!idle.shadow.includes(match[0]) && !match[2].includes('inset') && (match[2].match(/-?[\d.]+px/g) ?? []).some(value => parseFloat(value) > 0)) colors.push(match[1]);
      }
      assert.ok(colors.some(color => contrast(color, focused.background) >= 3), label + ': focused menu entry has 3:1 contrast: ' + JSON.stringify(focused));
    }
  } finally { await browser.close(); }
});
