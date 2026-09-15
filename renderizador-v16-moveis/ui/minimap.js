/* Street minimap: per-cell road index and a cached world-space Path2D per window. */
(function(root) {
  "use strict";
  function create({canvas, target, sph, camera, cat:CAT, catKeys:CAT_KEYS, poiPorCat:POI_POR_CAT,
                   catOn, isPoiHidden, bigRoad:BIGROAD, hw:HW}) {
const MM = { cv: canvas, ctx: null, vias: null, grade: null, pronto: false, on: true,
             t: 0, ax: 1e9, az: 1e9, ath: 1e9, ar: 0 };
const MM_CEL = 600;      // lado da celula do indice espacial, em metros

/* A primeira versao rasterizava a cidade inteira num canvas de 1.400 px e cada quadro
   recortava um pedaco dele. Sai barato e sai ILEGIVEL: a largura da linha fica presa a
   escala em que o bitmap foi desenhado, entao ou a via some quando se afasta, ou vira
   uma mancha cinza quando se aproxima (foi o que aconteceu -- 170 px de cinza chapado).

   Aqui o desenho e ao vivo, com a largura em PIXELS (que e o que importa num quadrado
   de 170 px), e o que segura o custo e um indice por celula de 600 m: em vez das ~11
   mil vias da cidade, cada quadro toca so as que caem na janela -- algumas centenas.
   E so redesenha quando a camera anda, gira ou aproxima (ver v12Frame). */
function montaBaseMinimapa(R) {
  MM.vias = R;
  MM.grade = new Map();
  MM.pronto = false;
  const chave = (cx, cz) => cx + "," + cz;
  for (let i = 0; i < R.length; i++) {
    const pts = R[i].pts;
    if (!pts || pts.length < 2) continue;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1];
    }
    // Uma via comprida entra em varias celulas. Marcar so a do meio deixaria a avenida
    // sumir do minimapa a 2 km do proprio centro dela.
    for (let cx = Math.floor(minX / MM_CEL); cx <= Math.floor(maxX / MM_CEL); cx++)
      for (let cz = Math.floor(minZ / MM_CEL); cz <= Math.floor(maxZ / MM_CEL); cz++) {
        const k = chave(cx, cz);
        let l = MM.grade.get(k); if (!l) MM.grade.set(k, l = []);
        l.push(i);
      }
  }
  MM.pronto = MM.grade.size > 0;
  MM.ctx = MM.cv.getContext("2d");
  MM.ax = 1e9;                      // forca o primeiro desenho
  MM.chaveVias = null;              // ...e o primeiro Path2D (ver desenhaMinimapa)
}

function desenhaMinimapa() {
  if (!MM.pronto || !MM.on) return;
  const g = MM.ctx, S = MM.cv.width, R2 = S / 2;
  // Quanto do mundo cabe no quadrado: acompanha o raio da orbita, senao o minimapa ou
  // fica inutil de perto ou vira borrao de longe.
  const alcance = Math.max(360, Math.min(6000, sph.radius * 4.0));
  const esc = S / alcance;                       // pixels por metro
  const meio = alcance * 0.72;                   // meia janela + folga pra rotacao

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = "#0E141C"; g.fillRect(0, 0, S, S);
  g.translate(R2, R2);
  g.rotate(sph.theta);            // mesma convencao da bussola: a camera olha pra cima
  g.scale(esc, esc);
  g.translate(-target.x, -target.z);

  /* A GEOMETRIA das vias nao muda -- o que muda a cada quadro e a TRANSFORMACAO. Por
     isso os dois caminhos sao Path2D em coordenada de MUNDO, guardados, e o desenho e
     so `stroke(path)` sob a matriz da vez.

     A chave do cache e a JANELA DE CELULAS de 600 m, que e o que decide QUAIS vias
     entram: arrastar o mapa dentro da mesma janela passa a custar dois `stroke`, em vez
     de remontar algumas centenas de vias ponto a ponto. Medido em Ribeirao (22 mil vias
     no indice), no rasterizador de software do headless: 0,57 ms -> 0,06 ms por
     desenho. Quem invalida e cruzar celula ou mudar o alcance -- as duas coisas mudam a
     janela, entao a mesma chave cobre as duas. */
  const cx0 = Math.floor((target.x - meio) / MM_CEL), cx1 = Math.floor((target.x + meio) / MM_CEL);
  const cz0 = Math.floor((target.z - meio) / MM_CEL), cz1 = Math.floor((target.z + meio) / MM_CEL);
  // A ESCALA entra na chave por causa do ponto de POI: o raio dele sai de `esc`, entao
  // ele so pode ser reaproveitado enquanto o zoom nao muda. A via nao se importa (a
  // largura dela e propriedade do contexto, nao do caminho), mas uma chave so pros dois
  // e mais simples que duas -- e arrastar o mapa, que e o caso comum, nao mexe no zoom.
  const chaveVias = cx0 + ":" + cx1 + ":" + cz0 + ":" + cz1 + ":" + esc.toFixed(5);
  if (MM.chaveVias !== chaveVias) {
    MM.chaveVias = chaveVias;
    const vistas = new Set();
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const l = MM.grade.get(cx + "," + cz); if (!l) continue;
        for (const i of l) vistas.add(i);
      }
    // Dois caminhos: a malha fina e a via larga. Sao desenhados em ordem (fina
    // primeiro, larga por cima), que e o que da leitura de "onde estao as avenidas"
    // num quadrado de 170 px.
    MM.paths = [new Path2D(), new Path2D()];
    for (const i of vistas) {
      const w = MM.vias[i], pts = w.pts;
      const p = MM.paths[BIGROAD.test(HW[w.k] || "") ? 1 : 0];
      p.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) p.lineTo(pts[j][0], pts[j][1]);
    }
    /* Um caminho por CATEGORIA, montado aqui e nao a cada desenho. Antes eram ate 2.393
       `arc()` por quadro so pra remontar os mesmos circulos; agora e um `fill()` por
       categoria acesa sobre caminho pronto. TODAS entram, inclusive as apagadas: ligar
       e desligar categoria passa a ser escolher QUAIS preencher, nao remontar nada.

       O recorte e a JANELA DE CELULAS, nao `target +/- meio`: dentro de uma mesma
       chave o alvo continua andando, e um recorte que anda junto deixaria de fora o
       ponto que acabou de entrar no quadro. A janela de celulas ja cobre o visivel com
       folga, e o que sobra e clipado pelo canvas.
       O `moveTo` antes de cada `arc` nao e enfeite: sem ele o arco novo se liga ao
       anterior por uma reta e o minimapa vira uma teia. */
    const rp = 1.9 / esc;
    const wx0 = cx0*MM_CEL, wx1 = (cx1+1)*MM_CEL;
    const wz0 = cz0*MM_CEL, wz1 = (cz1+1)*MM_CEL;
    MM.pathsPoi = {};
    for (const k of CAT_KEYS) {
      const lista = POI_POR_CAT[k]; if (!lista) continue;
      const P = new Path2D();
      let algum = false;
      for (const p of lista) {
        if (p.x < wx0 || p.x > wx1 || p.z < wz0 || p.z > wz1) continue;
        P.moveTo(p.x + rp, p.z);
        P.arc(p.x, p.z, rp, 0, Math.PI * 2);
        algum = true;
      }
      if (algum) MM.pathsPoi[k] = P;
    }
  }
  g.lineCap = "round"; g.lineJoin = "round";
  for (let k = 0; k < 2; k++) {
    g.lineWidth = (k ? 2.6 : 1.0) / esc;         // em PIXELS, nao em metros
    g.strokeStyle = k ? "rgba(226,232,240,.88)" : "rgba(139,152,167,.38)";
    g.stroke(MM.paths[k]);
  }
  // Os estabelecimentos ligados entram como ponto da cor da categoria: e o que
  // transforma o minimapa em "onde tem farmacia" em vez de so "onde tem rua". Os
  // caminhos ja estao montados acima; aqui so se escolhe quais preencher.
  if (!isPoiHidden()) {
    g.globalAlpha = 0.85;
    for (const k of CAT_KEYS) {
      if (!catOn[k] || !MM.pathsPoi[k]) continue;
      g.fillStyle = CAT[k].col;
      g.fill(MM.pathsPoi[k]);
    }
    g.globalAlpha = 1;
  }

  // Cone de visao, ponto e norte: ja no sistema da tela, entao nao giram junto.
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(R2, R2);
  const meioFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
  g.beginPath(); g.moveTo(0, 0);
  g.arc(0, 0, R2 * 0.92, -Math.PI / 2 - meioFov, -Math.PI / 2 + meioFov);
  g.closePath();
  g.fillStyle = "rgba(75,219,124,.10)"; g.fill();
  // O ponto da camera leva um anel escuro: sem ele some no meio dos pontos de POI.
  g.beginPath(); g.arc(0, 0, 4.4, 0, Math.PI * 2);
  g.fillStyle = "rgba(10,15,21,.85)"; g.fill();
  g.beginPath(); g.arc(0, 0, 3.0, 0, Math.PI * 2);
  g.fillStyle = "#4BDB7C"; g.fill();
  g.rotate(sph.theta);
  g.fillStyle = "rgba(231,235,240,.55)";
  g.font = "600 10px " + getComputedStyle(document.body).fontFamily;
  g.textAlign = "center"; g.fillText("N", 0, -R2 + 13);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Escala: sem ela o minimapa nao diz se aquilo e um bairro ou a cidade.
  const km = alcance >= 1000 ? (alcance / 1000).toFixed(1).replace(".", ",") + " km"
                             : Math.round(alcance) + " m";
  g.textAlign = "left";
  g.fillStyle = "rgba(8,12,17,.75)"; g.fillText(km, 8, S - 6);
  g.fillStyle = "rgba(231,235,240,.62)"; g.fillText(km, 7, S - 7);
}

    return {MM, MM_CEL, montaBaseMinimapa, desenhaMinimapa};
  }
  root.StreetMinimap = Object.freeze({create});
})(globalThis);
