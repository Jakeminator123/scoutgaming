import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

// Node's require reads a .jsx file only when it contains no JSX syntax. The
// portal's views are written as JSX, so tests load them through swc, the same
// compiler Next uses, with CommonJS output; .mjs imports resolve through
// require(esm). `overrides` replaces a specifier wherever it is imported.
const base = createRequire(import.meta.url);
const { transformSync } = base('next/dist/build/swc');
const compiled = new WeakMap();

export function jsxRequire(fromUrl, overrides = {}) {
  const local = createRequire(fromUrl);
  let cache = compiled.get(overrides);
  if (!cache) compiled.set(overrides, cache = new Map());
  return function require(name) {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.endsWith('.css')) return {};
    if (!name.endsWith('.jsx') && !name.endsWith('.tsx')) return local(name);
    const file = local.resolve(name);
    if (cache.has(file)) return cache.get(file).exports;
    const typescript = file.endsWith('.tsx');
    const { code } = transformSync(readFileSync(file, 'utf8'), { filename: file,
      jsc: { parser: typescript ? { syntax: 'typescript', tsx: true } : { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
      module: { type: 'commonjs' } });
    const module = { exports: {} };
    cache.set(file, module);
    const run = vm.runInThisContext(`(function (require, module, exports) {${code}\n})`, { filename: file });
    run(jsxRequire(pathToFileURL(file), overrides), module, module.exports);
    return module.exports;
  };
}
