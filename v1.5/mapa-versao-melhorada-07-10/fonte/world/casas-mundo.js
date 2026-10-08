/* Casas procedurais por regra no mapa (v2 do mapa melhorado).

   O gerador (gerador/casas.mjs) decide CADA casa de cada lote com as regras de
   arquitetura e engenharia (regras/sao-carlos.json) e grava um plano de 40 bytes por
   casa, agrupado por quarteirao (casas/formato.js). Aqui esse plano vira triangulo, so
   para os quarteiroes vivos do streaming, e no nivel de detalhe que a distancia pede:

     LOD0  perto da camera: janela com recuo de verdade, beiral com testeira, muro com
           capa, portoes, quintal;
     LOD1  meia distancia: volume + telhado correto + beiral, janela pintada no shader
           so onde a regra deixa (aSemJanela);
     LOD2  longe: caixa + telhado.

   Cada quarteirao vivo tem UMA malha de casas (mais uma do chao dos lotes no LOD0/1),
   no material compartilhado da fachada. Quando a camera chega perto ou se afasta, a
   malha do quarteirao e refeita no nivel novo, com orcamento de tempo por quadro e
   histerese para nao ficar trocando na fronteira.

   As casas que o gerador planejou SUBSTITUEM os volumes residenciais antigos daquele
   lote (`substituidos`): o renderizador de predios (world/buildings.js) pula esses. */
(function (root) {
  "use strict";

  function create({THREE, formato, geometria, buffer, subs, materialCasa, materialLote,
                   terrainY, registerTerrain, unregisterTerrain, medeFolga, inflaEsfera, sombra, niveis, agora}) {
    const arq = formato.abre(buffer);
    const regras = arq.regras;
    const nQ = arq.nQuarteiroes;
    // Faixas de distancia (m) por nivel de grafico: [LOD0 ate, LOD1 ate]. Alem disso, LOD2.
    const LIM = niveis || [180, 650];
    const HIST = 0.15;          // 15% de histerese na fronteira de cada nivel
    const ORCAMENTO_MS = 3;     // por quadro, refazendo malha de quarteirao
    const vivos = new Map();    // quarteirao -> { nivel, objs:[malhas], cx, cz, rad, add }
    const fila = [];            // quarteiroes a refazer

    // `substituidos`: indices de b[] (city.json) que viraram casa nova.
    const subst = subs ? formato.decodificaSubstituidos(subs) : new Uint32Array(0);
    function marcaSubstituidos(B) {
      let n = 0;
      for (let k = 0; k < subst.length; k++) { const b = B[subst[k]]; if (b) { b._casaNova = true; n++; } }
      return n;
    }

    function raioDo(q) {
      // O indice do arquivo traz so o centro; o raio vem do proprio grupo do streaming.
      const v = vivos.get(q);
      return v ? v.rad : 0;
    }
    function nivelPara(d, atual) {
      // Histerese: para TROCAR de nivel a distancia tem que passar a fronteira com folga.
      const a = LIM[0] * (atual === 0 ? 1 + HIST : atual > 0 ? 1 - HIST : 1);
      const b = LIM[1] * (atual === 1 || atual === 0 ? 1 + HIST : atual === 2 ? 1 - HIST : 1);
      return d < a ? 0 : d < b ? 1 : 2;
    }

    /* ---- plano -> geometria do three ------------------------------------------ */
    function malhas(q, nivel) {
      const n = arq.quarteiroes.quantidade[q];
      if (!n) return [];
      const ini = arq.quarteiroes.inicio[q];
      const casa = geometria.criaSaida(), lote = geometria.criaSaida ? geometria.criaSaida() : null;
      const sombras = [];
      for (let i = ini; i < ini + n; i++) {
        const c = arq.casa(i);
        geometria.expande(c, nivel, casa, lote, regras);
        // Retangulo do corpo para a sombra de contato (mesmo formato de buildBuildings:
        // centro, eixo u, meias-larguras, relevo da base, altura).
        const v = c.volumes[0];
        const cu = (v.u0 + v.u1) / 2, cv = (v.v0 + v.v1) / 2;
        const cx = c.origem[0] + cu * c.eixoU[0] + cv * c.eixoV[0];
        const cz = c.origem[1] + cu * c.eixoU[1] + cv * c.eixoV[1];
        sombras.push(cx, cz, c.eixoU[0], c.eixoU[1], (v.u1 - v.u0) / 2, (v.v1 - v.v0) / 2,
                     terrainY(c.origem[0], c.origem[1]), c.alturas.respaldo);
      }
      const out = [];
      const gC = paraGeometria(casa, true);
      if (gC) {
        const m = new THREE.Mesh(gC, materialCasa);
        m.userData.compartilhado = true; m.userData.casas = true;
        m.castShadow = sombra.projeta && nivel < 2; m.receiveShadow = sombra.recebe;
        m.frustumCulled = true;
        out.push(m);
      }
      const gL = lote && paraGeometria(lote, false);
      if (gL) {
        const m = new THREE.Mesh(gL, materialLote);
        m.userData.compartilhado = true; m.userData.casas = true; m.userData.ground = true;
        m.receiveShadow = sombra.recebe; m.frustumCulled = true;
        m.renderOrder = -1;
        out.push(m);
      }
      out.sombras = new Float32Array(sombras);
      return out;
    }

    // Os buffers de saida da geometria crescem com a casa; aqui viram atributos do three
    // no contrato da fachada (aFace, aStyle, aDY via registerTerrain, aSemJanela).
    function paraGeometria(s, casa) {
      const v = s.nVertices !== undefined ? s.nVertices : s.n;
      if (!v) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(s.pos.slice(0, v * 3), 3));
      if (s.nor) g.setAttribute("normal", new THREE.BufferAttribute(s.nor.slice(0, v * 3), 3, s.nor instanceof Int8Array));
      if (s.cor) g.setAttribute("color", new THREE.BufferAttribute(s.cor.slice(0, v * 3), 3, true));
      if (casa) {
        g.setAttribute("aFace", new THREE.BufferAttribute(s.face.slice(0, v * 2), 2));
        g.setAttribute("aStyle", new THREE.BufferAttribute(s.estilo.slice(0, v * 3), 3));
        if (s.semJanela) g.setAttribute("aSemJanela", new THREE.BufferAttribute(s.semJanela.slice(0, v), 1));
        g.setAttribute("aDist", new THREE.BufferAttribute(new Float32Array(v), 1));
        // Relevo: um valor por CASA (a fundacao absorve a inclinacao), medido no centro
        // dela -- o mesmo esquema de buildBuildings (presetDY / presetCenter).
        const base = s.base.slice(0, v * 2), dy = new Float32Array(v);
        for (let i = 0; i < v; i++) dy[i] = terrainY(base[i * 2], base[i * 2 + 1]);
        g.userData.dynamicHeight = true;
        g.userData.presetDY = dy;
        g.userData.presetCenter = base;
      } else g.userData.ground = true;
      const ni = s.nIndices !== undefined ? s.nIndices : (s.idx ? s.idx.length : 0);
      if (ni && s.idx) {
        const idx = v > 65535 ? s.idx.slice(0, ni) : Uint16Array.from(s.idx.subarray(0, ni));
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      g.computeBoundingSphere();
      registerTerrain(g);
      if (casa) { medeFolga(g); inflaEsfera(g); }
      return g;
    }

    /* ---- streaming ------------------------------------------------------------- */
    // Chamado por assembleInto quando um quarteirao entra: monta no nivel da distancia
    // atual e devolve as malhas (o chamador as pendura no grupo e no `rec.objs`).
    function monta(q, rec, add, parent, distancia, cx, cz, rad) {
      if (q < 0 || q >= nQ || !arq.quarteiroes.quantidade[q]) return null;
      const nivel = nivelPara(distancia, -1);
      const ms = malhas(q, nivel);
      const v = { nivel, objs: [], cx, cz, rad, add, parent, rec };
      for (const m of ms) { add(m, parent); v.objs.push(m); }
      vivos.set(q, v);
      return ms.sombras || null;
    }
    function solta(q) { vivos.delete(q); }

    function descarta(m, rec) {
      if (m.parent) m.parent.remove(m);
      const k = rec.objs.indexOf(m); if (k >= 0) rec.objs.splice(k, 1);
      if (m.geometry) { unregisterTerrain(m.geometry); m.geometry.dispose(); }
    }

    // Por quadro: reavalia o nivel de cada quarteirao vivo pela distancia da camera e
    // refaz, dentro do orcamento, os que mudaram. Devolve se algo mudou (para a sombra).
    let _ultimaVolta = 0;
    function atualiza(cam) {
      const t = agora();
      // A fila de mudanca so e recalculada a cada ~120 ms: a camera nao atravessa uma
      // faixa de nivel em menos que isso.
      if (t - _ultimaVolta > 120 && !fila.length) {
        _ultimaVolta = t;
        for (const [q, v] of vivos) {
          const d = Math.max(0, Math.hypot(v.cx - cam.x, v.cz - cam.z, cam.y) - v.rad);
          const n = nivelPara(d, v.nivel);
          if (n !== v.nivel) fila.push([d, q, n]);
        }
        fila.sort((a, b) => a[0] - b[0]);
      }
      let mudou = false;
      while (fila.length && agora() - t < ORCAMENTO_MS) {
        const [, q, n] = fila.shift();
        const v = vivos.get(q);
        if (!v || v.nivel === n) continue;
        const novas = malhas(q, n);
        for (const m of v.objs) descarta(m, v.rec);
        v.objs = [];
        for (const m of novas) { v.add(m, v.parent); v.objs.push(m); }
        v.nivel = n;
        mudou = true;
      }
      return mudou;
    }

    function estatisticas() {
      const porNivel = [0, 0, 0];
      for (const v of vivos.values()) porNivel[v.nivel]++;
      return { casas: arq.nCasas, quarteiroes: nQ, vivos: vivos.size, porNivel, fila: fila.length,
               substituidos: subst.length };
    }

    return Object.freeze({ marcaSubstituidos, monta, solta, atualiza, estatisticas, nQuarteiroes: nQ,
                           nivelPara, arquivo: arq });
  }

  root.CasasMundo = Object.freeze({ create });
})(globalThis);
