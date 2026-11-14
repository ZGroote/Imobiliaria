// Cedros PBR: o LEVE publicado + os acabamentos do guia (relatorios/padrao-acabamentos-pbr),
// derivado sem tocar no gerador. Uso:
//   node experimentos/cedros-pbr-2026-10-04/montar.mjs --assets <assets preparados> --destino <pasta nova>
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validarAssets } from '../piloto-qualidade-visual-2026-10-04/montar.mjs';

const pasta = dirname(fileURLToPath(import.meta.url)), raiz = resolve(pasta, '../..');
const sha256 = b => createHash('sha256').update(b).digest('hex');
const json = x => JSON.stringify(x).replaceAll('<', '\\u003c');
const PAGINA = 'maquete-monte-dos-cedros-37.html';
// O LEVE de medir_rede.py; o hash trava a base para a comparação de desempenho.
const LEVE = join(raiz, 'v1.5/miniaturas/publicado', PAGINA);
const LEVE_SHA = 'ebd8b117a22b234a2b66ef788775bc6c3b50e2723b9037f35dbd5f906f154a1c';
// Calibração desta cena. `gain` = albedo final ÷ albedo da textura. `neutralizeTint` tira o
// bege do cadastro (#D0C9BE parede, #BBB3A7/#9A7B57 pisos) das superfícies texturizadas,
// mantendo o bake. Móveis já usam o albedo puro (regra do guia).
// Parede: o reboco de argila tem média linear (0,375; 0,285; 0,212). Ganho = 0,65 ÷ média por
// canal tira a argila e deixa branco-gelo; o azul leva 5% a menos porque o céu da cena soma azul.
export const CALIBRACAO = {
  parede: { neutralizeTint: true, gain: [1.73, 2.28, 2.92] },
  frio: { neutralizeTint: true, gain: 2, roughness: 0.55 },
  madeira: { neutralizeTint: true, gain: 1 },
  // Tecido só como trama: 1 ÷ média linear por canal do cotelê (0,265; 0,295; 0,217) deixa a
  // textura com média 1 e cada peça fica com a cor do cadastro (sofá, cortina, roupa de cama).
  tecido: { keepTint: true, gain: [3.77, 3.39, 4.61] },
};
// Luz por cômodo (luz.js, só com --luz): spot 4000 K em candela do three r168 + preenchimento
// hemisférico. 12 + 0,8 iguala o brilho do PREMIUM; 6 + 0 mal aparecia e 10 + 1,4 lavava a cena.
export const LUZ = { intensidade: 12, cor: 0xFFEEDD, preenchimento: 0.8 };

export function derivar(base, { materials, assetPath, luz = false }) {
  const marker = 'window.__maq =';
  if (base.split(marker).length !== 2 || !base.includes('</body>')) throw Error('Template de maquete desconhecido.');
  const ponte = 'window.__pilotoBase = {MAT:MAT,matMovel:matMovel,ambientePBR:ambientePBR,PL_R:PL_R,FURN:FURN};\n';
  const inicio = `<script src="visual.js"></script><script>PilotoVisual.start({THREE:THREE,maq:__maq,base:__pilotoBase,assets:${json(materials)},assetPath:${json(assetPath)},calibration:${json(CALIBRACAO)},enabled:new URL(location.href).searchParams.get('acabamento')!=='base'});</script>`;
  const comLuz = luz ? `<script src="luz.js"></script><script>CedrosLuz.start({THREE:THREE,maq:__maq,PL_R:__pilotoBase.PL_R,intensidade:${LUZ.intensidade},cor:${LUZ.cor},preenchimento:${LUZ.preenchimento}});</script>` : '';
  return base.replace(marker, ponte + marker).replace('</body>', inicio + comLuz + '</body>');
}

async function montar(assetsDir, destino, luz = false) {
  try { if ((await readdir(destino)).length) throw Error('Destino ocupado; escolha uma pasta nova.'); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  const checked = await validarAssets(assetsDir);
  const base = await readFile(LEVE);
  if (sha256(base) !== LEVE_SHA) throw Error('O LEVE mudou; a comparação com medir_rede.py deixaria de valer.');
  const assetPath = `assets/${checked.release}/`;
  const visual = await readFile(join(pasta, '../piloto-qualidade-visual-2026-10-04/visual.js'));
  await mkdir(join(destino, assetPath), { recursive: true });
  for (const f of checked.files) await copyFile(join(assetsDir, f), join(destino, assetPath, f));
  await writeFile(join(destino, PAGINA), derivar(base.toString('utf8'), { materials: checked.manifest.materials, assetPath, luz }));
  await writeFile(join(destino, 'visual.js'), visual);
  if (luz) await copyFile(join(pasta, 'luz.js'), join(destino, 'luz.js'));
  await writeFile(join(destino, 'creditos.json'), JSON.stringify({ license: 'CC0-1.0', licenseUrl: 'https://polyhaven.com/license',
    materials: checked.manifest.materials.map(({ id, name, sourcePage }) => ({ id, name, sourcePage })) }, null, 2) + '\n');
  const files = {};
  for (const f of [PAGINA, 'visual.js', ...(luz ? ['luz.js'] : []), 'creditos.json', ...checked.files.map(f => assetPath + f)]) {
    const d = await readFile(join(destino, f)); files[f] = { bytes: d.length, sha256: sha256(d) };
  }
  const manifesto = { schema: 1, kind: 'cedros-pbr', base: { arquivo: 'v1.5/miniaturas/publicado/' + PAGINA, sha256: LEVE_SHA },
    calibration: CALIBRACAO, luz: luz ? LUZ : null, assetsBytes: checked.bytes, files };
  await writeFile(join(destino, 'manifesto.json'), JSON.stringify(manifesto, null, 2) + '\n');
  return manifesto;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { assets: { type: 'string' }, destino: { type: 'string' }, luz: { type: 'boolean', default: false } } });
  if (!values.assets || !values.destino) throw Error('Use --assets CAMINHO --destino CAMINHO [--luz].');
  const m = await montar(resolve(values.assets), resolve(values.destino), values.luz);
  console.log(JSON.stringify({ assetsBytes: m.assetsBytes, files: Object.keys(m.files).length,
    html: m.files[PAGINA].bytes }, null, 2));
}
