/* Sky dome: the painted equirectangular sky shared by the city and the interior, created once at load. */
(function(root) {
  "use strict";
  function create({THREE, document, scene, NIVEL, hash}) {
/* ---- céu de dentro de casa -------------------------------------------
   A cidade não tem céu, tem COR DE LIMPEZA: um cinza-ardósia igual ao da névoa, e é
   justamente essa igualdade que faz o horizonte fechar sem costura vista de fora. De
   dentro do apartamento não funciona -- a moldura da janela recorta um retângulo
   daquele cinza, e o imóvel inteiro passa a ser anunciado num dia de chumbo.

   Então o céu existe SÓ dentro de casa, e custa uma chamada de desenho:

   - Textura equirretangular desenhada num `<canvas>` na primeira entrada. A página
     abre por duplo clique em `file://`, onde arquivo externo não existe; e desenhar só
     na primeira entrada mantém o custo fora do carregamento da cidade.
   - `depthTest:false` + `renderOrder` bem negativo: a cúpula pinta antes de tudo e o
     resto da cena a cobre pelo próprio desenho. Uma cúpula "longe o bastante" seria
     recortada -- nos níveis sem buffer logarítmico o `far` de dentro de casa é 6 km.
   - `toneMapped:false`: o céu sai na tela exatamente com a cor do canvas. Com o ACES a
     0,72 de exposição (que é o que o interior usa) qualquer azul autoral viraria um
     cinza-azulado, e eu estaria calibrando a olho uma cor que dá pra escrever.

   NUVEM É PINCEL, NÃO RUÍDO. Um FBM por pixel num canvas de 1024x512 são milhões de
   interpolações em JS no meio da transição de entrada; três dezenas de aglomerados de
   elipse com gradiente radial saem em poucos milissegundos e, no traço estilizado
   desta cidade, leem melhor que fractal. A semente é fixa (`hash`), então o céu é o
   mesmo em toda sessão -- a mesma regra da fachada.

   A NÉVOA VEM JUNTO. Sem isso o bairro ao fundo continua morrendo no cinza da cidade
   enquanto o céu atrás dele é azul, e a emenda aparece exatamente na linha do
   horizonte, que é o que a janela mais mostra. */
const CEU_ZENITE = "#3F7AC4", CEU_MEIO = "#7CB0DD", CEU_HORIZ = "#B4D0E8";
// A LINHA do horizonte, que era literal no `addColorStop`. E ela, e nao CEU_HORIZ,
// que a nevoa tem que casar: e o pixel exato com que o ceu encosta no chao.
const CEU_LINHA = "#C7D8E4";
function texturaDoCeu() {
  // `k` mantem o TAMANHO ANGULAR da nuvem igual nos dois niveis: o que a resolucao
  // muda e a nitidez da borda, nao o quanto de ceu cada nuvem ocupa.
  const W = NIVEL.ceuTex || 1024, H = W/2, k = W/1024;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0.00, CEU_ZENITE);
  grd.addColorStop(0.30, CEU_MEIO);
  grd.addColorStop(0.47, CEU_HORIZ);
  grd.addColorStop(0.50, CEU_LINHA);   // a linha do horizonte: sempre a mais lavada
  grd.addColorStop(0.62, "#8A959E");   // abaixo dela quem manda é o chão da cidade;
  grd.addColorStop(1.00, "#5E666E");   // isto aqui só existe pra não ter emenda dura
  g.fillStyle = grd; g.fillRect(0, 0, W, H);

  // Uma bolha: elipse com gradiente radial, opaca no meio e nula na borda. É o tijolo
  // da nuvem -- o volume vem de empilhar bolha, não de desenhar contorno.
  const bolha = (x, y, rx, ry, cor, a) => {
    g.save();
    g.translate(x, y); g.scale(1, ry/rx);
    const rg = g.createRadialGradient(0, 0, rx*0.15, 0, 0, rx);
    rg.addColorStop(0, "rgba(" + cor + "," + a.toFixed(3) + ")");
    rg.addColorStop(0.55, "rgba(" + cor + "," + (a*0.72).toFixed(3) + ")");
    rg.addColorStop(1, "rgba(" + cor + ",0)");
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, rx, 0, Math.PI*2); g.fill();
    g.restore();
  };

  let n = 0;
  const r = () => hash((n++ * 2654435761) >>> 0);
  /* MUITAS nuvens PEQUENAS, não poucas grandes. A textura dá a volta nos 360 graus em
     1.024 pixels, ou seja 0,35 grau por texel: um aglomerado de 100 px ocupa 35 graus
     do céu e, magnificado assim, não lê como nuvem -- lê como mancha desfocada, que foi
     a primeira versão. Cúmulo de verdade a essa distância abre uns 8 a 20 graus. */
  const CLUSTERS = 96;
  for (let i = 0; i < CLUSTERS; i++) {
    const u = r();
    /* Faixa de céu em que a nuvem vive. Ela vai QUASE até o horizonte de propósito:
       de dentro de casa quem olha pela janela vê a faixa logo acima da linha do
       horizonte e quase nada do zênite -- na primeira versão as nuvens paravam a 11°
       de altura e simplesmente nunca apareciam pela janela. No zênite elas somem, aí
       sim: equirretangular estica tudo no polo e a bolha vira um borrão que dá a volta. */
    const t = 0.13 + r()*0.345;
    const cy = t * H;
    const perto = 1 - (t - 0.13)/0.345;         // 1 no alto, 0 encostando no horizonte
    const esc = 0.35 + perto*0.65;
    const w = (20 + r()*44) * esc * k, h = w * (0.34 + r()*0.20) * (0.45 + perto*0.55);
    const alfa = (0.55 + r()*0.40) * (0.35 + perto*0.65);
    const puffs = 6 + Math.floor(r()*7);
    // A cópia lateral só existe pra quem encosta na emenda da imagem (uma nuvem
    // cortada a faca em pleno céu); repetir as noventa e seis seria triplicar o
    // desenho pra consertar meia dúzia.
    const beira = u*W < w*1.2 ? W : (W - u*W < w*1.2 ? -W : 0);
    for (const dx of (beira ? [0, beira] : [0])) {
      const cx = u*W + dx;
      // sombra primeiro, deslocada pra baixo: é ela que separa a nuvem do fundo.
      for (let k = 0; k < puffs; k++) {
        const a2 = k/puffs*Math.PI*2 + r()*0.6;
        bolha(cx + Math.cos(a2)*w*0.42, cy + h*0.30 + Math.sin(a2)*h*0.30,
              w*(0.30 + r()*0.20), h*(0.52 + r()*0.30), "168,182,198", alfa*0.55);
      }
      for (let k = 0; k < puffs; k++) {
        const a2 = k/puffs*Math.PI*2 + r()*0.6;
        bolha(cx + Math.cos(a2)*w*0.44, cy - h*0.10 + Math.sin(a2)*h*0.34,
              w*(0.30 + r()*0.22), h*(0.55 + r()*0.35), "255,255,255", alfa);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

let CEU = null;
function mostraCeu(on) {
  if (on && !CEU) {
    CEU = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20),
      new THREE.MeshBasicMaterial({ map: texturaDoCeu(), side: THREE.BackSide,
        depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    CEU.renderOrder = -1000;
    CEU.frustumCulled = false;
    scene.add(CEU);
  }
  if (CEU) CEU.visible = !!on;
}

/* A CIDADE PASSA A TER O MESMO CEU.
   O que segurava a cupula dentro de casa era a nota acima: vista de fora, a cor de
   limpeza fecha o horizonte sem costura. Fecha -- e e justamente por isso que o alto
   do quadro nao e ceu, e uma banda cinza chapada, medida num print de rua. A cupula
   ja custa UMA chamada de desenho, ja anda com a camera e ja vem com a nevoa casada;
   o que faltava era chamar.

   A nevoa fecha na faixa do HORIZONTE da propria textura (nao no zenite), senao o
   bairro ao fundo morre numa cor que o ceu nao tem em lugar nenhum -- a mesma emenda
   que a versao de dentro de casa evita, so que aqui ela e a linha mais vista da tela.
   O fator e 1,0 e nao o 0,72 do interior porque a exposicao aqui fora e 1,075 e nao
   0,72: o que tem que casar e a cor na TELA, nao o numero.

   `apagaInterior` ja restaurava a nevoa do que estava valendo antes de entrar, entao
   sair de casa volta pra ca sozinho -- e por isso o par mostraCeu(true)/(false) do
   interior saiu: o ceu deixou de ser propriedade do apartamento. */
mostraCeu(true);

    return {CEU_LINHA, CEU, mostraCeu};
  }
  root.SkyDome = Object.freeze({create});
})(globalThis);
