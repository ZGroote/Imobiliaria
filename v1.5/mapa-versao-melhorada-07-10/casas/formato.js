/* Plano binário das casas procedurais: codifica, decodifica e detalha.

   ======================================================================
   FORMATO (versão 1)
   ======================================================================

   Tudo little-endian. Um arquivo `casas.bin` tem quatro partes, nesta ordem:

     1. Cabeçalho fixo, 24 bytes
          0  4 B  "CASA"                     (assinatura)
          4  u16  versão do formato = 1
          6  u16  bytes por registro = 40
          8  u32  número de casas
         12  u32  número de quarteirões      (= número de entradas de `bl` do city.json)
         16  u32  bytes do JSON (sem o preenchimento)
         20  u32  reservado (0)
     2. JSON UTF-8, preenchido com espaços até múltiplo de 4:
          { "formato": 1, "slug", "regras": <regras/sao-carlos.json inteiro>, "meta": {...} }
        As regras vão junto para o navegador detalhar a casa com OS MESMOS números do
        gerador (piscina, portões, alturas); nenhum número de cidade fica no código.
     3. Índice por quarteirão, 16 bytes cada, na ordem do `bl`:
          i32 cx (dm)  i32 cz (dm)  u32 início  u32 quantidade
        cx/cz é o centro do quarteirão copiado do `bl` (já em dm); a origem de cada casa é
        relativa a ele. início/quantidade indexam os registros (não bytes).
     4. Registros, 40 bytes = 320 bits cada, agrupados por quarteirão.

   O registro é um fluxo de bits: o campo i ocupa `bits` bits a partir do bit somado dos
   anteriores, com o bit 0 do registro no bit menos significativo do primeiro u32 (os 10
   u32 do registro são little-endian). Campo com sinal é complemento de dois na largura
   dele. A tabela CAMPOS abaixo é a definição; esta lista é a explicação.

     MOLDURA DO LOTE (103 bits)
       origemX, origemZ   16+16 s  dm, meio da testada relativo ao centro do quarteirão
       angulo             16    u  eixo u = (cos θ, sin θ) no mapa (x leste, z sul),
                                   θ = angulo·2π/65536. O eixo v (entra no lote) é
                                   (sen θ, −cos θ): u fica à DIREITA de quem olha o lote
                                   da rua. Ponto local (u, v) -> mundo: O + u·U + v·V.
       testada            11    u  dm. Cantos da frente: (−testada/2, 0) e (+testada/2, 0)
       fundoEsqU/V        11 s/u   dm, canto de fundo esquerdo (u < 0) na moldura
       fundoDirU/V        11 s/u   dm, canto de fundo direito
     IDENTIDADE (32 bits)
       semente            24    u  semente do lote (hash de slug|id|versão, 24 bits
                                   baixos). Fluxos do navegador: CasasSorteio.fluxo(semente, etapa)
       portaU              8    u  dm: centro da porta social a partir de corpo.u0
     DECISÕES DE REGRA (24 bits)
       partido             3    PARTIDOS        telhado      3   TELHADOS
       sobrado             1    0 térrea, 1 dois pavimentos
       encostado           2    bit0 esquerda, bit1 direita (face cega na divisa)
       garagem             2    0 sem, 1 esquerda, 2 direita (lado do portão de garagem)
       esquina             2    bit0 rua à esquerda, bit1 rua à direita
       muroFrente          2    MUROS_FRENTE    piscina      1
       ala                 3    ALAS (papel do 2º retângulo)
       edicula             1    ediculaMeiaAgua 1   garagemTelha 1 (0 pergolado, 1 telha)
       irregular           1    o quadrilátero do lote é aproximado (IoU < regra)
       embasamento         1    declive acima do limite: embasamento/arrimo aparente
     MEDIDAS (44 bits)
       balanco             4    dm, balanço frontal do pavimento de cima
       inclinacao          7    0,5 %   (cerâmica 60..70 = 30..35 %)
       beiral              5    5 cm
       piso                6    cm acima do terreno na frente
       peDireito           6    cm acima de 2,40 m
       declV, declU        6+6 s %   declividade ao longo de v (fundo − frente) e de u
       paleta              4    índice em regras.cores.paletas.lista
     RETÂNGULOS NA MOLDURA, em dm (116 bits + 1 reservado)
       corpo   u0 11 s, v0 11, w 8, d 8, cega 4
       ala     du 9 s (u0 − corpo.u0), dv 9 s (v0 − corpo.v0), w 8, d 8, cega 4
       edicula u0 9 s, dv 9 (v0 − (corpo.v0 + corpo.d)), w 7, d 7, cega 4
       cega: bit0 frente (v = v0), bit1 direita (u = u1), bit2 fundo (v = v1),
             bit3 esquerda (u = u0). Face cega = a menos de 1,5 m da divisa, ou interna:
             sem janela e sem beiral.

   POR QUE ASSIM, E NÃO A SUGESTÃO DA ESPEC AO PÉ DA LETRA
   - Origem em int16 relativo ao quarteirão (não int32 absoluto): o volume mais distante
     do centro do seu quarteirão está a 2,34 km, dentro dos ±3,27 km do int16 em dm.
   - Os cantos da FRENTE não são gravados: são (±testada/2, 0) por construção, porque a
     origem é o meio da testada e o eixo u corre ao longo dela. Os dois de fundo bastam.
   - A semente tem 24 bits (a ESPEC sugere u32) para caber a posição da porta: a regra
     "porta alinhada ao portão social" depende da garagem, do lado encostado e do lote
     estreito, e não sai da semente. 16 milhões de sementes sobram para variar cor e
     janela de 65 mil casas.
   - O fundo do lote não é gravado: sai dos cantos de fundo.
   - O 2º e o 3º retângulos são relativos ao corpo, que é onde eles sempre encostam.

   `substituidos.bin`: "SUBS", u16 versão = 1, u16 reservado, u32 n, depois n x u32 com
   os índices de `b` (city.json) que o renderizador pula, em ordem crescente.
   ====================================================================== */
(function (root) {
  "use strict";

  const VERSAO = 1;
  const BYTES = 40;
  const ASSINATURA = "CASA";

  // [nome, bits, com sinal]. A ORDEM É O FORMATO: não reordene sem subir VERSAO.
  const CAMPOS = [
    ["origemX", 16, 1], ["origemZ", 16, 1], ["angulo", 16, 0], ["testada", 11, 0],
    ["fundoEsqU", 11, 1], ["fundoEsqV", 11, 0], ["fundoDirU", 11, 1], ["fundoDirV", 11, 0],
    ["semente", 24, 0], ["portaU", 8, 0],
    ["partido", 3, 0], ["telhado", 3, 0], ["sobrado", 1, 0], ["encostado", 2, 0],
    ["garagem", 2, 0], ["esquina", 2, 0], ["muroFrente", 2, 0], ["piscina", 1, 0],
    ["ala", 3, 0], ["edicula", 1, 0], ["ediculaMeiaAgua", 1, 0], ["garagemTelha", 1, 0],
    ["irregular", 1, 0], ["embasamento", 1, 0],
    ["balanco", 4, 0], ["inclinacao", 7, 0], ["beiral", 5, 0], ["piso", 6, 0],
    ["peDireito", 6, 0], ["declV", 6, 1], ["declU", 6, 1], ["paleta", 4, 0],
    ["corpoU0", 11, 1], ["corpoV0", 11, 0], ["corpoW", 8, 0], ["corpoD", 8, 0], ["corpoCega", 4, 0],
    ["alaDu", 9, 1], ["alaDv", 9, 1], ["alaW", 8, 0], ["alaD", 8, 0], ["alaCega", 4, 0],
    ["ediculaU0", 9, 1], ["ediculaDv", 9, 0], ["ediculaW", 7, 0], ["ediculaD", 7, 0], ["ediculaCega", 4, 0],
    ["reservado", 1, 0]
  ];
  // Faixa de cada campo, para o codificador recusar (e não truncar em silêncio) um valor
  // que não cabe. Truncar giraria a casa ou mandaria o corpo para o outro lado do lote.
  const FAIXA = {};
  let _bitsTotal = 0;
  for (const [nome, bits, sinal] of CAMPOS) {
    FAIXA[nome] = sinal ? [-(2 ** (bits - 1)), 2 ** (bits - 1) - 1] : [0, 2 ** bits - 1];
    _bitsTotal += bits;
  }
  if (_bitsTotal !== BYTES * 8) throw new Error("CasasFormato: tabela soma " + _bitsTotal + " bits");

  const PARTIDOS = ["retangular", "L", "T", "garagem_lateral", "caixa_laje", "edicula_fundo", "sobrado", "geminada_alinhamento"];
  const TELHADOS = ["quatro_aguas", "duas_aguas_paralela", "duas_aguas_perpendicular", "platibanda", "laje"];
  const MUROS_FRENTE = ["gradil", "muro_alto", "muro_baixo", "nenhum"];
  const ALAS = ["nenhuma", "ala_l", "ala_t", "garagem_leve", "caixa_garagem", "caixa_varanda"];
  const LADOS = ["frente", "direita", "fundo", "esquerda"];
  const CERAMICOS = new Set([0, 1, 2]);

  /* ---- leitura de regra ---------------------------------------------------
     Uma regra é {valor} | {faixa:[a,b]} | {pesos:{}} | {lista:[]} | {limites_m:[]}
     com `_nota`. Quem lê não precisa saber qual das formas: pega o conteúdo. */
  function valorRegra(no) {
    if (no == null) throw new Error("regra ausente");
    if (typeof no !== "object") return no;
    if ("valor" in no) return no.valor;
    if ("faixa" in no) return no.faixa;
    if ("pesos" in no) return no.pesos;
    if ("lista" in no) return no.lista;
    return no;
  }
  function regra(regras, caminho) {
    let no = regras;
    for (const k of caminho.split(".")) {
      if (no == null || !(k in no)) throw new Error("regra não encontrada: " + caminho);
      no = no[k];
    }
    return valorRegra(no);
  }

  /* ---- registro <-> campos ------------------------------------------------ */
  function codificaRegistro(campos, dv, off) {
    const w = new Uint32Array(BYTES / 4);
    let pos = 0;
    for (const [nome, bits] of CAMPOS) {
      let v = campos[nome];
      if (v === undefined) v = 0;
      if (!Number.isInteger(v) || v < FAIXA[nome][0] || v > FAIXA[nome][1])
        throw new RangeError("campo " + nome + " fora da faixa: " + v);
      v = bits === 32 ? v >>> 0 : (v & ((1 << bits) - 1)) >>> 0;
      const i = pos >>> 5, o = pos & 31, baixo = Math.min(bits, 32 - o);
      w[i] = (w[i] | (v << o)) >>> 0;
      if (bits > baixo) w[i + 1] = (w[i + 1] | (v >>> baixo)) >>> 0;
      pos += bits;
    }
    for (let i = 0; i < w.length; i++) dv.setUint32(off + i * 4, w[i], true);
  }

  function decodificaRegistro(dv, off, saida) {
    const o = saida || {};
    let pos = 0;
    // Lê os 10 u32 uma vez: cada campo vem de no máximo dois deles.
    const w0 = [];
    for (let i = 0; i < BYTES / 4; i++) w0.push(dv.getUint32(off + i * 4, true));
    for (const [nome, bits, sinal] of CAMPOS) {
      const i = pos >>> 5, b = pos & 31, baixo = Math.min(bits, 32 - b);
      let v = (w0[i] >>> b) & (baixo === 32 ? 0xFFFFFFFF : (1 << baixo) - 1);
      if (bits > baixo) v |= (w0[i + 1] & ((1 << (bits - baixo)) - 1)) << baixo;
      v >>>= 0;
      if (sinal && bits < 32 && (v & (1 << (bits - 1)))) v -= 2 ** bits;
      o[nome] = v;
      pos += bits;
    }
    return o;
  }

  /* ---- arquivo ------------------------------------------------------------
     `quarteiroes`: [{ cx, cz (dm, inteiros do bl), casas: [campos, ...] }]. */
  function codifica({ slug, regras, meta, quarteiroes }) {
    const json = new TextEncoder().encode(JSON.stringify({ formato: VERSAO, slug, regras, meta: meta || {} }));
    const jsonPad = (json.length + 3) & ~3;
    let n = 0;
    for (const q of quarteiroes) n += q.casas.length;
    const inicioIndice = 24 + jsonPad;
    const inicioReg = inicioIndice + quarteiroes.length * 16;
    const buf = new ArrayBuffer(inicioReg + n * BYTES);
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) u8[i] = ASSINATURA.charCodeAt(i);
    dv.setUint16(4, VERSAO, true); dv.setUint16(6, BYTES, true);
    dv.setUint32(8, n, true); dv.setUint32(12, quarteiroes.length, true);
    dv.setUint32(16, json.length, true); dv.setUint32(20, 0, true);
    u8.set(json, 24);
    for (let i = json.length; i < jsonPad; i++) u8[24 + i] = 0x20;
    let k = 0;
    quarteiroes.forEach((q, qi) => {
      const o = inicioIndice + qi * 16;
      dv.setInt32(o, q.cx, true); dv.setInt32(o + 4, q.cz, true);
      dv.setUint32(o + 8, k, true); dv.setUint32(o + 12, q.casas.length, true);
      for (const c of q.casas) codificaRegistro(c, dv, inicioReg + (k++) * BYTES);
    });
    return buf;
  }

  function abre(buffer) {
    const buf = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    const ass = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
    if (ass !== ASSINATURA) throw new Error("casas.bin: assinatura inválida");
    const versao = dv.getUint16(4, true), bytes = dv.getUint16(6, true);
    if (versao !== VERSAO || bytes !== BYTES) throw new Error("casas.bin: versão " + versao + "/" + bytes + " não suportada");
    const nCasas = dv.getUint32(8, true), nQ = dv.getUint32(12, true), nJson = dv.getUint32(16, true);
    const cab = JSON.parse(new TextDecoder().decode(u8.subarray(24, 24 + nJson)));
    const inicioIndice = 24 + ((nJson + 3) & ~3), inicioReg = inicioIndice + nQ * 16;
    // Índice em typed arrays: o renderizador consulta isto por quarteirão no streaming.
    const qcx = new Int32Array(nQ), qcz = new Int32Array(nQ), qini = new Uint32Array(nQ), qn = new Uint32Array(nQ);
    const quarteiraoDe = new Int32Array(nCasas);
    for (let q = 0; q < nQ; q++) {
      const o = inicioIndice + q * 16;
      qcx[q] = dv.getInt32(o, true); qcz[q] = dv.getInt32(o + 4, true);
      qini[q] = dv.getUint32(o + 8, true); qn[q] = dv.getUint32(o + 12, true);
      for (let i = qini[q]; i < qini[q] + qn[q]; i++) quarteiraoDe[i] = q;
    }
    const arq = {
      versao, nCasas, nQuarteiroes: nQ, slug: cab.slug, regras: cab.regras, meta: cab.meta,
      quarteiroes: { cx: qcx, cz: qcz, inicio: qini, quantidade: qn },
      campos(i, saida) { return decodificaRegistro(dv, inicioReg + i * BYTES, saida); },
      casa(i) {
        const q = quarteiraoDe[i];
        const c = casaDeCampos(arq.campos(i), qcx[q], qcz[q], cab.regras);
        c.indice = i; c.quarteirao = q;
        return c;
      },
      *casasDoQuarteirao(q) { for (let i = qini[q]; i < qini[q] + qn[q]; i++) yield arq.casa(i); }
    };
    return arq;
  }

  function codificaSubstituidos(indices) {
    const ord = Uint32Array.from(indices).sort();
    const buf = new ArrayBuffer(12 + ord.length * 4), dv = new DataView(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) u8[i] = "SUBS".charCodeAt(i);
    dv.setUint16(4, 1, true); dv.setUint16(6, 0, true); dv.setUint32(8, ord.length, true);
    for (let i = 0; i < ord.length; i++) dv.setUint32(12 + i * 4, ord[i], true);
    return buf;
  }
  function decodificaSubstituidos(buffer) {
    const buf = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== "SUBS") throw new Error("substituidos.bin: assinatura inválida");
    const n = dv.getUint32(8, true), out = new Uint32Array(n);
    for (let i = 0; i < n; i++) out[i] = dv.getUint32(12 + i * 4, true);
    return out;
  }

  /* ---- campos -> casa com nomes claros ------------------------------------
     Tudo em METROS e frações. Coordenadas (u, v) na moldura local; `paraMundo`
     leva ao mapa. */
  const cegaDe = m => ({ frente: !!(m & 1), direita: !!(m & 2), fundo: !!(m & 4), esquerda: !!(m & 8) });
  const ret = (u0, v0, w, d) => ({ u0: u0 / 10, v0: v0 / 10, u1: (u0 + w) / 10, v1: (v0 + d) / 10 });

  function casaDeCampos(c, cxDm, czDm, regras) {
    const th = c.angulo * 2 * Math.PI / 65536;
    const ux = Math.cos(th), uz = Math.sin(th);
    const T = c.testada / 10;
    const lim = regra(regras, "lote.classes_testada.limites_m");
    const nomes = regras.lote.classes_testada.nomes;
    let classe = nomes[lim.length];
    for (let i = 0; i < lim.length; i++) if (T < lim[i]) { classe = nomes[i]; break; }
    const pav = c.sobrado ? 2 : 1;
    const laje = regra(regras, "alturas.laje_m");
    const piso = c.piso / 100, pd = (240 + c.peDireito) / 100;
    const volumes = [];
    const corpo = Object.assign({ papel: "corpo", pavimentos: pav, cega: cegaDe(c.corpoCega) },
      ret(c.corpoU0, c.corpoV0, c.corpoW, c.corpoD));
    volumes.push(corpo);
    if (c.ala) volumes.push(Object.assign({ papel: ALAS[c.ala], pavimentos: 1, cega: cegaDe(c.alaCega) },
      ret(c.corpoU0 + c.alaDu, c.corpoV0 + c.alaDv, c.alaW, c.alaD)));
    if (c.edicula) volumes.push(Object.assign({ papel: "edicula", pavimentos: 1, cega: cegaDe(c.ediculaCega), meiaAgua: !!c.ediculaMeiaAgua },
      ret(c.ediculaU0, c.corpoV0 + c.corpoD + c.ediculaDv, c.ediculaW, c.ediculaD)));
    const tipoAla = ALAS[c.ala];
    return {
      semente: c.semente,
      origem: [(cxDm + c.origemX) / 10, (czDm + c.origemZ) / 10],
      angulo: th, eixoU: [ux, uz], eixoV: [uz, -ux],
      lote: {
        testada: T, classe, irregular: !!c.irregular,
        cantos: { frenteEsq: [-T / 2, 0], frenteDir: [T / 2, 0],
                  fundoDir: [c.fundoDirU / 10, c.fundoDirV / 10], fundoEsq: [c.fundoEsqU / 10, c.fundoEsqV / 10] }
      },
      partido: PARTIDOS[c.partido],
      telhado: { tipo: TELHADOS[c.telhado], ceramico: CERAMICOS.has(c.telhado),
                 inclinacao: c.inclinacao / 200, beiral: c.beiral * 0.05 },
      pavimentos: pav,
      encostado: { esquerda: !!(c.encostado & 1), direita: !!(c.encostado & 2) },
      esquina: { esquerda: !!(c.esquina & 1), direita: !!(c.esquina & 2) },
      garagem: {
        lado: c.garagem === 1 ? "esquerda" : c.garagem === 2 ? "direita" : "nenhuma",
        tipo: !c.garagem ? null : tipoAla === "garagem_leve" ? "leve" : tipoAla === "caixa_garagem" ? "laje" : "vaga",
        telha: !!c.garagemTelha
      },
      muroFrente: MUROS_FRENTE[c.muroFrente],
      piscina: !!c.piscina, embasamento: !!c.embasamento,
      declive: { v: c.declV / 100, u: c.declU / 100 },
      alturas: { piso, peDireito: pd, laje, respaldo: Math.round((piso + pav * (pd + laje)) * 100) / 100,
                 balanco: c.balanco / 10 },
      paleta: c.paleta,
      porta: c.portaU / 10,
      volumes
    };
  }

  function paraMundo(casa, u, v) {
    return [casa.origem[0] + u * casa.eixoU[0] + v * casa.eixoV[0],
            casa.origem[1] + u * casa.eixoU[1] + v * casa.eixoV[1]];
  }

  /* ---- detalhamento -------------------------------------------------------
     O que é decidido por REGRA mas não precisa de bit no plano: posição dos portões,
     da vaga, do piso de entrada, da piscina, as faces com beiral, as alturas de cada
     telhado e a cor exata. Mora aqui, e não no gerador nem na geometria, porque os
     dois precisam da MESMA resposta: o gerador confere os portões duros (garagem com
     portão, janela longe da divisa) em cima disto, e a geometria desenha isto. Se cada
     um derivasse do seu jeito, o QA aprovaria uma casa que o navegador desenha outra. */
  const SORTEIO = () => {
    const S = root.CasasSorteio;
    if (!S) throw new Error("CasasFormato.detalha precisa de casas/sorteio.js carregado antes");
    return S;
  };
  const entreM = (f, faixa, passo) => {        // sorteio em passos fixos (cm/dm): determinístico
    const a = Math.round(faixa[0] / passo), b = Math.round(faixa[1] / passo);
    return f.inteiro(a, b) * passo;
  };
  const corDeHex = h => { const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

  // Desvio HSL igual ao offsetHSL do three (que buildings.js usa), em 0..255.
  function desviaHSL(rgb, dh, ds, dl) {
    let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0, l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l <= 0.5 ? d / (mx + mn) : d / (2 - mx - mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    h = ((h + dh) % 1 + 1) % 1; s = Math.min(1, Math.max(0, s + ds)); l = Math.min(1, Math.max(0, l + dl));
    const hue = (p, q, t) => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    if (s === 0) r = g = b = l;
    else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3); }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  // Trechos [a, b] de uma face (na coordenada que corre ao longo dela) cobertos por
  // outro volume encostado nela. A geometria não põe janela ali.
  function cobertosDaFace(vol, lado, outros) {
    const out = [], eps = 1e-6;
    for (const o of outros) {
      if (o === vol) continue;
      let enc = false, a = 0, b = 0;
      if (lado === "frente" && Math.abs(o.v1 - vol.v0) < eps) { enc = true; a = Math.max(o.u0, vol.u0); b = Math.min(o.u1, vol.u1); }
      else if (lado === "fundo" && Math.abs(o.v0 - vol.v1) < eps) { enc = true; a = Math.max(o.u0, vol.u0); b = Math.min(o.u1, vol.u1); }
      else if (lado === "esquerda" && Math.abs(o.u1 - vol.u0) < eps) { enc = true; a = Math.max(o.v0, vol.v0); b = Math.min(o.v1, vol.v1); }
      else if (lado === "direita" && Math.abs(o.u0 - vol.u1) < eps) { enc = true; a = Math.max(o.v0, vol.v0); b = Math.min(o.v1, vol.v1); }
      if (enc && b - a > eps) out.push([a, b]);
    }
    return out;
  }

  function faceDe(vol, lado) {
    // a -> b deixa o volume à esquerda olhando de cima com v para "cima": normal para fora.
    if (lado === "frente") return { a: [vol.u0, vol.v0], b: [vol.u1, vol.v0], normal: [0, -1], comprimento: vol.u1 - vol.u0 };
    if (lado === "direita") return { a: [vol.u1, vol.v0], b: [vol.u1, vol.v1], normal: [1, 0], comprimento: vol.v1 - vol.v0 };
    if (lado === "fundo") return { a: [vol.u1, vol.v1], b: [vol.u0, vol.v1], normal: [0, 1], comprimento: vol.u1 - vol.u0 };
    return { a: [vol.u0, vol.v1], b: [vol.u0, vol.v0], normal: [-1, 0], comprimento: vol.v1 - vol.v0 };
  }

  // Vãos iguais entre 3,0 e 4,5 m: posição dos pilares ao longo de um lado.
  function vaos(L, regras) {
    const [vmin, vmax] = regra(regras, "malha.vao_m");
    const n = Math.max(1, Math.ceil(L / vmax - 1e-9));
    return { n, vao: L / n, valido: L / n >= vmin - 1e-9 && L / n <= vmax + 1e-9 };
  }

  function detalha(casa, regras) {
    const S = SORTEIO();
    const sem = casa.semente;
    const R = c => regra(regras, c);
    const vols = casa.volumes;
    const corpo = vols[0];
    const ala = vols.find(v => v.papel !== "corpo" && v.papel !== "edicula") || null;
    const edicula = vols.find(v => v.papel === "edicula") || null;
    const T = casa.lote.testada;
    const pil = R("portoes.pilarete_m");
    const tel = casa.telhado;
    const resp1 = Math.round((casa.alturas.piso + casa.alturas.peDireito + casa.alturas.laje) * 100) / 100;

    // --- faces: cega (sem janela, sem beiral), trechos cobertos, beiral --------
    const faces = [];
    vols.forEach((vol, iv) => {
      if (vol.papel === "garagem_leve") return;            // estrutura leve: sem parede
      for (const lado of LADOS) {
        const f = faceDe(vol, lado);
        const cega = vol.cega[lado];
        const ceramico = vol.papel === "caixa_garagem" || vol.papel === "caixa_varanda" ? false : tel.ceramico;
        faces.push(Object.assign(f, { volume: iv, papel: vol.papel, lado, cega, janela: !cega,
          beiral: ceramico && !cega ? tel.beiral : 0, cobertos: cobertosDaFace(vol, lado, vols),
          pilares: vaos(f.comprimento, regras) }));
      }
    });

    // --- pavimento de cima: o corpo inteiro, deslocado para a frente pelo balanço
    const sup = casa.pavimentos === 2
      ? { u0: corpo.u0, v0: corpo.v0 - casa.alturas.balanco, u1: corpo.u1, v1: corpo.v1 - casa.alturas.balanco,
          balanco: casa.alturas.balanco, base: resp1 }
      : null;

    // --- telhados: um por volume, com o MESMO beiral e a MESMA inclinação ----------
    const fT = S.fluxo(sem, "telhado_detalhe");
    const folgaPlat = entreM(fT, R("telhado.platibanda_folga_m"), 0.05);
    const parapeitoLaje = entreM(fT, R("telhado.laje_platibanda_m"), 0.05);
    const platCaixa = entreM(fT, R("alturas.caixa_laje_platibanda_m"), 0.05);
    const alturaLeve = entreM(fT, R("alturas.garagem_leve_altura_m"), 0.05);
    const telhados = vols.map((vol, iv) => {
      const w = vol.u1 - vol.u0, d = vol.v1 - vol.v0;
      const base = vol.papel === "corpo" ? casa.alturas.respaldo : resp1;
      const i = tel.inclinacao;
      if (vol.papel === "garagem_leve")
        return { volume: iv, tipo: casa.garagem.telha ? "meia_agua" : "pergolado", material: casa.garagem.telha ? "ceramica" : "madeira",
                 queda: "frente", inclinacao: casa.garagem.telha ? i : 0, base: alturaLeve,
                 topo: Math.round((alturaLeve + (casa.garagem.telha ? i * d : 0)) * 100) / 100 };
      if (vol.papel === "caixa_garagem" || vol.papel === "caixa_varanda")
        return { volume: iv, tipo: "laje", material: "laje", base, platibanda: Math.round((base + platCaixa) * 100) / 100,
                 topo: Math.round((base + platCaixa) * 100) / 100 };
      let tipo = tel.tipo;
      if (vol.papel === "edicula" && vol.meiaAgua) tipo = "meia_agua";
      if (tipo === "laje")
        return { volume: iv, tipo, material: "laje", caimento: i, base, platibanda: Math.round((base + parapeitoLaje) * 100) / 100,
                 topo: Math.round((base + parapeitoLaje) * 100) / 100 };
      if (tipo === "platibanda") {
        // fibrocimento escondido em uma água vencendo o lado curto, caindo para o fundo
        const curto = Math.min(w, d), oculto = base + i * curto;
        return { volume: iv, tipo, material: "fibrocimento", inclinacao: i, cumeeira: w <= d ? "v" : "u", base,
                 topoOculto: Math.round(oculto * 100) / 100, platibanda: Math.round((oculto + folgaPlat) * 100) / 100,
                 topo: Math.round((oculto + folgaPlat) * 100) / 100 };
      }
      if (tipo === "meia_agua")
        return { volume: iv, tipo, material: "ceramica", inclinacao: i, queda: "frente", base,
                 alturaBeiral: Math.round((base - i * tel.beiral) * 100) / 100,
                 topo: Math.round((base + i * d) * 100) / 100 };
      // Quatro águas: cumeeira no lado comprido. Duas águas: paralela (u) ou
      // perpendicular (v) à rua no corpo; a ala sempre põe a cumeeira em v, que é
      // perpendicular à face do corpo onde ela encosta: a água da ala morre na do corpo.
      let cum;
      if (tipo === "quatro_aguas") cum = w >= d ? "u" : "v";
      else if (vol.papel === "ala_l" || vol.papel === "ala_t") cum = "v";
      else if (vol.papel === "edicula") cum = w >= d ? "u" : "v";
      else cum = tipo === "duas_aguas_paralela" ? "u" : "v";
      const vao = cum === "u" ? d : w;
      return { volume: iv, tipo, material: "ceramica", inclinacao: i, cumeeira: cum, base,
               alturaBeiral: Math.round((base - i * tel.beiral) * 100) / 100,
               topo: Math.round((base + i * vao / 2) * 100) / 100 };
    });

    // --- portões, porta, vaga, caminho, rampa --------------------------------------
    const fA = S.fluxo(sem, "aberturas_detalhe");
    let portaoGaragem = null, vaga = null, rampa = null;
    const gL = R("portoes.garagem_largura_m");
    if (casa.garagem.lado !== "nenhuma") {
      const esq = casa.garagem.lado === "esquerda";
      const gv = ala && (ala.papel === "garagem_leve" || ala.papel === "caixa_garagem") ? ala : null;
      if (gv) {
        const lw = Math.min(gL[1], Math.max(gL[0], Math.round((gv.u1 - gv.u0 - 2 * pil) * 100) / 100));
        const c = (gv.u0 + gv.u1) / 2;
        portaoGaragem = { u0: c - lw / 2, u1: c + lw / 2, largura: lw };
        rampa = { u0: portaoGaragem.u0, u1: portaoGaragem.u1, v0: 0, v1: gv.v0 };
      } else {
        const lw = R("portoes.garagem_vaga_m");
        portaoGaragem = esq ? { u0: -T / 2 + pil, u1: -T / 2 + pil + lw, largura: lw }
                            : { u0: T / 2 - pil - lw, u1: T / 2 - pil, largura: lw };
        vaga = { u0: portaoGaragem.u0, u1: portaoGaragem.u1, v0: 0, v1: corpo.v0 };
        rampa = Object.assign({}, vaga);
      }
    }
    const larguraPorta = R("aberturas.porta_largura_m");
    const porta = { u: corpo.u0 + casa.porta, v: corpo.v0, largura: larguraPorta };
    let portaoSocial = null, caminho = null;
    if (casa.muroFrente !== "nenhum") {
      const sw = R("portoes.social_largura_m");
      portaoSocial = { u0: porta.u - sw / 2, u1: porta.u + sw / 2, largura: sw };
      const cw = R("quintal.caminho_largura_m");
      caminho = { u0: porta.u - cw / 2, u1: porta.u + cw / 2, v0: 0, v1: corpo.v0 };
    }

    // --- muros: quadrilátero do lote, frente com os vãos dos portões -------------
    const fM = S.fluxo(sem, "muros_detalhe");
    const k = casa.lote.cantos;
    const hDivisa = entreM(fM, R("muros.divisa_altura_m"), 0.05);
    const frenteTipo = casa.muroFrente;
    const hFrente = frenteTipo === "muro_alto" ? entreM(fM, R("muros.muro_frente_m"), 0.05)
                  : frenteTipo === "nenhum" ? 0 : entreM(fM, R("muros.mureta_m"), 0.05);
    const hGradil = frenteTipo === "gradil" ? entreM(fM, R("muros.gradil_topo_m"), 0.05) : 0;
    const vaosFrente = [];
    if (portaoGaragem) vaosFrente.push({ u0: portaoGaragem.u0, u1: portaoGaragem.u1, tipo: "garagem" });
    if (portaoSocial) vaosFrente.push({ u0: portaoSocial.u0, u1: portaoSocial.u1, tipo: "social" });
    vaosFrente.sort((a, b) => a.u0 - b.u0);
    // Lateral de esquina é fachada de rua: leva o muro da frente, não o de divisa.
    const lateral = (rua) => rua ? { tipo: frenteTipo === "nenhum" ? "muro_baixo" : frenteTipo, altura: hFrente || hDivisa, gradil: hGradil }
                                 : { tipo: "divisa", altura: hDivisa, gradil: 0 };
    const muros = [
      Object.assign({ lado: "frente", a: k.frenteEsq, b: k.frenteDir, vaos: vaosFrente },
        { tipo: frenteTipo, altura: hFrente, gradil: hGradil }),
      Object.assign({ lado: "direita", a: k.frenteDir, b: k.fundoDir, vaos: [] }, lateral(casa.esquina.direita)),
      Object.assign({ lado: "fundo", a: k.fundoDir, b: k.fundoEsq, vaos: [] }, lateral(false)),
      Object.assign({ lado: "esquerda", a: k.fundoEsq, b: k.frenteEsq, vaos: [] }, lateral(casa.esquina.esquerda))
    ];
    const fCor = S.fluxo(sem, "muros_cor");
    const muroCor = fCor.pesos(R("cores.muro.pesos"));

    // --- quintal: calçada de serviço, piscina, plantio -----------------------------
    const traseira = Math.max(...vols.filter(v => v.papel !== "edicula").map(v => v.v1), sup ? sup.v1 : 0);
    const calcadaServico = { u0: corpo.u0, u1: corpo.u1, v0: corpo.v1, v1: corpo.v1 + R("quintal.calcada_servico_m") };
    let piscina = null;
    const fundoLote = Math.min(k.fundoEsq[1], k.fundoDir[1]);
    if (casa.piscina) {
      const fP = S.fluxo(sem, "piscina");
      const borda = R("piscina.borda_m"), margem = R("piscina.margem_m");
      const limite = edicula ? edicula.v0 : fundoLote - R("recuos.fundo_m");
      const livre = limite - Math.max(traseira, calcadaServico.v1);
      const comp = Math.min(entreM(fP, R("piscina.comprimento_m"), 0.1), Math.floor((livre - 2 * (margem + borda)) * 10) / 10);
      const larg = entreM(fP, R("piscina.largura_m"), 0.1);
      const vc = Math.max(traseira, calcadaServico.v1) + livre / 2;
      const uc = (corpo.u0 + corpo.u1) / 2;
      piscina = { u0: uc - larg / 2, u1: uc + larg / 2, v0: vc - comp / 2, v1: vc + comp / 2, borda };
    }
    const fQ = S.fluxo(sem, "plantio");
    const plantio = [];
    const mg = R("quintal.plantio_margem_m"), palm = R("quintal.palmeira_prob");
    const tipoPlanta = () => fQ.chance(palm) ? "palmeira" : "arvore";
    if (corpo.v0 >= R("quintal.plantio_frente_min_m")) {
      // jardim da frente: do lado oposto à garagem, longe do caminho
      const ladoU = casa.garagem.lado === "esquerda" ? 1 : -1;
      const u = ladoU > 0 ? T / 2 - mg : -T / 2 + mg;
      if (!caminho || Math.abs(u - porta.u) > mg + 0.6) plantio.push({ u, v: Math.min(corpo.v0 - mg, corpo.v0 / 2), tipo: tipoPlanta() });
    }
    const vFundo = (edicula ? edicula.v0 : fundoLote) - mg;
    if (vFundo - traseira > 2 * mg) {
      for (const s of [-1, 1]) {
        const u = s < 0 ? Math.max(k.fundoEsq[0], -T / 2) + mg : Math.min(k.fundoDir[0], T / 2) - mg;
        if (piscina && u > piscina.u0 - mg && u < piscina.u1 + mg) continue;
        plantio.push({ u, v: vFundo, tipo: tipoPlanta() });
      }
    }

    // --- caixa d'água ---------------------------------------------------------------
    const fC = S.fluxo(sem, "caixa_dagua");
    const litros = entreM(fC, R("telhado.caixa_dagua_litros"), 250);
    const torre = tel.ceramico && fC.chance(R("telhado.caixa_torre_prob"));
    const aparente = tel.tipo === "laje" || torre;
    const recuoCx = R("telhado.caixa_dagua_recuo_m");
    const caixaDagua = { litros, aparente, torre, u: (corpo.u0 + corpo.u1) / 2,
                         v: aparente && !torre ? Math.min(corpo.v1 - recuoCx, corpo.v0 + recuoCx + 1) : corpo.v1 - recuoCx };

    // --- cores ------------------------------------------------------------------------
    const pal = R("cores.paletas")[casa.paleta] || R("cores.paletas")[0];
    const fCo = S.fluxo(sem, "cores");
    const dsv = regras.cores.desvio_hsl;
    const conjunto = /^conjunto/.test(pal.nome);
    const mul = conjunto ? R("cores.variacao").conjunto : 1;
    const parede = desviaHSL(corDeHex(fCo.escolhe(pal.parede)), (fCo.real() - 0.5) * dsv.matiz * mul,
                             (fCo.real() - 0.5) * dsv.saturacao * mul, (fCo.real() - 0.5) * dsv.luminosidade * mul);
    const telha = corDeHex(fCo.escolhe(R("cores.telhas")));
    const esq = fCo.pesos(R("cores.esquadrias.pesos")), por = fCo.pesos(R("cores.portao.pesos"));
    const cores = {
      parede, telha,
      fibrocimento: corDeHex(fCo.escolhe(R("cores.fibrocimento"))),
      laje: corDeHex(fCo.escolhe(R("cores.laje"))),
      esquadria: corDeHex(regras.cores.esquadrias.cores[esq]), esquadriaTipo: esq,
      portao: corDeHex(regras.cores.portao.cores[por]), portaoTipo: por,
      muro: muroCor === "cor_da_casa" ? parede : corDeHex(regras.cores.muro.cores[muroCor]),
      grama: corDeHex(fCo.escolhe(R("cores.grama"))), piso: corDeHex(fCo.escolhe(R("cores.piso"))),
      piscina: corDeHex(fCo.escolhe(R("cores.piscina")))
    };

    return { faces, pavimentoSuperior: sup, telhados, portaoGaragem, vaga, rampa, porta, portaoSocial, caminho,
             calcadaServico, piscina, muros, plantio, caixaDagua, cores, respaldoTerrea: resp1 };
  }

  root.CasasFormato = Object.freeze({
    VERSAO, BYTES, CAMPOS, FAIXA, PARTIDOS, TELHADOS, MUROS_FRENTE, ALAS, LADOS,
    valorRegra, regra, codificaRegistro, decodificaRegistro, codifica, abre,
    codificaSubstituidos, decodificaSubstituidos, casaDeCampos, paraMundo, detalha, vaos
  });
})(globalThis);
