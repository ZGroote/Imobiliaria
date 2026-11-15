import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pasta = path.dirname(fileURLToPath(import.meta.url));
const threeDir = 'C:/Users/respawn/Desktop/imobiliaria/experimentos/liv-experimental-2026-10-14/node_modules/three';
const esbuildDir = 'C:/Users/respawn/Desktop/imobiliaria/node_modules/esbuild';
const three = JSON.parse(await readFile(path.join(threeDir, 'package.json'), 'utf8'));
const threeLicense = await readFile(path.join(threeDir, 'LICENSE'));
const esbuildPackage = JSON.parse(await readFile(path.join(esbuildDir, 'package.json'), 'utf8'));
if (three.version !== '0.186.1') throw new Error(`Three.js esperado 0.186.1; encontrado ${three.version}.`);

const esbuildModule = await import(pathToFileURL(path.join(esbuildDir, 'lib/main.js')).href);
const build = esbuildModule.build || esbuildModule.default.build;
const resultado = await build({
  absWorkingDir: pasta,
  entryPoints: ['entrada.js'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  treeShaking: true,
  legalComments: 'eof',
  nodePaths: [path.dirname(threeDir)],
  write: false,
  logLevel: 'silent',
});
const bundle = resultado.outputFiles[0].contents;
if (bundle.byteLength >= 1024 * 1024) throw new Error(`Bundle excede 1 MiB: ${bundle.byteLength} bytes.`);
const sha256 = createHash('sha256').update(bundle).digest('hex');
const metadata = {
  three: three.version,
  esbuild: esbuildPackage.version,
  arquivo: 'three-viabilidade.min.js',
  formato: 'esm',
  tamanho_bytes: bundle.byteLength,
  sha256,
  license_sha256: createHash('sha256').update(threeLicense).digest('hex'),
};

await mkdir(pasta, { recursive: true });
await writeFile(path.join(pasta, 'three-viabilidade.min.js'), bundle);
await writeFile(path.join(pasta, 'LICENSE-three.txt'), threeLicense);
await writeFile(path.join(pasta, 'three-viabilidade.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`${metadata.arquivo}: ${metadata.tamanho_bytes} bytes · SHA-256 ${sha256}`);
