import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
await build({entryPoints:[fileURLToPath(new URL('../browser/public-assistant.mjs',import.meta.url))],
 outdir:fileURLToPath(new URL('../public',import.meta.url)),entryNames:'public-assistant',chunkNames:'did-chunks/[name]-[hash]',splitting:true,
 bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
