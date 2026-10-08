/* Casas procedurais por regra no mapa (v2 do mapa melhorado).

   O gerador (gerador/casas.mjs) decide CADA casa de cada lote com as regras de
   arquitetura e engenharia (regras/sao-carlos.json) e grava um plano de 40 bytes por
   casa, agrupado por quarteirao (casas/formato.js). Aqui esse plano vira triangulo
   (fonte/casas/geometria.js), so para os quarteiroes vivos do streaming, e no nivel de
   detalhe que a distancia da camera pede:

     LOD0  perto: janela com recuo de verdade, beiral com testeira, muro com capa,
           portoes, quintal (~1.600 triangulos e ~1,9 ms por casa);
     LOD1  meia distancia: volume + telhado correto + beiral, janela pintada no shader
           so onde a regra deixa (~150 triangulos, 0,14 ms);
     LOD2  longe: caixa + telhado (~20 triangulos, 0,03 ms).

   Cada quarteirao vivo tem uma malha de casas e uma do chao dos lotes, nos materiais
   compartilhados. Quarteirao que entra nasce em LOD2 na hora (1 ms) e SOBE de nivel por
   uma fila com orcamento de tempo por quadro: o LOD0 de um quarteirao inteiro custaria
   ~60 ms de uma vez, e e montado casa a casa, ao longo de varios quadros, ate a malha
   ficar pronta e trocar a anterior. A troca de nivel tem histerese para nao oscilar na
   fronteira.

   As casas que o gerador planejou SUBSTITUEM os volumes residenciais antigos daquele
   lote (`substituidos`): o renderizador de predios (world/buildings.js) pula esses. */
(function (root) {
  "use strict";

  function create({THREE, formato, geometria, buffer, subs, materialCasa, materialLote,
                   terrainY, registerTerrain, unregisterTerrain, medeFolga, inflaEsfera,
                   sombra, niveis, agora, exagero, orcamentoMs}) {
    const arq = formato.abre(buffer);
    const regras = arq.regras;
    const nQ = arq.nQuarteiroes;
    const LIM = niveis || [180, 650];   // [LOD0 ate, LOD1 ate] em metros; alem, LOD2
    const HIST = 0.15;
    const ORC = orcamentoMs || 4;
    const vivos = new Map();   // q -> { nivel, alvo, objs, cx, cz, rad, add, parent, rec }
    let job = null;            // { q, nivel, i, fim, casa, chao, som }
    let fila = [];             // [distancia, q, nivel]
    const ex = () => (typeof exagero === "function" ? exagero() : (exagero || 0));

    const subst = subs ? formato.decodificaSubstituidos(subs) : new Uint32Array(0);
    function marcaSubstituidos(B) {
      let n = 0;
      for (let k = 0; k < subst.length; k++) { const b = B[subst[k]]; if (b) { b._casaNova = true; n++; } }
      return n;
    }

    // Histerese: para trocar de nivel a distancia tem que passar a fronteira com folga.
    function nivelPara(d, atual) {
      const a = LIM[0] * (atual === 0 ? 1 + HIST : 1 - HIST);
      const b = LIM[1] * (atual === 2 ? 1 - HIST : 1 + HIST);
      return d < a ? 0 : d < b ? 1 : 2;
    }
    const distancia = (v, cam) => Math.max(0, Math.hypot(v.cx - cam.x, v.cz - cam.z, cam.y) - v.rad);

    /* ---- saida da geometria -> BufferGeometry do three -------------------------- */
    function paraGeometria(s, casa) {
      const v = s.nVertices;
      if (!v) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(s.pos.slice(0, v * 3), 3));
      g.setAttribute("normal", new THREE.BufferAttribute(s.nor.slice(0, v * 3), 3, true));
      g.setAttribute("color", new THREE.BufferAttribute(s.cor.slice(0, v * 3), 3, true));
      if (casa) {
        g.setAttribute("aFace", new THREE.BufferAttribute(s.face.slice(0, v * 2), 2));
        g.setAttribute("aStyle", new THREE.BufferAttribute(s.estilo.slice(0, v * 3), 3));
        g.setAttribute("aSemJanela", new THREE.BufferAttribute(s.semJanela.slice(0, v), 1));
        // Sem aDist: a casa nao "sobe" ao entrar (o atributo ausente le 0 e o uT = 1 do
        // material compartilhado deixa a casa inteira); sao 4 B por vertice a menos.
        // Relevo: um valor por CASA, no meio da testada (`base`), como o gerador planejou.
        const base = s.base.slice(0, v * 2), dy = new Float32Array(v);
        let bx = NaN, bz = NaN, by = 0;
        for (let i = 0; i < v; i++) {
          const x = base[i * 2], z = base[i * 2 + 1];
          if (x !== bx || z !== bz) { bx = x; bz = z; by = terrainY(x, z); }
          dy[i] = by;
        }
        g.userData.dynamicHeight = true;
        g.userData.presetDY = dy;
        g.userData.presetCenter = base;
      } else g.userData.ground = true;
      const ni = s.nIndices;
      if (ni) g.setIndex(new THREE.BufferAttribute(v > 65535 ? s.idx.slice(0, ni) : Uint16Array.from(s.idx.subarray(0, ni)), 1));
      g.computeBoundingSphere();
      registerTerrain(g);
      if (casa) { medeFolga(g); inflaEsfera(g); }
      return g;
    }

    function malhasDe(casa, chao, nivel) {
      const out = [];
      const gC = paraGeometria(casa, true);
      if (gC) {
        const m = new THREE.Mesh(gC, materialCasa);
        m.userData.compartilhado = true; m.userData.casas = true; m.userData.nivel = nivel;
        m.castShadow = sombra.projeta && nivel < 2; m.receiveShadow = sombra.recebe;
        out.push(m);
      }
      const gL = paraGeometria(chao, false);
      if (gL) {
        const m = new THREE.Mesh(gL, materialLote);
        m.userData.compartilhado = true; m.userData.casas = true; m.userData.ground = true;
        m.receiveShadow = sombra.recebe; m.renderOrder = -1;
        out.push(m);
      }
      return out;
    }

    // Monta um quarteirao inteiro de uma vez (so para LOD2, que e barato).
    function montaJa(q, nivel) {
      const casa = geometria.criaSaida(), chao = geometria.criaSaida();
      const ini = arq.quarteiroes.inicio[q], n = arq.quarteiroes.quantidade[q];
      const op = { exagero: ex() };
      for (let i = ini; i < ini + n; i++) geometria.expande(arq.casa(i), nivel, casa, chao, regras, op);
      return malhasDe(casa, chao, nivel);
    }

    function poe(v, malhas) {
      for (const m of v.objs) {
        if (m.parent) m.parent.remove(m);
        const k = v.rec.objs.indexOf(m); if (k >= 0) v.rec.objs.splice(k, 1);
        if (m.geometry) { unregisterTerrain(m.geometry); m.geometry.dispose(); }
      }
      v.objs = [];
      for (const m of malhas) { v.add(m, v.parent); v.objs.push(m); }
    }

    // Retangulo do corpo de cada casa para a sombra de contato (o formato de
    // buildBuildings: centro, eixo u, meias-larguras, relevo da base, altura).
    function sombrasDe(q) {
      const ini = arq.quarteiroes.inicio[q], n = arq.quarteiroes.quantidade[q];
      const out = new Float32Array(n * 8);
      for (let k = 0; k < n; k++) {
        const c = arq.casa(ini + k), v = c.volumes[0];
        const cu = (v.u0 + v.u1) / 2, cv = (v.v0 + v.v1) / 2;
        out.set([c.origem[0] + cu * c.eixoU[0] + cv * c.eixoV[0], c.origem[1] + cu * c.eixoU[1] + cv * c.eixoV[1],
                 c.eixoU[0], c.eixoU[1], (v.u1 - v.u0) / 2, (v.v1 - v.v0) / 2,
                 terrainY(c.origem[0], c.origem[1]), c.alturas.respaldo], k * 8);
      }
      return out;
    }

    /* ---- streaming ---------------------------------------------------------------- */
    // Quarteirao que entra: LOD2 na hora; o nivel que a distancia pede vem pela fila.
    function monta(q, rec, add, parent, d, cx, cz, rad) {
      if (q < 0 || q >= nQ || !arq.quarteiroes.quantidade[q]) return null;
      const v = { nivel: 2, alvo: nivelPara(d, -1), objs: [], cx, cz, rad, add, parent, rec };
      vivos.set(q, v);
      poe(v, montaJa(q, 2));
      if (v.alvo !== 2) fila.push([d, q, v.alvo]);
      return sombrasDe(q);
    }
    function solta(q) { vivos.delete(q); if (job && job.q === q) job = null; }

    let _ultimaVolta = 0;
    // Por quadro: reavalia o nivel de cada quarteirao pela distancia da camera e
    // avanca a montagem dentro do orcamento. Devolve true se trocou alguma malha.
    function atualiza(cam) {
      const t = agora();
      if (t - _ultimaVolta > 150) {
        _ultimaVolta = t;
        fila = [];
        for (const [q, v] of vivos) {
          const d = distancia(v, cam);
          v.alvo = nivelPara(d, v.nivel);
          if (v.alvo !== v.nivel && !(job && job.q === q && job.nivel === v.alvo)) fila.push([d, q, v.alvo]);
        }
        // Perto primeiro; descer de nivel (longe) e barato e vem junto.
        fila.sort((a, b) => a[0] - b[0]);
        // Trabalho em curso que deixou de valer (a camera foi embora) e abandonado.
        if (job) { const v = vivos.get(job.q); if (!v || v.alvo !== job.nivel) job = null; }
      }
      let trocou = false;
      while (agora() - t < ORC) {
        if (!job) {
          const p = fila.shift();
          if (!p) break;
          const [, q, nivel] = p, v = vivos.get(q);
          if (!v || v.nivel === nivel) continue;
          if (nivel === 2) { poe(v, montaJa(q, 2)); v.nivel = 2; trocou = true; continue; }
          job = { q, nivel, i: arq.quarteiroes.inicio[q], fim: arq.quarteiroes.inicio[q] + arq.quarteiroes.quantidade[q],
                  casa: geometria.criaSaida(16384), chao: geometria.criaSaida(2048), op: { exagero: ex() } };
        }
        // Casa a casa, ate o orcamento acabar; o quarteirao so troca quando terminar.
        while (job.i < job.fim && agora() - t < ORC)
          geometria.expande(arq.casa(job.i++), job.nivel, job.casa, job.chao, regras, job.op);
        if (job.i >= job.fim) {
          const v = vivos.get(job.q);
          if (v) { poe(v, malhasDe(job.casa, job.chao, job.nivel)); v.nivel = job.nivel; trocou = true; }
          job = null;
        }
      }
      return trocou;
    }

    // O relevo mudou de exagero (botao Relevo): as casas precisam saber, porque parede e
    // muro descem ate o chao do declive. Remonta tudo pela fila.
    function remonta() {
      job = null;
      for (const [q, v] of vivos) { poe(v, montaJa(q, 2)); v.nivel = 2; }
      _ultimaVolta = 0;
    }

    function estatisticas() {
      const porNivel = [0, 0, 0];
      for (const v of vivos.values()) porNivel[v.nivel]++;
      return { casas: arq.nCasas, quarteiroes: nQ, vivos: vivos.size, porNivel, fila: fila.length + (job ? 1 : 0),
               substituidos: subst.length };
    }
    const pendente = () => fila.length > 0 || !!job;

    return Object.freeze({ marcaSubstituidos, monta, solta, atualiza, remonta, estatisticas, pendente,
                           nQuarteiroes: nQ, nivelPara, arquivo: arq });
  }

  root.CasasMundo = Object.freeze({ create });
})(globalThis);
