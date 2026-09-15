/* City search: index built once from decoded data, ranked query from the camera target. */
(function(root) {
  "use strict";
  function create({pois:POIS, cls:CLS, target}) {
const semAcento = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* ---------------- busca ---------------- */
const BUSCA = [];
function indexaBusca(B, R) {
  BUSCA.length = 0;
  for (const p of POIS)
    BUSCA.push({ k: "poi", n: p.n, s: p.cfg.curto, x: p.x, z: p.z, cor: p.cfg.col, poi: p });

  // Uma entrada por NOME de via, no meio do trecho mais comprido — o mesmo critério
  // do rótulo de rua, pra que "ir até a rua X" caia onde o nome aparece escrito.
  const porNome = new Map();
  for (const w of R) {
    if (!w.name || w.pts.length < 2) continue;
    let best = 0, bi = 0;
    for (let i = 0; i < w.pts.length - 1; i++) {
      const L = Math.hypot(w.pts[i+1][0] - w.pts[i][0], w.pts[i+1][1] - w.pts[i][1]);
      if (L > best) { best = L; bi = i; }
    }
    const ant = porNome.get(w.name);
    if (ant && ant.L >= best) continue;
    porNome.set(w.name, { L: best, x: (w.pts[bi][0] + w.pts[bi+1][0]) / 2,
                                  z: (w.pts[bi][1] + w.pts[bi+1][1]) / 2 });
  }
  for (const [n, v] of porNome) BUSCA.push({ k: "rua", n, s: "via", x: v.x, z: v.z });

  // Edificação com nome próprio: escola, hospital, shopping. São poucas (o `bm[]`
  // só existe pra quem tem nome ou endereço), então o centroide sai barato.
  // O que TAMBÉM tem nome próprio é o POI, e os dois vêm do mesmo OSM: sem esta
  // peneira, "catedral" devolvia a catedral duas vezes, uma como lugar e outra como
  // edificação. Quem fica é o POI, que tem endereço, horário e ficha.
  const jaTem = new Set(POIS.map(p => semAcento(p.n)));
  for (const b of B) {
    if (!b.name || BUSCA.length > 24000 || jaTem.has(semAcento(b.name))) continue;
    let mx = 0, mz = 0;
    for (const p of b.r) { mx += p[0]; mz += p[1]; }
    BUSCA.push({ k: "predio", n: b.name, s: CLS[b.c] === "biz" ? "comércio" : "edificação",
                 x: mx / b.r.length, z: mz / b.r.length });
  }
  for (const it of BUSCA) it.q = semAcento(it.n);
}

function buscaAgora(termo) {
  const q = semAcento(termo).trim();
  if (q.length < 2) return [];
  const alvo = target;
  const out = [];
  for (const it of BUSCA) {
    const i = it.q.indexOf(q);
    if (i < 0) continue;
    // Ordena por: começa com o termo > contém; depois pelo tipo (lugar antes de
    // via, que é o que se procura mais); e só então pela distância de onde a
    // câmera está. Sem a distância, "rua sao paulo" numa cidade com cinco delas
    // manda o usuário pra outra ponta do mapa.
    const d = Math.hypot(it.x - alvo.x, it.z - alvo.z);
    out.push({ it, r: (i === 0 ? 0 : 1000) + (it.k === "poi" ? 0 : it.k === "predio" ? 30 : 60) + d / 4000 });
    // O teto e alto de proposito: cortar cedo devolveria os primeiros 400 da ORDEM DO
    // INDICE, nao os melhores 400 -- 'ru' casa com quase toda via da cidade, e o
    // resultado mais perto ficaria de fora. Varrer os 11 mil itens custa menos de 2 ms.
    if (out.length > 3000) break;
  }
  out.sort((a, b) => a.r - b.r);
  return out.slice(0, 9).map(o => o.it);
}

    return {semAcento, BUSCA, indexaBusca, buscaAgora};
  }
  root.CitySearch = Object.freeze({create});
})(globalThis);
