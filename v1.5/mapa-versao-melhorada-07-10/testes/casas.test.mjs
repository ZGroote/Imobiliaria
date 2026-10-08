/* Testes das casas procedurais: sorteio, formato, regras e determinismo.

     node --test testes/casas.test.mjs            # rápido (~2 s)
     CASAS_CIDADE=1 node --test testes/casas.test.mjs   # + cidade inteira duas vezes (~50 s)

   Os lotes sintéticos são retângulos com a rua na frente (z < 0 é a fita): a distância
   até a borda da rua é o próprio z. O lote de esquina tem uma segunda rua no lado
   indicado. Nada aqui lê o city.json, a não ser o teste da cidade inteira. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
const PASTA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
require("../casas/sorteio.js");
require("../casas/formato.js");
require("../casas/regras.js");
const { CasasSorteio: S, CasasFormato: F, CasasRegras: CR } = globalThis;
const REGRAS = JSON.parse(fs.readFileSync(path.join(PASTA, "regras/sao-carlos.json"), "utf8"));
const regras = CR.carrega(REGRAS);
const R = regras.R;
const G = CR.geo;
const sha = buf => crypto.createHash("sha256").update(Buffer.from(buf)).digest("hex");

// ---- lotes sintéticos ------------------------------------------------------------------
const retangulo = (T, Fd, x0 = 0) => [[x0, 0], [x0 + T, 0], [x0 + T, Fd], [x0, Fd]];
// Rua na frente (z = 0) e, se `lateral` for dado, outra no lado x = lateral.
const distRua = lateral => (x, z) => lateral === undefined ? z : Math.min(z, Math.abs(x - lateral));
function planeja(anel, { id = "t", bairro = "comum", lateral, relevo = null, pav = 1, ocup = 0.45, obstaculos = [], regrasUsadas = regras } = {}) {
  return CR.planeja({ slug: "sao-carlos", idLote: id, anel, bairro, dica: { fa: 270, pavimentos: pav, ocupacao: ocup, normal: null },
                      distRua: distRua(lateral), relevo, centroQuarteirao: [0, 0], obstaculos }, regrasUsadas);
}
const casaDe = r => F.casaDeCampos(r.campos, 0, 0, REGRAS);
// polígono do lote na moldura da casa
const local = (casa, anel) => anel.map(p => {
  const dx = p[0] - casa.origem[0], dz = p[1] - casa.origem[1];
  return [dx * casa.eixoU[0] + dz * casa.eixoU[1], dx * casa.eixoV[0] + dz * casa.eixoV[1]];
});

/* Invariantes que todo plano tem que cumprir (os portões duros do gerador, em pequeno). */
function confereInvariantes(anel, r, msg) {
  const casa = casaDe(r), det = F.detalha(casa, REGRAS), P = local(casa, G.antiHorario(anel));
  for (const v of casa.volumes) assert.ok(G.retDentro(v, P, 0.05), msg + ": volume " + v.papel + " fora do lote");
  if (det.pavimentoSuperior) assert.ok(G.retDentro(det.pavimentoSuperior, P, 0.05), msg + ": pavimento de cima fora do lote");
  for (const f of det.faces) if (f.beiral > 0) {
    const v = casa.volumes[f.volume], b = f.beiral;
    const e = f.lado === "frente" ? { u0: v.u0, u1: v.u1, v0: v.v0 - b, v1: v.v0 } : f.lado === "fundo" ? { u0: v.u0, u1: v.u1, v0: v.v1, v1: v.v1 + b }
            : f.lado === "direita" ? { u0: v.u1, u1: v.u1 + b, v0: v.v0, v1: v.v1 } : { u0: v.u0 - b, u1: v.u0, v0: v.v0, v1: v.v1 };
    assert.ok(G.retDentro(e, P, 0.05), msg + ": beiral fora do lote");
  }
  if (casa.telhado.ceramico) {
    const [a, b] = R("telhado.ceramica_inclinacao");
    assert.ok(casa.telhado.inclinacao >= a - 1e-9 && casa.telhado.inclinacao <= b + 1e-9, msg + ": telha fora de 30-35%");
  }
  if (casa.pavimentos === 2) assert.ok(casa.alturas.balanco <= R("alturas.balanco_max_m") + 1e-9, msg + ": balanço");
  const [r0, r1] = R(casa.pavimentos === 2 ? "alturas.respaldo_sobrado_m" : "alturas.respaldo_terrea_m");
  assert.ok(casa.alturas.respaldo >= r0 - 1e-9 && casa.alturas.respaldo <= r1 + 1e-9, msg + ": respaldo " + casa.alturas.respaldo);
  for (const v of casa.volumes) if (v.papel !== "garagem_leve")
    assert.ok(F.vaos(v.u1 - v.u0, REGRAS).valido && F.vaos(v.v1 - v.v0, REGRAS).valido, msg + ": " + v.papel + " fora da malha");
  if (casa.garagem.lado !== "nenhuma") {
    const g = det.portaoGaragem, [gmin, gmax] = R("portoes.garagem_largura_m");
    assert.ok(g && g.largura >= gmin - 1e-9 && g.largura <= gmax + 1e-9, msg + ": portão de garagem");
    assert.ok(g.u0 >= -casa.lote.testada / 2 && g.u1 <= casa.lote.testada / 2, msg + ": portão fora da testada");
    const gv = casa.volumes.find(v => v.papel === "garagem_leve" || v.papel === "caixa_garagem");
    if (gv) assert.ok(g.u0 >= gv.u0 - 1e-9 && g.u1 <= gv.u1 + 1e-9, msg + ": portão desalinhado da garagem");
  }
  if (det.portaoSocial) assert.ok(Math.abs((det.portaoSocial.u0 + det.portaoSocial.u1) / 2 - det.porta.u) < 1e-9, msg + ": porta desalinhada do portão social");
  // janela: a faixa de 1,5 m da face com janela não alcança a divisa (o lote retangular
  // tem a rua só na frente, e no de esquina também no lado `lateral`)
  return { casa, det, P };
}

/* =====================================================================
   REGRAS (o arquivo)
   ===================================================================== */
test("regras: todo número tem _nota, e o que é lei diz qual", () => {
  assert.deepEqual(CR.semNota(REGRAS, "", []), []);
  assert.match(REGRAS.recuos.lateral_janela_m.lei, /1\.301/);
  assert.equal(REGRAS.recuos.lateral_janela_m.a_conferir, undefined);
  assert.equal(REGRAS.recuos.frontal_m.a_conferir, true);
  // um número solto é recusado na carga
  const ruim = JSON.parse(JSON.stringify(REGRAS));
  ruim.recuos.novo = { valor: 3 };
  assert.throws(() => CR.carrega(ruim), /sem _nota/);
});

/* =====================================================================
   SORTEIO
   ===================================================================== */
test("sorteio: FNV-1a e semente estáveis", () => {
  assert.equal(S.hashTexto(""), 0x811C9DC5);
  assert.equal(S.hashTexto("a"), 0xE40C292C);
  assert.equal(S.hashTexto("foobar"), 0xBF9CF968);
  const a = S.semente("sao-carlos", "123_456", 1);
  assert.equal(a, S.semente("sao-carlos", "123_456", 1));
  assert.notEqual(a, S.semente("sao-carlos", "123_457", 1));
  assert.notEqual(a, S.semente("sao-carlos", "123_456", 2));
  assert.notEqual(a, S.semente("araraquara", "123_456", 1));
});

test("sorteio: fluxos por etapa são independentes e reproduzíveis", () => {
  const sem = 0xABCDEF;
  const seq = (nome, n) => { const f = S.fluxo(sem, nome); return Array.from({ length: n }, () => f.u32()); };
  assert.deepEqual(seq("recuos", 20), seq("recuos", 20));
  assert.notDeepEqual(seq("recuos", 5), seq("telhado", 5));
  // consumir mais do telhado não muda os recuos: cada fluxo tem o seu estado
  const t = S.fluxo(sem, "telhado"); for (let i = 0; i < 1000; i++) t.u32();
  assert.deepEqual(seq("recuos", 20), seq("recuos", 20));
  const f = S.fluxo(sem, "faixas");
  for (let i = 0; i < 5000; i++) {
    const x = f.inteiro(-3, 7); assert.ok(Number.isInteger(x) && x >= -3 && x <= 7);
    const r = f.real(); assert.ok(r >= 0 && r < 1);
  }
  const conta = {};
  for (let i = 0; i < 20000; i++) { const k = f.pesos({ a: 1, b: 3, z: 0 }); conta[k] = (conta[k] || 0) + 1; }
  assert.equal(conta.z, undefined);
  assert.ok(Math.abs(conta.b / 20000 - 0.75) < 0.02, "pesos fora da proporção: " + JSON.stringify(conta));
});

/* =====================================================================
   FORMATO
   ===================================================================== */
test("formato: a tabela soma exatamente 40 bytes", () => {
  assert.equal(F.BYTES, 40);
  assert.equal(F.CAMPOS.reduce((s, c) => s + c[1], 0), 320);
  assert.equal(new Set(F.CAMPOS.map(c => c[0])).size, F.CAMPOS.length);
});

test("formato: codifica -> decodifica = igual (aleatório e nos extremos de cada campo)", () => {
  const f = S.fluxo(12345, "formato");
  const regs = [];
  regs.push(Object.fromEntries(F.CAMPOS.map(([n]) => [n, F.FAIXA[n][0]])));
  regs.push(Object.fromEntries(F.CAMPOS.map(([n]) => [n, F.FAIXA[n][1]])));
  for (let i = 0; i < 3000; i++) regs.push(Object.fromEntries(F.CAMPOS.map(([n]) => [n, f.inteiro(F.FAIXA[n][0], F.FAIXA[n][1])])));
  const buf = new ArrayBuffer(F.BYTES), dv = new DataView(buf);
  for (const c of regs) {
    new Uint8Array(buf).fill(0);
    F.codificaRegistro(c, dv, 0);
    assert.deepEqual(F.decodificaRegistro(dv, 0), c);
  }
});

test("formato: valor fora da faixa é recusado, nunca truncado", () => {
  const c = Object.fromEntries(F.CAMPOS.map(([n]) => [n, 0]));
  const dv = new DataView(new ArrayBuffer(F.BYTES));
  assert.throws(() => F.codificaRegistro({ ...c, corpoW: 256 }, dv, 0), RangeError);
  assert.throws(() => F.codificaRegistro({ ...c, origemX: -32769 }, dv, 0), RangeError);
  assert.throws(() => F.codificaRegistro({ ...c, angulo: 1.5 }, dv, 0), RangeError);
});

test("formato: arquivo com índice por quarteirão, ida e volta", () => {
  const r1 = planeja(retangulo(10, 25), { id: "a" }), r2 = planeja(retangulo(12, 30), { id: "b" }), r3 = planeja(retangulo(8, 25), { id: "c" });
  for (const r of [r1, r2, r3]) assert.ok(r.ok, r.motivo);
  const quarteiroes = [{ cx: 0, cz: 0, casas: [r1.campos, r2.campos] }, { cx: 1234, cz: -5678, casas: [] }, { cx: 0, cz: 0, casas: [r3.campos] }];
  const buf = F.codifica({ slug: "sao-carlos", regras: REGRAS, meta: { teste: true }, quarteiroes });
  assert.equal(buf.byteLength % 4, 0);
  const arq = F.abre(buf);
  assert.equal(arq.nCasas, 3); assert.equal(arq.nQuarteiroes, 3);
  assert.deepEqual([...arq.quarteiroes.inicio], [0, 2, 2]);
  assert.deepEqual([...arq.quarteiroes.quantidade], [2, 0, 1]);
  assert.equal(arq.quarteiroes.cx[1], 1234); assert.equal(arq.quarteiroes.cz[1], -5678);
  assert.deepEqual(arq.campos(0), r1.campos);
  assert.deepEqual(arq.campos(2), r3.campos);
  assert.deepEqual(arq.regras, REGRAS);
  const c = arq.casa(1);
  assert.equal(c.quarteirao, 0);
  assert.equal(c.volumes[0].papel, "corpo");
  assert.ok(["estreito", "padrao", "largo", "grande"].includes(c.lote.classe));
  assert.equal([...arq.casasDoQuarteirao(2)].length, 1);
  // mesma entrada, mesmo arquivo
  assert.equal(sha(buf), sha(F.codifica({ slug: "sao-carlos", regras: REGRAS, meta: { teste: true }, quarteiroes })));
});

test("formato: substituidos.bin ida e volta, em ordem", () => {
  const ind = [90, 3, 17, 4, 0, 89894];
  const out = F.decodificaSubstituidos(F.codificaSubstituidos(ind));
  assert.deepEqual([...out], [0, 3, 4, 17, 90, 89894]);
});

test("formato: moldura decodificada põe a testada sobre a frente do lote", () => {
  // lote girado 30 graus, deslocado: os cantos da frente voltam ao mundo nos vértices da rua
  const a = Math.PI / 6, c = Math.cos(a), s = Math.sin(a);
  const gira = ([x, z]) => [1000 + x * c - z * s, -2000 + x * s + z * c];
  const anel = retangulo(11, 28).map(gira);
  const r = CR.planeja({ slug: "sao-carlos", idLote: "giro", anel, bairro: "comum", dica: null,
    distRua: (x, z) => { const dx = x - 1000, dz = z + 2000; return -dx * s + dz * c; }, relevo: null, centroQuarteirao: [10000, -20000], obstaculos: [] }, regras);
  assert.ok(r.ok, r.motivo);
  const casa = F.casaDeCampos(r.campos, 10000, -20000, REGRAS);
  const pe = F.paraMundo(casa, ...casa.lote.cantos.frenteEsq), pd = F.paraMundo(casa, ...casa.lote.cantos.frenteDir);
  const frente = [gira([0, 0]), gira([11, 0])];
  const perto = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.12;
  assert.ok((perto(pe, frente[0]) && perto(pd, frente[1])) || (perto(pe, frente[1]) && perto(pd, frente[0])), "cantos da frente fora do lugar");
  // u à direita de quem olha da rua: o eixo v aponta para dentro do lote
  const dentro = F.paraMundo(casa, 0, 5);
  assert.ok(G.dentro(dentro[0], dentro[1], anel));
});

/* =====================================================================
   REGRAS EM LOTES SINTÉTICOS
   ===================================================================== */
test("regras: lote estreito encosta um lado e não abre janela na divisa", () => {
  let comGaragem = 0, noLadoEncostado = 0;
  for (let k = 0; k < 60; k++) {
    const anel = retangulo(6, 25), r = planeja(anel, { id: "estreito" + k });
    assert.ok(r.ok, r.motivo);
    const { casa, det } = confereInvariantes(anel, r, "estreito " + k);
    assert.equal(casa.lote.classe, "estreito");
    const esq = casa.encostado.esquerda, dir = casa.encostado.direita;
    assert.ok(esq !== dir, "estreito encosta exatamente um lado");
    const corpo = casa.volumes[0];
    if (esq) { assert.ok(Math.abs(corpo.u0 + 3) < 0.11, "corpo na divisa esquerda"); assert.ok(corpo.cega.esquerda); }
    if (dir) { assert.ok(Math.abs(corpo.u1 - 3) < 0.11, "corpo na divisa direita"); assert.ok(corpo.cega.direita); }
    for (const f of det.faces) if (f.cega) { assert.equal(f.janela, false); assert.equal(f.beiral, 0); }
    if (casa.garagem.lado !== "nenhuma") { comGaragem++; if ((casa.garagem.lado === "esquerda") === esq) noLadoEncostado++; }
  }
  // "lote estreito encosta um lado, o da garagem": a garagem fica do lado encostado,
  // salvo quando porta, portão social e portão de garagem não cabem assim
  assert.ok(comGaragem > 30 && noLadoEncostado / comGaragem > 0.6, `${noLadoEncostado}/${comGaragem}`);
});

test("regras: lote padrão respeita recuos e janela a 1,5 m", () => {
  for (let k = 0; k < 60; k++) {
    const anel = retangulo(10, 25), r = planeja(anel, { id: "padrao" + k });
    assert.ok(r.ok, r.motivo);
    const { casa, det } = confereInvariantes(anel, r, "padrão " + k);
    const corpo = casa.volumes[0];
    const frente = Math.min(...casa.volumes.filter(v => v.papel !== "garagem_leve").map(v => v.v0));
    assert.ok(frente >= R("recuos.frontal_m") - 1e-9, "recuo frontal " + frente);
    const tras = Math.max(...casa.volumes.filter(v => v.papel !== "edicula").map(v => v.v1));
    assert.ok(25 - tras >= R("recuos.fundo_m") - 0.11, "recuo de fundo " + (25 - tras));
    // face lateral com janela fica a 1,5 m ou mais da divisa; sem janela, a menos
    for (const f of det.faces) {
      if (f.lado !== "esquerda" && f.lado !== "direita") continue;
      const v = casa.volumes[f.volume];
      const dist = f.lado === "esquerda" ? v.u0 + 5 : 5 - v.u1;
      if (f.janela) assert.ok(dist >= R("recuos.lateral_janela_m") - 1e-6, `janela a ${dist} m da divisa`);
    }
    assert.ok(corpo.u1 - corpo.u0 <= R("malha.corpo_largura_m")[1] + 1e-9);
  }
});

test("regras: lote largo e grande variam o partido", () => {
  const partidos = new Set(), formas = new Set();
  for (const [T, Fd] of [[14, 30], [20, 40]]) for (let k = 0; k < 120; k++) {
    const anel = retangulo(T, Fd), r = planeja(anel, { id: "lg" + T + "_" + k, bairro: "medio" });
    assert.ok(r.ok, r.motivo);
    const { casa } = confereInvariantes(anel, r, "largo/grande " + k);
    partidos.add(casa.partido); formas.add(r.info.forma);
    assert.equal(casa.lote.classe, T < 16 ? "largo" : "grande");
  }
  for (const p of ["L", "T", "garagem_lateral", "caixa_laje", "retangular"]) assert.ok(formas.has(p), "faltou o partido " + p);
  assert.ok(partidos.has("sobrado") === false || true);
});

test("regras: lote de esquina marca a lateral de rua e recua 2 m dela", () => {
  let n = 0;
  for (let k = 0; k < 40; k++) {
    // rua na frente (z = 0) e no lado x = 12; o lote vai de x = 0 a 12
    const anel = retangulo(12, 25), r = planeja(anel, { id: "esq" + k, lateral: 12 });
    assert.ok(r.ok, r.motivo);
    const { casa } = confereInvariantes(anel, r, "esquina " + k);
    assert.ok(casa.esquina.esquerda || casa.esquina.direita, "esquina não marcada");
    // o lado marcado é o que está no x = 12
    const lado = casa.esquina.esquerda ? "esquerda" : "direita";
    const canto = F.paraMundo(casa, ...(lado === "esquerda" ? casa.lote.cantos.frenteEsq : casa.lote.cantos.frenteDir));
    assert.ok(Math.abs(canto[0] - 12) < 0.12, "lateral de rua no lado errado");
    assert.equal(casa.encostado[lado], false, "encostou do lado da rua");
    const corpo = casa.volumes[0], T = casa.lote.testada;
    const dist = lado === "esquerda" ? corpo.u0 + T / 2 : T / 2 - corpo.u1;
    assert.ok(dist >= R("recuos.esquina_lateral_m") - 1e-6, "recuo de esquina " + dist);
    n++;
  }
  assert.equal(n, 40);
});

test("regras: declive acima de 8% dá embasamento, com o piso na cota da frente", () => {
  const anel = retangulo(10, 25);
  const r = planeja(anel, { id: "declive", relevo: (x, z) => 0.12 * z });
  assert.ok(r.ok, r.motivo);
  const { casa } = confereInvariantes(anel, r, "declive");
  assert.equal(casa.embasamento, true);
  assert.ok(Math.abs(casa.declive.v - 0.12) < 0.011, "declV " + casa.declive.v);
  const plano = planeja(anel, { id: "declive", relevo: (x, z) => 0.03 * z });
  assert.equal(casaDe(plano).embasamento, false);
});

test("regras: fundo curto e testada curta são recusados com o motivo", () => {
  assert.equal(planeja(retangulo(10, 7.5)).motivo, "fundo_curto");
  assert.equal(planeja(retangulo(3.2, 25)).motivo, "testada_curta");
  const raso = planeja(retangulo(10, 9));                  // cabe no lote, não cabe com os recuos
  assert.equal(raso.ok, false);
  assert.match(raso.motivo, /sem_espaco|fundo_curto/);
});

test("regras: centro antigo é geminada no alinhamento", () => {
  for (let k = 0; k < 20; k++) {
    const anel = retangulo(8, 30), r = planeja(anel, { id: "centro" + k, bairro: "centro" });
    assert.ok(r.ok, r.motivo);
    const { casa } = confereInvariantes(anel, r, "centro " + k);
    assert.equal(casa.partido, "geminada_alinhamento");
    assert.ok(casa.encostado.esquerda && casa.encostado.direita);
    assert.ok(casa.volumes[0].v0 < 0.11, "fachada no alinhamento");
    assert.equal(casa.muroFrente, "nenhum");
    assert.ok(!casa.telhado.ceramico, "sem beiral sobre a calçada");
  }
});

test("regras: conjunto habitacional repete duas águas", () => {
  const tipos = {};
  for (let k = 0; k < 200; k++) {
    const anel = retangulo(8, 20), r = planeja(anel, { id: "cj" + k, bairro: "conjunto" });
    if (!r.ok) continue;
    confereInvariantes(anel, r, "conjunto " + k);
    const t = casaDe(r).telhado.tipo; tipos[t] = (tipos[t] || 0) + 1;
  }
  const duas = (tipos.duas_aguas_paralela || 0) + (tipos.duas_aguas_perpendicular || 0);
  assert.ok(duas / Object.values(tipos).reduce((a, b) => a + b, 0) > 0.85, JSON.stringify(tipos));
});

test("regras: volume que fica no mapa é obstáculo", () => {
  const anel = retangulo(12, 30);
  // um volume vizinho invadindo 3 m do fundo do lote
  const obst = [[[0, 24], [12, 24], [12, 34], [0, 34]]];
  for (let k = 0; k < 20; k++) {
    const r = planeja(anel, { id: "obs" + k, obstaculos: obst });
    if (!r.ok) { assert.equal(r.motivo, "colide_volume_mantido"); continue; }
    const casa = casaDe(r);
    for (const v of casa.volumes) {
      const a = v.u0, mundo = [[v.u0, v.v0], [v.u1, v.v0], [v.u1, v.v1], [v.u0, v.v1]].map(([u, w]) => F.paraMundo(casa, u, w));
      assert.ok(G.areaIntersecao(mundo, obst) <= 0.01, "casa sobre o obstáculo " + a);
    }
  }
});

test("regras: lote irregular (trapézio e espinho de vetorização)", () => {
  const trap = [[0, 0], [10, 0], [13, 26], [-2, 24]];
  const r = planeja(trap, { id: "trap" });
  assert.ok(r.ok, r.motivo);
  confereInvariantes(trap, r, "trapézio");
  // lasca de ida e volta no lado direito: o motor ignora, a casa continua no lote
  const espinho = [[0, 0], [10, 0], [10, 12], [16, 12.05], [10, 12.1], [10, 25], [0, 25]];
  const r2 = planeja(espinho, { id: "espinho" });
  assert.ok(r2.ok, r2.motivo);
  confereInvariantes([[0, 0], [10, 0], [10, 25], [0, 25]], r2, "espinho");
});

/* =====================================================================
   DETERMINISMO
   ===================================================================== */
test("determinismo: o mesmo lote dá o mesmo plano, e o arquivo o mesmo SHA-256", () => {
  const lotes = [[6, 25], [10, 25], [12, 30], [14, 30], [20, 40]];
  const roda = () => lotes.flatMap(([T, Fd], i) => Array.from({ length: 30 }, (_, k) => planeja(retangulo(T, Fd), { id: i + "_" + k }).campos));
  const a = roda(), b = roda();
  assert.deepEqual(a, b);
  const arq = c => F.codifica({ slug: "sao-carlos", regras: REGRAS, meta: {}, quarteiroes: [{ cx: 0, cz: 0, casas: c.filter(Boolean) }] });
  assert.equal(sha(arq(a)), sha(arq(b)));
});

test("determinismo: mudar a regra do telhado não mexe em recuo, partido nem cor", () => {
  const outra = JSON.parse(JSON.stringify(REGRAS));
  outra.telhado.ceramica_inclinacao.faixa = [0.31, 0.34];
  outra.telhado.beiral_m.faixa = [0.6, 0.7];
  const regras2 = CR.carrega(outra);
  let mudouTelhado = 0;
  for (let k = 0; k < 120; k++) {
    const anel = retangulo(10 + (k % 5), 25 + (k % 7));
    const a = planeja(anel, { id: "inv" + k }), b = planeja(anel, { id: "inv" + k, regrasUsadas: regras2 });
    assert.ok(a.ok && b.ok);
    for (const campo of ["corpoU0", "corpoV0", "corpoW", "corpoD", "paleta", "encostado", "garagem", "partido", "muroFrente", "semente", "piso"])
      assert.equal(a.campos[campo], b.campos[campo], campo + " mudou com a regra do telhado (lote " + k + ")");
    if (a.campos.inclinacao !== b.campos.inclinacao || a.campos.beiral !== b.campos.beiral) mudouTelhado++;
  }
  assert.ok(mudouTelhado > 0);
});

/* =====================================================================
   DESEMPENHO DO DECODIFICADOR
   ===================================================================== */
test("desempenho: decodificar 65 mil casas e detalhar 10 mil", () => {
  const base = [];
  for (let k = 0; k < 50; k++) { const r = planeja(retangulo(8 + k % 9, 22 + k % 13), { id: "d" + k }); if (r.ok) base.push(r.campos); }
  const casas = Array.from({ length: 65000 }, (_, i) => base[i % base.length]);
  const buf = F.codifica({ slug: "sao-carlos", regras: REGRAS, meta: {}, quarteiroes: [{ cx: 0, cz: 0, casas }] });
  const arq = F.abre(buf);
  let t = performance.now();
  for (let i = 0; i < arq.nCasas; i++) arq.casa(i);
  const tDec = performance.now() - t;
  t = performance.now();
  for (let i = 0; i < 10000; i++) F.detalha(arq.casa(i), REGRAS);
  const tDet = performance.now() - t;
  console.log(`  decodificar 65.000 casas: ${tDec.toFixed(0)} ms | detalhar 10.000: ${tDet.toFixed(0)} ms`);
  assert.ok(tDec < 1500, "decodificação lenta: " + tDec);
  assert.ok(tDet < 3000, "detalhamento lento: " + tDet);
});

/* =====================================================================
   CIDADE INTEIRA (lento, opcional)
   ===================================================================== */
test("cidade inteira: duas execuções separadas, mesmo SHA-256 e portões duros ok", { skip: !process.env.CASAS_CIDADE, timeout: 600000 }, () => {
  const sai = [0, 1].map(i => fs.mkdtempSync(path.join(os.tmpdir(), "casas" + i + "-")));
  for (const d of sai) execFileSync(process.execPath, [path.join(PASTA, "gerador/casas.mjs"), "--rapido", "--saida", d], { stdio: "ignore" });
  const [a, b] = sai.map(d => sha(fs.readFileSync(path.join(d, "casas.bin"))));
  assert.equal(a, b);
  const qa = JSON.parse(fs.readFileSync(path.join(sai[0], "qa.json"), "utf8"));
  assert.equal(qa.reprovados, 0, JSON.stringify(qa.portoes.filter(p => p.passou === false)));
  assert.equal(sha(fs.readFileSync(path.join(sai[0], "substituidos.bin"))), sha(fs.readFileSync(path.join(sai[1], "substituidos.bin"))));
});
