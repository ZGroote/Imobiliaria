// Planta espelhada dos finais 02/07 (canto) e 03/06 (meio), a partir da unidade.json já construída.
// O espelho mantém a fachada no lugar (o giro do sol do apartamento sai só da direção da fachada): o canto, com a
// fachada em -Z do site (y da planta), espelha em X; o meio, com a fachada em -X, espelha em Y da planta.
// Cômodos, portas, janelas e móveis trocam de lado; a parede citada troca de nome (leste<->oeste, norte<->sul) e o
// móvel gira para continuar de frente para a mesma parede (frente em +Z no giro 0, como no site).
// A dobradiça de cada porta de giro é a da original, espelhada e gravada na planta (dobradica + tipo): a regra do
// construtor desempata pela primeira ponta do vão, que no espelho fica do outro lado, e no meio a folha passava a
// bater na parede (entrada virava vão).
//   node experimentos/laranjeiras-2026-10-30/interiores/espelhar.mjs
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url)), site = join(here, '../site');
globalThis.location ??= {search: ''};  // o runtime lê ?moveis= da página
vm.runInThisContext(readFileSync(join(site, 'interiores/shared/runtime.js'), 'utf8'));  // FloorPlan das fábricas do site
const {createLayout} = await import('../site/interior-navigation.js');

const AXIS = {canto: 0, meio: 1};
const NAMES = {0: ['-east', '-west'], 1: ['-north', '-south']};
const TURN = {0: r => (4 - r) % 4, 1: r => (6 - r) % 4};  // frente (sin θ, cos θ): espelho em x -> -θ; em y -> π-θ

for (const [typology, k] of Object.entries(AXIS)) {
  const unit = JSON.parse(readFileSync(join(here, typology, 'unidade.json'), 'utf8')), plan = unit.planta;
  const layout = createLayout(unit);
  const points = plan.comodos.flatMap(c => c.poly), sum = Math.min(...points.map(p => p[k])) + Math.max(...points.map(p => p[k]));
  const point = p => p.map((v, i) => i === k ? +(sum - v).toFixed(6) : v);
  const [a, b] = NAMES[k], wall = name => name.endsWith(a) ? name.slice(0, -a.length) + b : name.endsWith(b) ? name.slice(0, -b.length) + a : name;
  const hinges = new Map(layout.joinery.filter(j => j.porta && j.tipo === 'giro')
    .map(j => [j.id, point((j.eixo === 0 ? j.a : j.b).map((v, i) => v + layout.center[i]))]));
  for (const c of plan.comodos) c.poly = c.poly.map(point).reverse();  // o espelho inverte o sentido do contorno
  for (const o of [...plan.portas, ...plan.janelas]) {
    o.p = point(o.p); o.wallId = wall(o.wallId);
    if (o.pairedWallId) o.pairedWallId = wall(o.pairedWallId);
    if (hinges.has(o.id)) {o.tipo = 'giro'; o.dobradica = hinges.get(o.id);}
  }
  for (const m of plan.moveis) {m.p = point(m.p); if ('rot' in m) m.rot = TURN[k](m.rot);}
  unit.id += '-espelhada';
  unit.ficha.observacao += ' Espelhada para os finais em que a planta do book aparece invertida no prédio.';
  mkdirSync(join(here, `${typology}-espelhado`), {recursive: true});
  writeFileSync(join(here, `${typology}-espelhado`, 'unidade.json'), JSON.stringify(unit, null, 2) + '\n');
  const check = createLayout(unit).joinery.filter(j => j.porta).map(j => `${j.id}:${j.tipo}`);
  console.log(typology, 'dobradiças', [...hinges.keys()].join(','), '| espelhada', check.join(' '));
}
