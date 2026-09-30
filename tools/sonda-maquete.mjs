// M1-F: roda o consumidor de planta EMBUTIDO numa maquete gerada e devolve o que ele monta,
// no referencial da planta (origem no centro da caixa dela, sem a rotação do prédio).
//
//   node tools/sonda-maquete.mjs maquete.html      -> JSON em stdout
//
// Sem navegador e sem WebGL: MapGeometry, Openings e FloorPlan são os blocos <script> do
// próprio artefato, e plantaDaUnidade recebe o mesmo `rec` e as mesmas opções que a página
// monta (pagina_maquete.py: REC_UNI e FP2). Esse trecho da página é conferido pelo texto:
// se ele mudar, a sonda para em vez de medir outra coisa.
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(process.argv[2], 'utf8');
const blocos = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
function bloco(nome, marca) {
  const achados = blocos.filter(b => b.includes(marca));
  if (achados.length !== 1) throw new Error(`${nome}: ${achados.length} blocos com "${marca}" no artefato`);
  return achados[0];
}
const geometria = bloco('MapGeometry', 'root.MapGeometry = Object.freeze');
const aberturas = bloco('Openings', 'return {ESQ_ANG, ESQ_MARCO, geoDasEsquadrias}');
const planta = bloco('FloorPlan', 'root.FloorPlan = Object.freeze');
const pagina = bloco('página', 'var REC_UNI');

function exige(re, nome) {
  const m = pagina.match(re);
  if (!m) throw new Error(`a página mudou (${nome}); a sonda replica esse trecho e precisa acompanhar`);
  return m;
}
exige(/var P = D\.predio, LV = P\.pe_direito_pav, N = P\.pavimentos/, 'prédio');
exige(/var anel = P\.pegada, cx = 0, cz = 0;/, 'pegada');
const [, ESP, PD_INT, BUILDING_INSET] =
  exige(/var ESP = ([\d.]+), PD_INT = ([\d.]+), OLHO = [\d.]+, BUILDING_INSET = ([\d.]+);/, 'constantes').map(Number);
exige(/var OPEN = Openings\.create\(\{ THREE: THREE, ESP: ESP,/, 'Openings.create');
exige(new RegExp(String.raw`var FP2 = FloorPlan\.create\(\{ fecharQuinas: true, inside: MG\.inside, shoelace: MG\.shoelace, ESP: ESP,\s*` +
  String.raw`ESQ_ANG: OPEN\.ESQ_ANG, ESQ_MARCO: OPEN\.ESQ_MARCO, safeInset: MG\.safeInset,\s*` +
  String.raw`obbOf: MG\.obbOf, BUILDING_INSET: BUILDING_INSET, PD: PD_INT,`), 'FloorPlan.create');
exige(/var r = anel\.slice\(\);\s*if \(MG\.shoelace\(r\) <= 0\) r\.reverse\(\);\s*return \{ r: r, h: N \* LV, lote: true, cx: cx, cz: cz \};/, 'REC_UNI');
exige(/PL_R = D\.cadastro \? FP2\.plantaDaUnidade\(REC_UNI, D\.cadastro\) : null;/, 'chamada do consumidor');

const dados = html.match(/<script id="__imovel" type="application\/json">([\s\S]*?)<\/script>/);
if (!dados) throw new Error('artefato sem o bloco __imovel');
const D = JSON.parse(dados[1]);
if ((D.cadastro?.planta?.moveis || []).length) throw new Error('a sonda não carrega o catálogo de móveis');

const ctx = vm.createContext({location: {search: ''}, URLSearchParams, __D: D,
  __c: {ESP, PD_INT, BUILDING_INSET}});
for (const b of [geometria, aberturas, planta]) vm.runInContext(b, ctx);
const pl = vm.runInContext(`(() => {
  const MG = MapGeometry, D = __D, P = D.predio, LV = P.pe_direito_pav, N = P.pavimentos;
  const anel = P.pegada;
  let cx = 0, cz = 0;
  for (const p of anel) { cx += p[0]; cz += p[1]; }
  cx /= anel.length; cz /= anel.length;
  const OPEN = Openings.create({THREE: {}, ESP: __c.ESP});
  const FP2 = FloorPlan.create({fecharQuinas: true, inside: MG.inside, shoelace: MG.shoelace, ESP: __c.ESP,
    ESQ_ANG: OPEN.ESQ_ANG, ESQ_MARCO: OPEN.ESQ_MARCO, safeInset: MG.safeInset,
    obbOf: MG.obbOf, BUILDING_INSET: __c.BUILDING_INSET, PD: __c.PD_INT,
    anelDoLote: () => null, MOVEIS: {}});
  const r = anel.slice();
  if (MG.shoelace(r) <= 0) r.reverse();
  return FP2.plantaDaUnidade({r, h: N * LV, lote: true, cx, cz}, D.cadastro);
})()`, ctx);
if (!pl) throw new Error('plantaDaUnidade não montou a planta');

// De volta ao referencial da planta: o inverso de W() em plantaDaUnidade. Arredondado a
// 1 µm só para o JSON não carregar ruído de ponto flutuante.
const ob = pl.ob;
const r6 = v => Math.round(v * 1e6) / 1e6 || 0;
const loc = p => {
  const x = p[0] - ob.cx, z = p[1] - ob.cz;
  return [r6(x * ob.ux + z * ob.uz), r6(-x * ob.uz + z * ob.ux)];
};
process.stdout.write(JSON.stringify({
  floorPlanSha256: crypto.createHash('sha256').update(planta, 'utf8').digest('hex'),
  entrada: D.cadastro.planta.entrada ?? null,
  geometria: {
    pd: pl.pd,
    comodos: pl.comodos.map(c => ({nome: c.nome, poly: c.poly.map(loc)})),
    paredes: pl.paredes.map(w => ({a: loc(w.a), b: loc(w.b), y0: r6(w.y0), y1: r6(w.y1)})),
    esquadrias: pl.esquadrias.map(e => ({porta: e.porta, tipo: e.tipo, a: loc(e.a), b: loc(e.b),
                                         y0: r6(e.y0), y1: r6(e.y1)})),
  },
}) + '\n');
