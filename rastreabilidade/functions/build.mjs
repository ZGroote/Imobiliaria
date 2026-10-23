import {build} from 'esbuild'
await build({entryPoints:[new URL('index.mjs',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,'')],
  outfile:new URL('lib/index.mjs',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,''),
  bundle:true,platform:'node',target:'node22',format:'esm',packages:'external',sourcemap:false})
