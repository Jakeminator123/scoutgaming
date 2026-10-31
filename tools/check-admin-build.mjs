import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { themeModeBootstrap } from '../apps/studio/lib/theme-mode.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const { parse } = createRequire(new URL('../apps/studio/client/package.json', import.meta.url))('postcss');

const tokenValues = css => {
  const modes = new Map();
  parse(css).walkRules(rule => {
    if (![':root', ':root.light'].includes(rule.selector)) return;
    const values = modes.get(rule.selector) ?? new Map();
    rule.each(node => { if (node.type === 'decl' && node.prop.startsWith('--sg-')) values.set(node.prop, node.value); });
    modes.set(rule.selector, values);
  });
  return modes;
};

// Runs after the existing Studio build. Ordinary regression tests exercise this
// validator with fixtures; a missing real artifact is an error, never a skip.
export function checkAdminArtifacts({ html, theme, app, bootstrap, tokens }) {
  for (const [name, value] of Object.entries({ html, theme, app, bootstrap })) assert.ok(value?.trim(), `${name} is empty`);
  assert.equal(bootstrap.trim(), themeModeBootstrap, 'the built bootstrap sets the saved theme');
  const tags = [...html.matchAll(/<(script|link|html)\b[^>]*>/gi)].map(match => ({ tag: match[1].toLowerCase(), text: match[0], index: match.index }));
  const attr = (tag, name) => tag.text.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
  const styles = tags.filter(tag => tag.tag === 'link' && attr(tag, 'rel') === 'stylesheet');
  for (const name of ['theme.css', 'app.css']) assert.ok(styles.some(tag => attr(tag, 'href') === `/admin/_assets/admin/${name}`), `${name} is linked`);
  const scripts = tags.filter(tag => tag.tag === 'script' && attr(tag, 'src') === '/admin/_assets/admin/theme-mode.js');
  assert.equal(scripts.length, 1, 'one theme bootstrap is delivered');
  const script = scripts[0];
  assert.ok(styles.every(style => script.index < style.index), 'theme bootstrap runs before every stylesheet');
  assert.doesNotMatch(script.text, /\s(?:defer|async)\b|\btype\s*=/i, 'theme bootstrap runs synchronously');
  const root = tags.find(tag => tag.tag === 'html');
  assert.ok(root && attr(root, 'class')?.split(/\s+/).includes('dark'), 'dark mode works without JavaScript');

  const css = parse(theme);
  for (const sheet of [css, parse(app)]) sheet.walkAtRules(rule => {
    assert.ok(!['import', 'tailwind', 'apply', 'theme', 'source', 'custom-variant', 'utility', 'variant', 'reference'].includes(rule.name), `uncompiled @${rule.name}`);
    assert.doesNotMatch(rule.params, /prefers-color-scheme/, 'theme follows the saved choice');
  });
  const delivered = tokenValues(theme);
  for (const [mode, values] of tokenValues(tokens)) for (const [name, value] of values) {
    assert.equal(delivered.get(mode)?.get(name), value, `${mode}: ${name} reaches theme.css`);
  }

  // outline:none loses keyboard focus in Windows forced-colours mode. Keep the
  // transparent outline override, including its extra specificity, for each
  // generated outline-none utility. A compiler may preserve or flatten nesting.
  const effectiveSelector = rule => {
    let parent = rule.parent;
    while (parent && parent.type !== 'rule') parent = parent.parent;
    if (!parent) return rule.selector;
    const outer = effectiveSelector(parent);
    return rule.selector.includes('&') ? rule.selector.replaceAll('&', outer) : `${outer} ${rule.selector}`;
  };
  const outlines = [];
  css.walkRules(rule => {
    const selector = effectiveSelector(rule);
    if (!selector.includes('outline-none')) return;
    const values = new Map();
    rule.each(node => { if (node.type === 'decl') values.set(node.prop, node.value); });
    outlines.push({selector, values});
  });
  for (const selector of ['.outline-none', '.focus-visible\\:outline-none']) {
    assert.ok(outlines.some(rule => rule.selector.startsWith(selector)
      && /^(?::focus-visible)?:not\(\.[^)]+\)(?::focus-visible)?$/.test(rule.selector.slice(selector.length))
      && rule.values.get('outline') === '2px solid transparent' && rule.values.get('outline-offset') === '2px'),
    `${selector} retains its forced-colours focus outline`);
  }
}

export function checkAdminBuild(directory = resolve(repo, 'apps/studio/design-preview-build/admin')) {
  const read = name => readFileSync(resolve(directory, name), 'utf8');
  checkAdminArtifacts({ html: read('index.html'), theme: read('theme.css'), app: read('app.css'), bootstrap: read('theme-mode.js'),
    tokens: readFileSync(resolve(repo, 'packages/ui/tokens.css'), 'utf8') });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkAdminBuild(process.argv[2]);
  console.log('Admin build: CSS, theme delivery and forced-colours focus verified');
}
