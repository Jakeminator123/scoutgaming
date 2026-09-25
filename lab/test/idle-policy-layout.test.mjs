import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../components/idle-policy-editor.module.css', import.meta.url), 'utf8');
const globals = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
const tokens = new Map([...globals.matchAll(/(--[\w-]+):([^;{}]+)/g)].map(match => [match[1], match[2]]));

test('idle editor uses defined shared theme tokens instead of white fallback surfaces', () => {
  for (const [, token] of css.matchAll(/var\((--[\w-]+)/g)) assert.ok(tokens.has(token), `Undefined theme token ${token}`);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b/i, 'Use the lab palette, not an independent light theme');
});

function luminance(token) {
  const hex = tokens.get(token).trim().slice(1);
  assert.equal(hex.length, 6);
  const channels = hex.match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

test('idle text, hints and accent text have readable contrast on the chosen surfaces', () => {
  for (const foreground of ['--text', '--muted', '--teal']) {
    for (const background of ['--bg', '--panel', '--panel-soft', '--panel-hover']) {
      const light = luminance(foreground), dark = luminance(background);
      assert.ok((light + .05) / (dark + .05) >= 4.5, `${foreground} on ${background} must meet 4.5:1`);
    }
  }
});
