#!/usr/bin/env node
/* Casas procedurais da cidade inteira: lotes -> planos -> derivados/casas/.

     node gerador/casas.mjs                 # São Carlos, com prova de determinismo
     node gerador/casas.mjs --rapido        # sem a segunda execução (só para iterar)
     node gerador/casas.mjs --cidade <slug>

   Grava em derivados/casas/:
     casas.bin         planos (casas/formato.js), agrupados pelo `bl` do city.json
     substituidos.bin  índices de `b` que o renderizador deixa de desenhar
     qa.json           histogramas, contagens, recusas, portões duros, tempos

   Sai com código 1 se algum portão duro reprovar (casas/ESPEC.md, "Validação
   obrigatória"). O QA roda sobre o arquivo GRAVADO, decodificado de novo, contra o
   polígono ORIGINAL do lote: o que passa aqui é o que o navegador recebe.

   Entradas, todas só leitura: padrao/cidades/<slug>.json (centro, vias, relevo, fontes),
   regras/<slug>.json, o city.json, os lotes, o relevo e plantas_fornecidas/<id>/unidade.json. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, "..");
const RAIZ = path.resolve(PASTA, "../..");
require("../casas/sorteio.js");
require("../casas/formato.js");
require("../casas/regras.js");
const { CasasFormato: F, CasasRegras: CR } = globalThis;
const G = CR.geo;

const args = process.argv.slice(2);
const opcao = (nome, padrao) => { const i = args.indexOf(nome); return i >= 0 && args[i + 1] ? args[i + 1] : padrao; };
const SLUG = opcao("--cidade", "sao-carlos");
const RAPIDO = args.includes("--rapido");
const SAIDA = path.resolve(PASTA, opcao("--saida", "derivados/casas"));

const t0 = performance.now();
const tempos = {};
const marca = (nome, desde) => { tempos[nome] = Math.round(performance.now() - desde); return performance.now(); };
const lerJSON = p => JSON.parse(fs.readFileSync(p, "utf8"));
const sha256 = buf => crypto.createHash("sha256").update(Buffer.from(buf)).digest("hex");

/* =====================================================================
   ENTRADAS
   ===================================================================== */
let tt = performance.now();
const CIDADE = lerJSON(path.join(RAIZ, "padrao/cidades", SLUG + ".json"));
const fonte = k => path.join(RAIZ, CIDADE.fontes[k]);
const regrasJson = lerJSON(path.join(PASTA, "regras", SLUG + ".json"));
const regras = CR.carrega(regrasJson);
const R = regras.R;
const city = lerJSON(fonte("city_saida"));
const lotesGeo = lerJSON(fonte("lotes"));
const relevoGrade = lerJSON(fonte("relevo"));
tt = marca("leitura_ms", tt);

// Projeção do renderizador (padrao/cidade.py, fonte/app.js): metros, x leste, z sul.
const LAT0 = CIDADE.centro.lat, LON0 = CIDADE.centro.lon;
const MLAT = 111132.92, MLON = 111319.49 * Math.cos(LAT0 * Math.PI / 180);
const projeta = (lon, lat) => [(lon - LON0) * MLON, -(lat - LAT0) * MLAT];
const Q = city.q || 10;

// ---- volumes do city.json ---------------------------------------------------------
const B = [];
{
  const b = city.b;
  let i = 0;
  while (i < b.length) {
    const c = b[i++], h = b[i++] / Q, n = b[i++];
    let lx = 0, lz = 0;
    const r = [];
    for (let k = 0; k < n; k++) { lx += b[i++]; lz += b[i++]; r.push([lx / Q, lz / Q]); }
    B.push({ c, h, r });
  }
}
const nomeado = new Uint8Array(B.length);
for (let k = 0; k < (city.bm || []).length; k += 3) if (city.bm[k + 1] >= 0 && city.names[city.bm[k + 1]]) nomeado[city.bm[k]] = 1;
const grupoDe = new Int32Array(B.length).fill(-1);
const QUART = [];
for (let k = 0; k < city.bl.length; k += 5) {
  const q = QUART.length, ini = city.bl[k + 3], n = city.bl[k + 4];
  QUART.push({ cx: Math.round(city.bl[k] / Q * 10), cz: Math.round(city.bl[k + 1] / Q * 10) });
  for (let j = ini; j < ini + n; j++) grupoDe[j] = q;
}
const caixa = r => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const p of r) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; } return [x0, z0, x1, z1]; };
for (const v of B) { v.area = Math.abs(G.areaAssinada(v.r)); v.cen = G.centroide(v.r); v.cx = caixa(v.r); }
const pavDe = h => Math.max(1, Math.round((h - R("selecao.pavimento_base_m")) / R("selecao.pavimento_altura_m")));

// ---- grade espacial genérica ---------------------------------------------------------
function Grade(celula) {
  const m = new Map(), chave = (gx, gz) => gx * 1000003 + gz;
  return {
    poe(cx, item) {
      for (let gx = Math.floor(cx[0] / celula); gx <= Math.floor(cx[2] / celula); gx++)
        for (let gz = Math.floor(cx[1] / celula); gz <= Math.floor(cx[3] / celula); gz++) {
          const k = chave(gx, gz); let a = m.get(k); if (!a) m.set(k, a = []); a.push(item);
        }
    },
    ponto(x, z) { return m.get(chave(Math.floor(x / celula), Math.floor(z / celula))) || []; },
    caixa(cx) {
      const s = new Set();
      for (let gx = Math.floor(cx[0] / celula); gx <= Math.floor(cx[2] / celula); gx++)
        for (let gz = Math.floor(cx[1] / celula); gz <= Math.floor(cx[3] / celula); gz++)
          for (const it of m.get(chave(gx, gz)) || []) s.add(it);
      return [...s].sort((a, b) => a - b);
    }
  };
}
const cruzaCaixa = (a, b, f = 0) => a[0] - f <= b[2] && b[0] - f <= a[2] && a[1] - f <= b[3] && b[1] - f <= a[3];

// ---- vias: a FITA do renderizador (padrao/vias.py), só dirigíveis ----------------------
const V = CIDADE.vias, ORDEM = V.ordem, DIRIGIVEL = new Set(V.dirigivel);
const meiaLargura = tipo => (V.largura[tipo] ?? V.largura.other ?? 6) / 2 * V.mul_fita;
const SEG = [];                                 // [ax, az, bx, bz, meia-largura]
{
  const r = city.r;
  let i = 0;
  while (i + 2 < r.length) {
    const k = r[i]; i += 2;
    const n = r[i++];
    let lx = 0, lz = 0;
    const pts = [];
    for (let j = 0; j < n; j++) { lx += r[i++]; lz += r[i++]; pts.push([lx / Q, lz / Q]); }
    const tipo = k >= 0 && k < ORDEM.length ? ORDEM[k] : "other";
    if (pts.length < 2 || !DIRIGIVEL.has(tipo)) continue;
    const h = meiaLargura(tipo);
    for (let j = 0; j + 1 < pts.length; j++) SEG.push([pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], h]);
  }
}
// Distância até a BORDA da fita (negativa dentro dela). A grade guarda cada segmento
// nas células que a fita mais 3 m toca: além disso a resposta exata não importa.
const gradeVia = Grade(40);
SEG.forEach((s, i) => gradeVia.poe([Math.min(s[0], s[2]) - s[4] - 3, Math.min(s[1], s[3]) - s[4] - 3, Math.max(s[0], s[2]) + s[4] + 3, Math.max(s[1], s[3]) + s[4] + 3], i));
function distRua(x, z) {
  let d = 99;
  for (const i of gradeVia.ponto(x, z)) { const s = SEG[i]; const e = G.distPS(x, z, s[0], s[1], s[2], s[3]) - s[4]; if (e < d) d = e; }
  return d;
}
// Fita erodida de 0,25 m, um retângulo por trecho, como portao_casa_sobre_rua (padrao/qa.py).
const ERODE = 0.25;
const FITA = [];
for (const s of SEG) {
  const dx = s[2] - s[0], dz = s[3] - s[1], L = Math.hypot(dx, dz), h = s[4] - ERODE;
  if (L < 0.2 || h <= 0) continue;
  const nx = -dz / L * h, nz = dx / L * h;
  FITA.push([[s[0] + nx, s[1] + nz], [s[2] + nx, s[3] + nz], [s[2] - nx, s[3] - nz], [s[0] - nx, s[1] - nz]]);
}
const gradeFita = Grade(40);
FITA.forEach((f, i) => gradeFita.poe(caixa(f), i));
const FITA_CX = FITA.map(caixa);
function sobreRua(anel) {
  const cx = caixa(anel);
  const qs = gradeFita.caixa(cx).filter(i => cruzaCaixa(FITA_CX[i], cx)).map(i => FITA[i]);
  return qs.length ? Math.min(G.areaIntersecao(anel, qs), Math.abs(G.areaAssinada(anel))) : 0;
}

// ---- preenchimento de rua (street_tris.json), só para informação no QA ----------------
const RUA_TRIS = [];
{
  const t = lerJSON(fonte("rua_tris"));
  for (let i = 0; i + 5 < t.length; i += 6) RUA_TRIS.push([[t[i], t[i + 1]], [t[i + 2], t[i + 3]], [t[i + 4], t[i + 5]]]);
}
const gradeTri = Grade(40);
const TRI_CX = RUA_TRIS.map(caixa);
RUA_TRIS.forEach((t, i) => gradeTri.poe(TRI_CX[i], i));
// os triângulos da malha não se sobrepõem: a soma das interseções é a área sobre o asfalto
function sobreAsfalto(anel) {
  const cx = caixa(anel);
  let a = 0;
  for (const i of gradeTri.caixa(cx)) if (cruzaCaixa(TRI_CX[i], cx)) a += G.areaIntersecao(anel, [RUA_TRIS[i]]);
  return a;
}

// ---- relevo: a mesma amostragem de fonte/terrain-fit.js (sem o exagero) -----------------
const RN = CIDADE.relevo_grade.n, RH = CIDADE.relevo_grade.half_m;
function relevo(x, z) {
  const g = relevoGrade, n = RN, half = RH;
  const u = Math.max(0, Math.min(n - 1, (x + half) / (2 * half) * (n - 1))), v = Math.max(0, Math.min(n - 1, (z + half) / (2 * half) * (n - 1)));
  const i = Math.min(n - 2, Math.floor(u)), j = Math.min(n - 2, Math.floor(v)), fx = u - i, fz = v - j;
  const a = g[j * n + i], b = g[j * n + i + 1], c = g[(j + 1) * n + i], d = g[(j + 1) * n + i + 1];
  return fx + fz <= 1 ? a + (b - a) * fx + (c - a) * fz : d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}

// ---- lotes ----------------------------------------------------------------------------
const LOTES = lotesGeo.features.map((f, i) => {
  const g = f.geometry;
  if (!g || g.type !== "Polygon") return null;
  const bruto = g.coordinates[0].map(([lo, la]) => projeta(lo, la));
  if (bruto.length > 1 && bruto[0][0] === bruto[bruto.length - 1][0] && bruto[0][1] === bruto[bruto.length - 1][1]) bruto.pop();
  const anel = G.limpaAnel(bruto);
  if (anel.length < 3) return null;
  let mx = 0, mz = 0; for (const p of anel) { mx += p[0]; mz += p[1]; }
  mx /= anel.length; mz /= anel.length;
  return { i, anel, bruto, props: f.properties || {}, area: Math.abs(G.areaAssinada(anel)), cen: G.centroide(anel), cx: caixa(anel),
           // id estável: média dos vértices em dm, a mesma ideia do idDoRegistro do prédio
           id: Math.round(mx * 10) + "_" + Math.round(mz * 10) };
});
const gradeLote = Grade(50);
LOTES.forEach(l => { if (l) gradeLote.poe(l.cx, l.i); });
tt = marca("preparo_ms", tt);

// ---- volume -> lote: o centróide do volume cai no lote (encaixar_casas_lotes.py) --------
const loteDoVolume = new Int32Array(B.length).fill(-1);
const volumesDoLote = new Map();
B.forEach((v, j) => {
  const cand = gradeLote.ponto(v.cen[0], v.cen[1]).filter(li => G.dentro(v.cen[0], v.cen[1], LOTES[li].anel));
  if (!cand.length) return;
  let li = cand[0];
  if (cand.length > 1) {          // lotes sobrepostos: o que mais cobre o volume
    let melhor = -1;
    for (const c of cand) { const a = G.areaIntersecao(v.r, [LOTES[c].anel]); if (a > melhor + 1e-9) { melhor = a; li = c; } }
  }
  loteDoVolume[j] = li;
  let a = volumesDoLote.get(li); if (!a) volumesDoLote.set(li, a = []); a.push(j);
});

// ---- cadastrados: a mesma conta de exteriores/v1/proteger_cadastros.py ------------------
const protegidos = [];
const volumeProtegido = new Uint8Array(B.length);
{
  const idDoRegistro = v => { let x = 0, z = 0; for (const p of v.r) { x += p[0]; z += p[1]; } return Math.round(x / v.r.length * 10) + "_" + Math.round(z / v.r.length * 10); };
  const pasta = path.join(RAIZ, "plantas_fornecidas");
  const folga = R("protecao.folga_m"), dimP = R("protecao.dimensao_padrao_m");
  for (const nome of fs.readdirSync(pasta).sort()) {
    const p = path.join(pasta, nome, "unidade.json");
    if (!fs.existsSync(p)) continue;
    const u = lerJSON(p);
    if (u.cidade !== SLUG) continue;
    const lote = u.lote || {};
    if (lote.lat != null) {
      const pr = lote.predio || {}, blocos = (pr.blocos && pr.blocos.length) ? pr.blocos : [pr];
      const raio = Math.max(...blocos.map(b => Math.hypot(b.du || 0, b.dv || 0) +
        Math.hypot(b.largura_m ?? pr.largura_m ?? dimP, b.profundidade_m ?? pr.profundidade_m ?? dimP) / 2 + folga));
      const [x, z] = projeta(lote.lon, lote.lat);
      protegidos.push({ id: u.id, x, z, raio });
    }
    if (u.predio_id) B.forEach((v, j) => { if (idDoRegistro(v) === u.predio_id) volumeProtegido[j] = 1; });
    if (!lote.lat && u.ancora && u.ancora.lat != null) {
      const [x, z] = projeta(u.ancora.lon, u.ancora.lat);
      let melhor = -1, dm = R("protecao.raio_ancora_m") ** 2;
      B.forEach((v, j) => { const d = (v.cen[0] - x) ** 2 + (v.cen[1] - z) ** 2; if (d < dm) { dm = d; melhor = j; } });
      if (melhor >= 0) volumeProtegido[melhor] = 1;
    }
  }
}
const distAnel = (x, z, anel) => {
  if (G.dentro(x, z, anel)) return 0;
  let d = Infinity;
  for (let i = 0; i < anel.length; i++) { const a = anel[i], b = anel[(i + 1) % anel.length]; d = Math.min(d, G.distPS(x, z, a[0], a[1], b[0], b[1])); }
  return d;
};
const loteProtegido = l => protegidos.some(p => distAnel(p.x, p.z, l.anel) <= p.raio);

/* =====================================================================
   SELEÇÃO: lote com casa hoje (ESPEC "Quais casas entram")
   ===================================================================== */
const exclusoes = {};
const conta = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const ehCasa = v => v.c === R("selecao.classe_residencial") && v.h <= R("selecao.altura_max_m") && v.area <= R("selecao.area_galpao_m2");
const candidatos = [];
for (const [li, vs] of [...volumesDoLote.entries()].sort((a, b) => a[0] - b[0])) {
  const l = LOTES[li];
  if (vs.some(j => nomeado[j])) { conta(exclusoes, "nomeado"); continue; }
  if (vs.some(j => volumeProtegido[j]) || loteProtegido(l)) { conta(exclusoes, "protegido"); continue; }
  if (!vs.every(j => ehCasa(B[j]))) { conta(exclusoes, "misto_ou_nao_casa"); continue; }
  candidatos.push(li);
}

// ---- lotes de casa sobrepostos: duplicata absorve, sobreposição parcial vira obstáculo --
const RANK = { planta: 0, planta_refeita: 1, planta_complemento: 2, sintetico: 3 };
const ehCand = new Uint8Array(LOTES.length);
for (const li of candidatos) ehCand[li] = 1;
const gradeCand = Grade(50);
for (const li of candidatos) gradeCand.poe(LOTES[li].cx, li);
const dono = new Map();                   // lote duplicado -> lote que fica
const vizinhosSobrepostos = new Map();
const achaDono = l => { while (dono.has(l)) l = dono.get(l); return l; };
let paresSobrepostos = 0;
for (const li of candidatos) {
  const a = LOTES[li];
  for (const lj of gradeCand.caixa(a.cx)) {
    if (lj <= li || !cruzaCaixa(a.cx, LOTES[lj].cx)) continue;
    const b = LOTES[lj];
    const inter = G.areaIntersecao(a.anel, [b.anel]);
    if (inter <= 0.5) continue;
    paresSobrepostos++;
    if (inter > 0.5 * Math.min(a.area, b.area)) {
      const pa = [RANK[a.props.fonte] ?? 9, -a.area, li], pb = [RANK[b.props.fonte] ?? 9, -b.area, lj];
      const fica = (pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2]) <= 0 ? li : lj, sai = fica === li ? lj : li;
      const d1 = achaDono(fica), d2 = achaDono(sai);
      if (d1 !== d2) dono.set(d2, d1);
    } else {
      for (const [x, y] of [[li, lj], [lj, li]]) { let s = vizinhosSobrepostos.get(x); if (!s) vizinhosSobrepostos.set(x, s = []); s.push(y); }
    }
  }
}
const volumesPlano = new Map();          // lote planejado -> volumes que ele substitui
const ativos = [];
for (const li of candidatos) {
  const d = achaDono(li);
  let s = volumesPlano.get(d); if (!s) volumesPlano.set(d, s = []);
  s.push(...volumesDoLote.get(li));
  if (d !== li) conta(exclusoes, "lote_duplicado");
}
for (const li of candidatos) if (achaDono(li) === li) ativos.push(li);
for (const s of volumesPlano.values()) s.sort((a, b) => a - b);

// ---- bairro: estatística da quadra (lotes de planta) e distância ao centro antigo ------
const grupos = new Map();
for (const l of LOTES) {
  if (!l || l.props.fonte === "sintetico") continue;
  const k = (l.props.loteamento || "") + "|" + l.props.quadra;
  let g = grupos.get(k); if (!g) grupos.set(k, g = []); g.push(l.area);
}
const estat = new Map();
for (const [k, a] of grupos) {
  const s = a.slice().sort((x, y) => x - y), m = s.reduce((x, y) => x + y, 0) / s.length;
  const sd = Math.sqrt(s.reduce((x, y) => x + (y - m) ** 2, 0) / s.length);
  estat.set(k, { n: s.length, mediana: s[Math.floor(s.length / 2)], cv: sd / m });
}
const centroAntigo = projeta(regrasJson.bairros.centro_antigo.centro.lon, regrasJson.bairros.centro_antigo.centro.lat);
const bairroDe = l => CR.classificaBairro({
  loteamento: l.props.loteamento, fonte: l.props.fonte, area: l.area,
  distCentro: Math.hypot(l.cen[0] - centroAntigo[0], l.cen[1] - centroAntigo[1]),
  grupo: l.props.fonte === "sintetico" ? null : estat.get((l.props.loteamento || "") + "|" + l.props.quadra)
}, regras);
tt = marca("selecao_ms", tt);

/* =====================================================================
   PLANEJAMENTO (com ponto fixo dos obstáculos)
   ===================================================================== */
function entradaDoLote(li, mantidos, gradeMant) {
  const l = LOTES[li], vs = volumesPlano.get(li);
  const principal = vs.reduce((a, b) => B[b].area > B[a].area ? b : a, vs[0]);
  const faOk = j => Number.isFinite(city.fa?.[j]) && city.fa[j] >= 0 && city.fa[j] <= 360;
  const faj = faOk(principal) ? principal : vs.find(faOk);
  const nx = l.props.nx, ny = l.props.ny;
  // nx/ny do lote sintético: normal UTM para DENTRO do lote; no mapa z = -norte
  const normal = Number.isFinite(nx) && Number.isFinite(ny) ? [-nx / Math.hypot(nx, ny), ny / Math.hypot(nx, ny)] : null;
  const obst = [];
  for (const j of gradeMant.caixa(l.cx)) if (mantidos.has(j) && cruzaCaixa(B[j].cx, l.cx) && G.areaIntersecao(B[j].r, [l.anel]) > 0.01) obst.push(B[j].r);
  for (const lj of vizinhosSobrepostos.get(li) || []) if (achaDono(lj) === lj) obst.push(LOTES[lj].anel);
  return {
    slug: SLUG, idLote: l.id, anel: l.anel, bairro: bairroDe(l),
    dica: { fa: faj !== undefined ? city.fa[faj] : 400, pavimentos: pavDe(B[principal].h),
            ocupacao: vs.reduce((s, j) => s + B[j].area, 0) / l.area, normal },
    distRua, relevo, centroQuarteirao: [QUART[grupoDe[principal]].cx, QUART[grupoDe[principal]].cz],
    obstaculos: obst, principal
  };
}

function planejaCidade() {
  const mantidos = new Set();
  B.forEach((_, j) => mantidos.add(j));
  for (const vs of volumesPlano.values()) for (const j of vs) mantidos.delete(j);
  const gradeMant = Grade(50);
  for (const j of mantidos) gradeMant.poe(B[j].cx, j);
  const res = new Map();
  let pend = ativos.slice(), voltas = 0;
  while (pend.length) {
    voltas++;
    const novos = [];
    for (const li of pend) {
      const ent = entradaDoLote(li, mantidos, gradeMant);
      const r = CR.planeja(ent, regras);
      r.principal = ent.principal;
      const antes = res.get(li);
      res.set(li, r);
      if (!r.ok && (!antes || antes.ok)) novos.push(li);
    }
    if (!novos.length) break;
    // volumes de lote recusado voltam ao mapa e viram obstáculo para os vizinhos
    const cx = [];
    for (const li of novos) for (const j of volumesPlano.get(li)) { mantidos.add(j); gradeMant.poe(B[j].cx, j); cx.push(B[j].cx); }
    const afetados = new Set();
    for (const c of cx) for (const lj of gradeCand.caixa(c)) if (achaDono(lj) === lj && res.get(lj)?.ok && cruzaCaixa(LOTES[lj].cx, c, 1)) afetados.add(lj);
    pend = [...afetados].sort((a, b) => a - b);
  }
  // agrupa por quarteirão, na ordem do volume principal
  const porQ = QUART.map(q => ({ cx: q.cx, cz: q.cz, casas: [], lotes: [] }));
  const oks = ativos.filter(li => res.get(li).ok).sort((a, b) => res.get(a).principal - res.get(b).principal);
  for (const li of oks) { const q = grupoDe[res.get(li).principal]; porQ[q].casas.push(res.get(li).campos); porQ[q].lotes.push(li); }
  const buf = F.codifica({ slug: SLUG, regras: regrasJson, meta: { gerado_por: "gerador/casas.mjs", versao_regras: regras.versao }, quarteiroes: porQ });
  const subs = [];
  for (const li of oks) subs.push(...volumesPlano.get(li));
  const loteDaCasa = porQ.flatMap(q => q.lotes);
  return { buf, subsBuf: F.codificaSubstituidos(subs), res, oks, loteDaCasa, mantidos, voltas };
}

let plano = planejaCidade();
tt = marca("planejamento_ms", tt);
const shaA = sha256(plano.buf);
let shaB = null;
if (!RAPIDO) {
  const t2 = performance.now();
  const outra = planejaCidade();
  shaB = sha256(outra.buf);
  tempos.planejamento_repetido_ms = Math.round(performance.now() - t2);
  tt = performance.now();
}

/* =====================================================================
   QA SOBRE O ARQUIVO DECODIFICADO
   ===================================================================== */
const arq = F.abre(plano.buf);
const hist = (passo, min, max) => ({ passo, min, max, n: new Array(Math.round((max - min) / passo) + 1).fill(0), vals: [] });
const poe = (h, x) => { h.vals.push(x); const k = Math.max(0, Math.min(h.n.length - 1, Math.floor((x - h.min) / h.passo + 1e-9))); h.n[k]++; };
const fecha = h => {
  const s = h.vals.sort((a, b) => a - b), q = p => s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 1000) / 1000 : null;
  return { passo: h.passo, desde: h.min, contagens: h.n, n: s.length, p5: q(0.05), mediana: q(0.5), p95: q(0.95) };
};
const H = {
  inclinacao_ceramica: hist(0.005, 0.28, 0.37), cumeeira_terrea_m: hist(0.25, 2.5, 9), cumeeira_sobrado_m: hist(0.25, 5, 10),
  respaldo_terrea_m: hist(0.05, 2.7, 3.4), respaldo_sobrado_m: hist(0.05, 5.6, 6.4), taxa_ocupacao: hist(0.05, 0, 1),
  permeabilidade: hist(0.05, 0, 1), recuo_frontal_m: hist(0.5, 0, 15), recuo_lateral_m: hist(0.25, 0, 10), recuo_fundo_m: hist(1, 0, 60),
  declividade: hist(0.01, 0, 0.3)
};
const C = { partido: {}, forma_por_bairro: {}, partido_por_bairro: {}, classe_testada: {}, telhado: {}, muro_frente: {}, garagem: {},
            bairro: {}, esquina: 0, encostado: {}, edicula: 0, piscina: 0, sobrado: 0, embasamento: 0, irregular: 0,
            testada_inferida: 0, testada_composta: 0, plantio_fora_do_lote: 0, plantio: 0, tentativa_usada: {}, falhas_antes_do_plano: {} };
const falhas = { janela_divisa: [], fora_do_lote: [], balanco: [], garagem_sem_portao: [], telha_fora: [], colide_mantido: [], sobrepoe_casa_nova: [] };
const anota = (lista, i, extra) => { if (lista.length < 20) lista.push(Object.assign({ casa: i, lote: LOTES[plano.loteDaCasa[i]].i }, extra || {})); else lista.n = (lista.n || 20) + 1; };
const tamFalha = l => l.n || l.length;
const DJ = R("recuos.lateral_janela_m"), TOL = 0.05;
const mundoAnel = (casa, r) => [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]].map(([u, v]) => F.paraMundo(casa, u, v));
let areaNova = 0, sobreNova = 0, asfaltoNova = 0;
const gradeNova = Grade(50), casasMundo = [];
const mantidosLista = [...plano.mantidos];

for (let i = 0; i < arq.nCasas; i++) {
  const casa = arq.casa(i), det = F.detalha(casa, regrasJson);
  const li = plano.loteDaCasa[i], l = LOTES[li], r = plano.res.get(li);
  // polígono ORIGINAL do lote na moldura decodificada
  const loc = p => { const dx = p[0] - casa.origem[0], dz = p[1] - casa.origem[1]; return [dx * casa.eixoU[0] + dz * casa.eixoU[1], dx * casa.eixoV[0] + dz * casa.eixoV[1]]; };
  const A = G.antiHorario(l.anel), P = A.map(loc);
  const an = CR.lados.analisaLados(A, distRua, null, regras);
  const rua = new Array(A.length).fill(false);
  for (const s of an.lados) if (s.rua) for (const k of s.arestas) rua[k] = true;
  const viz = []; for (let k = 0; k < P.length; k++) if (!rua[k]) viz.push([P[k], P[(k + 1) % P.length]]);
  const vols = casa.volumes, sup = det.pavimentoSuperior;

  // 1. fora do lote (paredes, pavimento de cima e beiral), tolerância 0,05 m, contra o
  // anel BRUTO do GeoJSON. O critério é de ÁREA: o retângulo encolhido de 0,05 m cabe
  // inteiro na região do lote. Um teste de cruzamento de aresta acusaria a lasca de
  // largura zero (ida e volta) que o GeoJSON tem em centenas de lotes e que não tira
  // um centímetro quadrado do terreno.
  const Pb = l.bruto.map(loc);
  const dentroBruto = r => { const s = G.encolhe(r, TOL); if (s.u1 <= s.u0 || s.v1 <= s.v0) return true;
    return (s.u1 - s.u0) * (s.v1 - s.v0) - G.areaIntersecao(G.retAnel(s), [Pb]) <= 1e-3; };   // 10 cm²: ruído numérico de lasca
  let fora = false;
  for (const v of vols.concat(sup ? [sup] : [])) if (!dentroBruto(v)) fora = true;
  for (const f of det.faces) if (f.beiral > 0) {
    const v = vols[f.volume], b = f.beiral;
    const rr = f.lado === "frente" ? { u0: v.u0, u1: v.u1, v0: v.v0 - b, v1: v.v0 } : f.lado === "fundo" ? { u0: v.u0, u1: v.u1, v0: v.v1, v1: v.v1 + b }
             : f.lado === "direita" ? { u0: v.u1, u1: v.u1 + b, v0: v.v0, v1: v.v1 } : { u0: v.u0 - b, u1: v.u0, v0: v.v0, v1: v.v1 };
    if (!dentroBruto(rr)) fora = true;
  }
  if (fora) anota(falhas.fora_do_lote, i);
  // 2. janela a menos de 1,5 m da divisa: a faixa de visão da face atravessa o vizinho
  const faixaVisao = (m, lado) => { const e = 0.01; return lado === "frente" ? { u0: m.u0, u1: m.u1, v0: m.v0 - DJ, v1: m.v0 + e } : lado === "direita" ? { u0: m.u1 - e, u1: m.u1 + DJ, v0: m.v0, v1: m.v1 }
                                    : lado === "fundo" ? { u0: m.u0, u1: m.u1, v0: m.v1 - e, v1: m.v1 + DJ } : { u0: m.u0 - DJ, u1: m.u0 + e, v0: m.v0, v1: m.v1 }; };
  const atravessa = t => { const s = G.encolhe(t, 1e-3); return viz.some(([a, b]) => G.segCortaRet(a[0], a[1], b[0], b[1], s)); };
  for (const f of det.faces) if (f.janela) {
    const v = vols[f.volume];
    if (atravessa(faixaVisao(v, f.lado)) || (f.volume === 0 && sup && atravessa(faixaVisao(sup, f.lado)))) anota(falhas.janela_divisa, i, { face: f.papel + ":" + f.lado });
  }

  // 3. balanço do sobrado
  if (casa.pavimentos === 2) {
    const areaSup = (sup.u1 - sup.u0) * (sup.v1 - sup.v0), areaTerreo = G.areaUniaoRets(vols.filter(v => v.papel !== "garagem_leve"));
    if (casa.alturas.balanco > R("alturas.balanco_max_m") + 1e-9 || areaSup > areaTerreo + 1e-6) anota(falhas.balanco, i);
  }

  // 4. garagem com portão de garagem à frente, alinhado a ela
  if (casa.garagem.lado !== "nenhuma") {
    const g = det.portaoGaragem, [gmin, gmax] = R("portoes.garagem_largura_m"), pil = R("portoes.pilarete_m"), T = casa.lote.testada;
    const gv = vols.find(v => v.papel === "garagem_leve" || v.papel === "caixa_garagem");
    let ok = g && g.largura >= gmin - 1e-9 && g.largura <= gmax + 1e-9 && g.u0 >= -T / 2 + pil - 1e-6 && g.u1 <= T / 2 - pil + 1e-6 && casa.muroFrente !== "nenhum";
    if (ok && gv) ok = g.u0 >= gv.u0 - 1e-6 && g.u1 <= gv.u1 + 1e-6;
    if (ok && det.vaga) ok = det.vaga.v1 - det.vaga.v0 >= R("recuos.frontal_m") - 1e-6;
    if (!ok) anota(falhas.garagem_sem_portao, i);
  }

  // 5. telhado cerâmico entre 30 e 35%
  const [ia, ib] = R("telhado.ceramica_inclinacao");
  const ceramicos = det.telhados.filter(t => t.material === "ceramica");
  for (const t of ceramicos) if (t.inclinacao < ia - 1e-9 || t.inclinacao > ib + 1e-9) { anota(falhas.telha_fora, i); break; }
  if (casa.telhado.ceramico) poe(H.inclinacao_ceramica, casa.telhado.inclinacao);

  // 6. pegada no mundo: rua, volume mantido, casa nova vizinha
  const aneis = vols.map(v => mundoAnel(casa, v));
  for (const a of aneis) { const ar = Math.abs(G.areaAssinada(a)); areaNova += ar; sobreNova += sobreRua(a); asfaltoNova += sobreAsfalto(a); }
  const cxCasa = caixa(aneis.flat());
  casasMundo.push({ aneis, cx: cxCasa });
  gradeNova.poe(cxCasa, i);

  // histogramas
  const topo = Math.max(...det.telhados.filter((t, k) => vols[k].papel === "corpo" || vols[k].papel.startsWith("ala")).map(t => t.topo));
  if (casa.pavimentos === 1) { poe(H.cumeeira_terrea_m, topo); poe(H.respaldo_terrea_m, casa.alturas.respaldo); }
  else { poe(H.cumeeira_sobrado_m, topo); poe(H.respaldo_sobrado_m, casa.alturas.respaldo); }
  poe(H.taxa_ocupacao, r.info.ocupacao); poe(H.permeabilidade, r.info.permeabilidade);
  poe(H.declividade, r.info.declive);
  const corpo = vols[0];
  const fr = Math.min(...vols.filter(v => v.papel !== "garagem_leve" && v.papel !== "edicula").map(v => v.v0));
  poe(H.recuo_frontal_m, fr);
  const lu = G.faixa(P, 1, corpo.v0, corpo.v1, (corpo.u0 + corpo.u1) / 2);
  if (lu) { poe(H.recuo_lateral_m, Math.max(0, corpo.u0 - lu[0])); poe(H.recuo_lateral_m, Math.max(0, lu[1] - corpo.u1)); }
  const tras = Math.max(...vols.filter(v => v.papel !== "edicula").map(v => v.v1));
  const lv = G.faixa(P, 0, corpo.u0, corpo.u1, (corpo.v0 + corpo.v1) / 2);
  if (lv) poe(H.recuo_fundo_m, Math.max(0, lv[1] - tras));
  const b = r.info.bairro;
  conta(C.partido, casa.partido); conta(C.bairro, b); conta(C.classe_testada, casa.lote.classe);
  C.forma_por_bairro[b] = C.forma_por_bairro[b] || {}; conta(C.forma_por_bairro[b], r.info.forma + (casa.pavimentos === 2 ? "+sobrado" : "") + (vols.some(v => v.papel === "edicula") ? "+edicula" : ""));
  C.partido_por_bairro[b] = C.partido_por_bairro[b] || {}; conta(C.partido_por_bairro[b], casa.partido);
  conta(C.telhado, casa.telhado.tipo); conta(C.muro_frente, casa.muroFrente);
  conta(C.garagem, casa.garagem.tipo || "sem_garagem");
  conta(C.encostado, casa.encostado.esquerda && casa.encostado.direita ? "dois_lados" : casa.encostado.esquerda || casa.encostado.direita ? "um_lado" : "nenhum");
  conta(C.tentativa_usada, String(r.info.tentativa));
  for (const m of r.info.motivos || []) conta(C.falhas_antes_do_plano, m);
  if (casa.esquina.esquerda || casa.esquina.direita) C.esquina++;
  if (vols.some(v => v.papel === "edicula")) C.edicula++;
  if (casa.piscina) C.piscina++;
  if (casa.pavimentos === 2) C.sobrado++;
  if (casa.embasamento) C.embasamento++;
  if (casa.lote.irregular) C.irregular++;
  if (r.info.testadaInferida) C.testada_inferida++;
  if (r.info.testadaComposta) C.testada_composta++;
  for (const p of det.plantio) { C.plantio++; if (!G.dentro(p.u, p.v, P)) C.plantio_fora_do_lote++; }
}

// colisões: casa nova contra volume mantido e contra outra casa nova
const gradeMant = Grade(50);
for (const j of mantidosLista) gradeMant.poe(B[j].cx, j);
for (let i = 0; i < casasMundo.length; i++) {
  const c = casasMundo[i];
  for (const j of gradeMant.caixa(c.cx)) {
    if (!cruzaCaixa(B[j].cx, c.cx)) continue;
    if (c.aneis.some(a => G.areaIntersecao(a, [B[j].r]) > 0.01)) { anota(falhas.colide_mantido, i, { volume: j }); break; }
  }
  for (const k of gradeNova.caixa(c.cx)) {
    if (k <= i || !cruzaCaixa(casasMundo[k].cx, c.cx)) continue;
    if (c.aneis.some(a => G.areaIntersecao(a, casasMundo[k].aneis) > 0.01)) anota(falhas.sobrepoe_casa_nova, i, { outra: k });
  }
}

// casa sobre a rua: a cidade inteira como fica (volumes mantidos + casas novas),
// contra a mesma conta feita nos volumes de hoje (QA atual: 0,5561 %)
let areaHoje = 0, sobreHoje = 0, areaMant = 0, sobreMant = 0;
let asfaltoHoje = 0, asfaltoSubst = 0;
B.forEach((v, j) => {
  if (v.r.length < 3) return;
  const a = v.area, s = sobreRua(v.r), t = sobreAsfalto(v.r);
  areaHoje += a; sobreHoje += s; asfaltoHoje += t;
  if (plano.mantidos.has(j)) { areaMant += a; sobreMant += s; } else asfaltoSubst += t;
});
const pctHoje = 100 * sobreHoje / areaHoje;
const pctDepois = 100 * (sobreMant + sobreNova) / (areaMant + areaNova);
const pctNovas = 100 * sobreNova / Math.max(areaNova, 1e-9);
tt = marca("qa_ms", tt);

/* =====================================================================
   PORTÕES DUROS, SAÍDA
   ===================================================================== */
const LIMITE_RUA = 0.56;
const portoes = [
  { nome: "janelas a menos de 1,5 m da divisa", valor: tamFalha(falhas.janela_divisa), limite: 0, exemplos: falhas.janela_divisa },
  { nome: "casa sobre a rua (% da área, cidade inteira)", valor: Math.round(pctDepois * 10000) / 10000, limite: LIMITE_RUA,
    detalhe: { hoje_mesma_conta: Math.round(pctHoje * 10000) / 10000, qa_atual: 0.556110237253483, so_casas_novas: Math.round(pctNovas * 10000) / 10000,
               street_tris_pct_hoje: Math.round(10000 * 100 * asfaltoHoje / areaHoje) / 10000,
               street_tris_pct_depois: Math.round(10000 * 100 * (asfaltoHoje - asfaltoSubst + asfaltoNova) / (areaMant + areaNova)) / 10000,
               street_tris_pct_casas_novas: Math.round(10000 * 100 * asfaltoNova / areaNova) / 10000,
               street_tris_pct_volumes_substituidos: Math.round(10000 * 100 * asfaltoSubst / (areaHoje - areaMant)) / 10000 },
    passou: pctDepois <= LIMITE_RUA && pctDepois <= pctHoje + 1e-9 },
  { nome: "casas fora do próprio lote (tolerância 0,05 m)", valor: tamFalha(falhas.fora_do_lote), limite: 0, exemplos: falhas.fora_do_lote },
  { nome: "balanços de sobrado acima do máximo", valor: tamFalha(falhas.balanco), limite: 0, exemplos: falhas.balanco },
  { nome: "garagem sem portão de garagem à frente", valor: tamFalha(falhas.garagem_sem_portao), limite: 0, exemplos: falhas.garagem_sem_portao },
  { nome: "telhado cerâmico fora de 30 a 35%", valor: tamFalha(falhas.telha_fora), limite: 0, exemplos: falhas.telha_fora },
  { nome: "determinismo (SHA-256 de duas execuções)", valor: RAPIDO ? "não medido (--rapido)" : shaA === shaB, limite: true,
    detalhe: { primeira: shaA, segunda: shaB }, passou: RAPIDO ? null : shaA === shaB },
  // além da ESPEC: sem isto uma casa nova pode nascer dentro de um volume que ficou
  { nome: "casa nova sobre volume mantido", valor: tamFalha(falhas.colide_mantido), limite: 0, exemplos: falhas.colide_mantido },
  { nome: "casa nova sobre outra casa nova", valor: tamFalha(falhas.sobrepoe_casa_nova), limite: 0, exemplos: falhas.sobrepoe_casa_nova }
];
for (const p of portoes) if (p.passou === undefined) p.passou = p.valor <= p.limite;
const reprovados = portoes.filter(p => p.passou === false).length;

const recusas = {}, exemplosRecusa = {}, recusasDetalhe = {};
for (const li of ativos) {
  const r = plano.res.get(li);
  if (r.ok) continue;
  conta(recusas, r.motivo);
  for (const m of new Set(r.info.motivos || [r.motivo])) conta(recusasDetalhe, m);
  const ex = exemplosRecusa[r.motivo] = exemplosRecusa[r.motivo] || [];
  if (ex.length < 12) ex.push({ lote: li, id: LOTES[li].id, fonte: LOTES[li].props.fonte, bairro: r.info.bairro, classe: r.info.classe,
    testada: r.info.testada && Math.round(r.info.testada * 10) / 10, fundo: r.info.fundo && Math.round(r.info.fundo * 10) / 10,
    area: Math.round(LOTES[li].area), inferida: r.info.testadaInferida, campo: r.info.campoFora, motivos: r.info.motivos });
}
fs.mkdirSync(SAIDA, { recursive: true });
fs.writeFileSync(path.join(SAIDA, "casas.bin"), Buffer.from(plano.buf));
fs.writeFileSync(path.join(SAIDA, "substituidos.bin"), Buffer.from(plano.subsBuf));
const br = zlib.brotliCompressSync(Buffer.from(plano.buf), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }).length;
const brS = zlib.brotliCompressSync(Buffer.from(plano.subsBuf), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }).length;
tempos.total_ms = Math.round(performance.now() - t0);

const qa = {
  cidade: SLUG, gerado_em: new Date().toISOString(), versao_formato: F.VERSAO, versao_regras: regras.versao,
  reprovados, portoes,
  contagens: {
    volumes_city: B.length, lotes: LOTES.filter(Boolean).length, lotes_com_volume: volumesDoLote.size,
    lotes_candidatos: candidatos.length, lotes_planejados: ativos.length, casas: arq.nCasas,
    volumes_substituidos: F.decodificaSubstituidos(plano.subsBuf).length, volumes_mantidos: plano.mantidos.size,
    pares_de_lotes_sobrepostos: paresSobrepostos, empreendimentos_protegidos: protegidos.map(p => ({ id: p.id, raio_m: Math.round(p.raio * 10) / 10 })),
    voltas_do_ponto_fixo: plano.voltas,
    excluidos_da_selecao: exclusoes, recusados: recusas, recusados_por_tentativa: recusasDetalhe, exemplos_de_recusa: exemplosRecusa, ...C
  },
  histogramas: Object.fromEntries(Object.entries(H).map(([k, h]) => [k, fecha(h)])),
  arquivos: {
    "casas.bin": { bytes: plano.buf.byteLength, brotli_q9: br, sha256: shaA, bytes_por_casa: F.BYTES },
    "substituidos.bin": { bytes: plano.subsBuf.byteLength, brotli_q9: brS, sha256: sha256(plano.subsBuf) }
  },
  tempos
};
fs.writeFileSync(path.join(SAIDA, "qa.json"), JSON.stringify(qa, null, 1) + "\n");

const fmt = n => n.toLocaleString("pt-BR");
console.log(`casas: ${fmt(arq.nCasas)} de ${fmt(ativos.length)} lotes planejados (${fmt(candidatos.length)} candidatos, ${fmt(volumesDoLote.size)} lotes com volume)`);
console.log(`recusados: ${JSON.stringify(recusas)}`);
console.log(`casas.bin ${fmt(plano.buf.byteLength)} B (brotli q9 ${fmt(br)}), substituidos ${fmt(F.decodificaSubstituidos(plano.subsBuf).length)} volumes`);
for (const p of portoes) console.log(`${p.passou === false ? "REPROVA" : p.passou === null ? "  ----" : "  ok   "}  ${p.nome}: ${typeof p.valor === "object" ? JSON.stringify(p.valor) : p.valor}${p.detalhe ? "  " + JSON.stringify(p.detalhe) : ""}`);
console.log(`tempos: ${JSON.stringify(tempos)}`);
process.exitCode = reprovados ? 1 : 0;
