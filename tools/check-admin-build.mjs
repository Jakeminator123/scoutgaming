import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { themeModeBootstrap } from '../apps/studio/lib/theme-mode.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const { parse } = createRequire(new URL('../apps/studio/client/package.json', import.meta.url))('postcss');

const tokenValues = css => {
  const modes = new Map();
  parse(css).walkRules(rule => {
    for (const selector of rule.selectors.filter(selector => [':root', ':root.light'].includes(selector))) {
      const values = modes.get(selector) ?? new Map();
      rule.each(node => { if (node.type === 'decl' && node.prop.startsWith('--sg-')) values.set(node.prop, node.value); });
      modes.set(selector, values);
    }
  });
  return modes;
};

function documentAssets(html) {
  assert.ok(html?.trim(), 'html is empty');
  const tags = [...html.matchAll(/<(script|link|html)\b[^>]*>/gi)].map(match => ({ tag: match[1].toLowerCase(), text: match[0], index: match.index }));
  const attr = (tag, name) => tag.text.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
  const styles = tags.filter(tag => tag.tag === 'link' && attr(tag, 'rel')?.split(/\s+/).includes('stylesheet'));
  assert.ok(styles.length, 'compiled CSS is linked');
  const root = tags.find(tag => tag.tag === 'html');
  assert.ok(root && attr(root, 'class')?.split(/\s+/).includes('dark'), 'dark mode works without JavaScript');
  return {
    styles: styles.map(tag => ({ href: attr(tag, 'href'), index: tag.index })),
    scripts: tags.filter(tag => tag.tag === 'script' && attr(tag, 'src')).map(tag => ({ ...tag, src: attr(tag, 'src'), type: attr(tag, 'type') })),
  };
}

// Validate the files the document actually delivers, independent of CSS names,
// splitting or utility syntax. Keyboard focus is measured in the browser suite.
export function checkAdminArtifacts({ html, assets, tokens }) {
  const { styles, scripts } = documentAssets(html);
  const read = url => {
    const value = assets.get(url);
    assert.ok(value?.trim(), `${url ?? 'stylesheet href'} is missing or empty`);
    return value;
  };
  const bootstraps = scripts.filter(script => assets.get(script.src)?.trim() === themeModeBootstrap);
  assert.equal(bootstraps.length, 1, 'one current bootstrap sets the saved theme');
  const bootstrap = bootstraps[0];
  assert.ok(styles.every(style => bootstrap.index < style.index), 'theme bootstrap runs before every stylesheet');
  assert.doesNotMatch(bootstrap.text, /\s(?:defer|async)(?:\s|=|>)/i, 'theme bootstrap runs synchronously');
  assert.ok(!bootstrap.type || /^(?:text|application)\/(?:java|ecma)script$/i.test(bootstrap.type), 'theme bootstrap runs synchronously');
  const sheets = styles.map(style => parse(read(style.href)));
  for (const sheet of sheets) sheet.walkAtRules(rule => {
    assert.ok(!['import', 'tailwind', 'apply', 'theme', 'source', 'custom-variant', 'utility', 'variant', 'reference'].includes(rule.name), `uncompiled @${rule.name}`);
    assert.doesNotMatch(rule.params, /prefers-color-scheme/, 'theme follows the saved choice');
  });
  const delivered = tokenValues(sheets.map(sheet => sheet.toString()).join('\n'));
  for (const [mode, values] of tokenValues(tokens)) for (const [name, value] of values) {
    assert.equal(delivered.get(mode)?.get(name), value, `${mode}: ${name} reaches linked CSS`);
  }
}

export function checkAdminBuild(directory = resolve(repo, 'apps/studio/design-preview-build/admin')) {
  const html = readFileSync(resolve(directory, 'index.html'), 'utf8');
  const { styles, scripts } = documentAssets(html);
  const base = new URL('https://admin-build.invalid/admin/_assets/admin/');
  const assets = new Map();
  const readAsset = (href, required) => {
    assert.ok(href, 'stylesheet href is missing');
    const url = new URL(href, base), pathname = decodeURIComponent(url.pathname);
    const local = url.origin === base.origin && pathname.startsWith(base.pathname);
    if (!required && !local) return;
    assert.ok(local, `asset is outside the build: ${href}`);
    const file = resolve(directory, pathname.slice(base.pathname.length));
    const path = relative(directory, file);
    assert.ok(path && !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`), `asset is outside the build: ${href}`);
    assets.set(href, readFileSync(file, 'utf8'));
  };
  for (const style of styles) readAsset(style.href, true);
  for (const script of scripts) readAsset(script.src, false);
  checkAdminArtifacts({ html, assets,
    tokens: readFileSync(resolve(repo, 'packages/ui/tokens.css'), 'utf8') });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkAdminBuild(process.argv[2]);
  console.log('Admin build: linked CSS and saved-theme delivery verified');
}
