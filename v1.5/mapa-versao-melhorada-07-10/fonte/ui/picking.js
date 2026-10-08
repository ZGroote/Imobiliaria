/* Do clique ao alvo: registro de edificacao na cidade, luz e movel dentro da casa. */
(function(root) {
  "use strict";
  function create({THREE, camera, gBuild, getUrban, guarda, chaveAncora, idDoRegistro,
                   unidadeDoPredio, abreUnidade, cancelaEscolha, getEscolhendo, INT, MOB,
                   CORTE, MOVEIS, dentroDaPlanta, paraUV, alternaLuz, luzDoHit, seleciona,
                   confirmaMover, pintaCatalogo, poeNaCena, salvaMoveis,
                   getPoeTipo, setPoeTipo}) {
/* ---- de um clique até um registro de edificação -------------------------
   A malha da quadra é mesclada: não há um objeto por prédio pro raycast
   devolver. Mas cada vértice já carrega o CENTROIDE do prédio dele em
   `presetCenter` (o shader usa isso pro relevo), e o centroide quantizado é a
   mesma chave que a fachada usa de semente. Face -> centroide -> registro.

   Com o Relevo ligado o raycast erra o alvo por alguns metros: a malha é
   deslocada no SHADER (aDY*uRelief) e o raycast lê a posição do buffer, que não
   sabe disso. Erra de prédio vizinho, não de lugar — e o dado que sai daqui
   (o centroide) continua exato. */
const rcaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
function registroDoHit(hit) {
  if (hit.object.userData.urbanPool) return getUrban() ? getUrban().hit(hit) : null;
  const o = hit.object, pc = o.geometry.userData.presetCenter, recs = o.userData.recs;
  if (!pc || !recs || !hit.face) return null;
  let idx = o.userData.indice;
  if (!idx) {
    idx = new Map();
    for (const b of recs) {
      let mx = 0, mz = 0;
      for (const p of b.r) { mx += p[0]; mz += p[1]; }
      idx.set(Math.round(mx/b.r.length*10) + "," + Math.round(mz/b.r.length*10), b);
    }
    o.userData.indice = idx;
  }
  const a = hit.face.a;
  return idx.get(Math.round(pc[a*2]*10) + "," + Math.round(pc[a*2+1]*10)) || null;
}
function cliqueNaCidade(e) {
  _ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  const hits = rcaster.intersectObjects(gBuild.children, false);
  for (const h of hits) {
    const rec = registroDoHit(h);
    if (!rec) continue;
    if (getEscolhendo()) {                       // apontando o predio de uma unidade
      const u = getEscolhendo();
      try { guarda.grava(chaveAncora(u.id), idDoRegistro(rec)); } catch (e2) {}
      cancelaEscolha();
      abreUnidade(u);
      return;
    }
    abreFicha(rec);
    return;
  }
}
function abreFicha(rec) {
  // Sem cadastro nao ha ficha (ver a nota onde a ficha generica foi removida). Com
  // cadastro, o clique no volume leva pro MESMO lugar que o clique na vitrine leva --
  // a ficha do imovel, com preco, comodos e a porta pra visita 3D -- em vez de um
  // cartao paralelo, mais pobre, que dizia outras coisas sobre o mesmo predio.
  const uni = unidadeDoPredio(rec);
  if (uni) abreUnidade(uni);
}

/* ---- clique dentro da casa: põe, escolhe ou move ----------------------- */
function cliqueInterior(e) {
  _ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  // A casa entra no teste JUNTO com os móveis. Sem ela o raio atravessa parede e
  // seleciona a cama do quarto vizinho -- visto na vista de planta, onde a metade
  // de trás da casa fica exatamente atrás de uma parede.
  const objs = [];
  for (const m of INT.moveis) if (m.obj) for (const f of m.obj.children) objs.push(f);
  if (INT.casa) for (const o of INT.casa.children) objs.push(o);
  // Interruptor e plafom entram na MESMA lista, e nao num teste proprio antes: e o
  // que faz um interruptor do comodo vizinho, atras da parede, nao ser clicavel.
  if (INT.plafons) objs.push(INT.plafons);
  if (INT.chaves) objs.push(INT.chaves);
  // O raio tem que enxergar o que a TELA enxerga: o que está acima do plano de
  // corte foi descartado no fragmento e não pode ser clicado. Sem este filtro a
  // vista de planta ficaria intransitável -- a parede some aos 1,55 m mas o raio
  // continuaria batendo nela até 2,70 m, e todo clique viraria "nada aqui".
  let h0 = null;
  for (const h of rcaster.intersectObjects(objs, false))
    if (h.point.y <= CORTE.constant) { h0 = h; break; }
  if (h0 && h0.object.userData.luz) { alternaLuz(luzDoHit(h0)); return; }
  // v16-moveis: fora do modo, clicar dentro da casa so acende luz. A visita e uma
  // visita -- selecionar movel sem querer era o que fazia o contorno verde piscar
  // na cara de quem so queria olhar.
  if (!MOB.on) return;
  // Em "mover", o clique CONFIRMA o destino. Ele nao pode cair no ramo de selecao
  // logo abaixo: soltar o movel em cima de outro selecionaria o outro.
  if (MOB.modo === "mover" && INT.sel >= 0) {
    if (MOB.cabe) confirmaMover();
    return;
  }
  if (h0 && !h0.object.userData.casa) {
    if (!getPoeTipo()) { seleciona(INT.moveis.indexOf(h0.object.userData.movel)); return; }
  } else if (h0 && h0.point.y > INT.baseY + 0.25) {
    seleciona(-1); return;                      // clicou numa parede, não no chão
  }
  const dir = rcaster.ray.direction, org = rcaster.ray.origin;
  if (Math.abs(dir.y) < 1e-4) return;
  const t = (INT.baseY + 0.03 - org.y) / dir.y;
  if (t <= 0) return;
  const x = org.x + dir.x*t, z = org.z + dir.z*t;
  if (!dentroDaPlanta(INT.pl, x, z)) { if (!getPoeTipo()) seleciona(-1); return; }
  const uv = paraUV(x, z);
  if (getPoeTipo()) {
    const def = MOVEIS[getPoeTipo()];
    const m = { tipo:getPoeTipo(), u:uv[0], v:uv[1], rot:0,
                w:def.b[0], d:def.b[2], h:def.b[1], cor:def.cor };
    INT.moveis.push(m); poeNaCena(m);
    setPoeTipo(null); pintaCatalogo();
    seleciona(INT.moveis.length - 1); salvaMoveis();
  } else {
    // Antes do v16 o clique no chao teletransportava o movel escolhido. Com o botao
    // "Mover" isso virou armadilha: o gesto de largar a selecao (clicar no vazio)
    // era o mesmo de mudar o movel de comodo, sem aviso e sem desfazer.
    seleciona(-1);
  }
}

    return {registroDoHit, cliqueNaCidade, abreFicha, cliqueInterior};
  }
  root.Picking = Object.freeze({create});
})(globalThis);
