import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/assets', { recursive: true });
await build({ entryPoints: ['src/main.tsx'], bundle: true, minify: true, outdir: 'dist/assets', entryNames: 'app', define: { 'process.env.NODE_ENV': '"production"' } });
await copyFile('index.html', 'dist/index.html');
