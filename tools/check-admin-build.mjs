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
  const script = tags.find(tag => tag.tag === 'script' && attr(tag, 'src'));
  assert.ok(script && styles.every(style => script.index < style.index), 'theme bootstrap runs before every stylesheet');
  assert.equal(tags.filter(tag => tag.tag === 'script' && attr(tag, 'src') === attr(script, 'src')).length, 1, 'theme bootstrap is delivered once');
  assert.doesNotMatch(script.text, /\s(?:defer|async)\b|\btype\s*=/i, 'theme bootstrap runs synchronously');
  const root = tags.find(tag => tag.tag === 'html');
  assert.ok(root && attr(root, 'class')?.split(/\s+/).includes('dark'), 'dark mode works without JavaScript');
  return { styles: styles.map(tag => attr(tag, 'href')), bootstrap: attr(script, 'src') };
}

// Validate the files the document actually delivers, independent of CSS names,
// splitting or utility syntax. Keyboard focus is measured in the browser suite.
export function checkAdminArtifacts({ html, assets, tokens }) {
  const { styles, bootstrap } = documentAssets(html);
  const read = url => {
    const value = assets.get(url);
    assert.ok(value?.trim(), `${url ?? 'stylesheet href'} is missing or empty`);
    return value;
  };
  assert.equal(read(bootstrap).trim(), themeModeBootstrap, 'the built bootstrap sets the saved theme');
  const sheets = styles.map(url => parse(read(url)));
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
  const { styles, bootstrap } = documentAssets(html);
  const base = new URL('https://admin-build.invalid/admin/_assets/admin/');
  const assets = new Map([...styles, bootstrap].map(href => {
    assert.ok(href, 'stylesheet href is missing');
    const url = new URL(href, base), pathname = decodeURIComponent(url.pathname);
    assert.ok(url.origin === base.origin && pathname.startsWith(base.pathname), `asset is outside the build: ${href}`);
    const file = resolve(directory, pathname.slice(base.pathname.length));
    const path = relative(directory, file);
    assert.ok(path && !isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`), `asset is outside the build: ${href}`);
    return [href, readFileSync(file, 'utf8')];
  }));
  checkAdminArtifacts({ html, assets,
    tokens: readFileSync(resolve(repo, 'packages/ui/tokens.css'), 'utf8') });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkAdminBuild(process.argv[2]);
  console.log('Admin build: linked CSS and saved-theme delivery verified');
}
