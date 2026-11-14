import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const minificador = fileURLToPath(new URL('../tools/minificar_html.mjs', import.meta.url));
const programa = [
  '// comentário JavaScript removível',
  'var texto = `first\n// visible data\nlast`;',
  'var cru = String.raw`first\n/* content */\nlast\\n`;',
  'var shader = `void main() {\n// shader comment\n/* another comment */\n}`;',
  'var primeiro = 40;',
].join('\n');

function executarScripts(html) {
  const contexto = vm.createContext({});
  for (const [, atributos, codigo] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi))
    if (!/\btype\s*=/.test(atributos)) vm.runInContext(codigo, contexto);
  return JSON.parse(vm.runInContext('JSON.stringify({texto, cru, shader, resultado})', contexto));
}

test('minificação preserva strings, String.raw e GLSL e globais entre scripts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'minificar-html-'));
  try {
    const entrada = join(dir, 'entrada.html'), saida = join(dir, 'saida.html');
    const dados = '<script type="application/json">{"texto":"/* dado */"}</script>';
    const html = `<!-- comentário HTML --><style>/* comentário CSS */ body { color: red; }</style>
      <script>${programa}</script>${dados}<script>var resultado = primeiro + 2;</script>`;
    writeFileSync(entrada, html);
    execFileSync(process.execPath, [minificador, entrada, saida], {encoding: 'utf8'});
    const minificado = readFileSync(saida, 'utf8');
    assert.deepEqual(executarScripts(minificado), executarScripts(html));
    assert.ok(minificado.includes(dados), 'bloco de dados intacto');
    assert.ok(!minificado.includes('comentário HTML'));
    assert.ok(!minificado.includes('comentário CSS'));
    assert.ok(!minificado.includes('comentário JavaScript removível'));
    assert.ok(minificado.length < html.length);
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
});
