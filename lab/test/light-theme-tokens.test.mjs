import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const labRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Dark colors from the 2026-10-08 light-theme review. Allowed in :root token blocks and [data-theme=dark]. */
const CHECKS = [
  {
    file: 'app/globals.css',
    literals: ['#0c141b', '#0f171f', '#111518', '#1a2d2a', 'rgba(17,21,24', 'rgba(17, 21, 24)'],
  },
  {
    file: 'components/studio-guide.module.css',
    literals: ['#14252b'],
  },
  {
    file: 'components/social-chat-panel.module.css',
    literals: ['#111e26'],
  },
  {
    file: 'components/control-workspace.module.css',
    literals: ['#0a0b0d', '#0A0B0D', 'rgb(10,11,13)', 'rgb(10, 11, 13)'],
  },
];

function readCss(file) {
  return readFileSync(join(labRoot, file), 'utf8');
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function rulesOf(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    while (i < css.length && css[i] !== '.' && css[i] !== '#' && css[i] !== ':' && css[i] !== '*' && css[i] !== '[' && css[i] !== '@' && !/[a-z]/i.test(css[i])) i += 1;
    if (i >= css.length) break;
    const open = css.indexOf('{', i);
    if (open < 0) break;
    let depth = 0;
    let end = open;
    for (; end < css.length; end += 1) {
      if (css[end] === '{') depth += 1;
      else if (css[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const selector = css.slice(i, open).trim();
    const body = css.slice(open + 1, end);
    if (selector.startsWith('@') && body.includes('{')) rules.push(...rulesOf(body));
    else if (selector && !selector.startsWith('@')) rules.push({ selector, body });
    i = end + 1;
  }
  return rules;
}

function isRootToken(selector) {
  return /(?:^|,)\s*:root\b/.test(selector);
}

function isDarkTheme(selector) {
  return /\[data-theme\s*=\s*["']?dark["']?\s*\]/.test(selector);
}

function isLightTheme(selector) {
  return /\[data-theme\s*=\s*["']?light["']?\s*\]/.test(selector);
}

function classesIn(selector) {
  return [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(match => match[1]);
}

function hasLightCounterpart(rules, classNames) {
  return rules.some(rule => isLightTheme(rule.selector)
    && classNames.some(name => classesIn(rule.selector).includes(name))
    && /var\(\s*--sg-/.test(rule.body));
}

test('reported dark colors use a light override or stay inside root tokens', () => {
  for (const check of CHECKS) {
    const rules = rulesOf(stripComments(readCss(check.file)));
    for (const literal of check.literals) {
      const needle = literal.toLowerCase();
      const hits = rules.filter(rule => !isRootToken(rule.selector)
        && !isDarkTheme(rule.selector)
        && !isLightTheme(rule.selector)
        && rule.body.toLowerCase().includes(needle));
      for (const hit of hits) {
        const names = classesIn(hit.selector);
        assert.ok(names.length > 0, `${check.file} hardcodes ${literal} on ${hit.selector} without a class to override`);
        assert.ok(
          hasLightCounterpart(rules, names),
          `${check.file} hardcodes ${literal} on ${hit.selector} without a [data-theme=light] rule that uses var(--sg-)`,
        );
      }
    }
  }
});

test('body and partner shell follow --sg-bg instead of a hardcoded ink background', () => {
  const globals = stripComments(readCss('app/globals.css'));
  const body = globals.match(/body\{[^}]*\}/);
  assert.ok(body, 'body rule missing');
  assert.match(body[0], /background:\s*var\(\s*--sg-bg\b/);
  assert.doesNotMatch(body[0], /#0a0b0d|rgb\(\s*10\s*,\s*11\s*,\s*13\s*\)/i);

  const workspace = stripComments(readCss('components/control-workspace.module.css'));
  const shell = workspace.match(/\.shell\s*\{[^}]*\}/);
  assert.ok(shell, '.shell rule missing');
  assert.match(shell[0], /background:\s*var\(\s*--sg-bg\b/);
  assert.doesNotMatch(shell[0], /#0a0b0d|rgb\(\s*10\s*,\s*11\s*,\s*13\s*\)/i);
});
