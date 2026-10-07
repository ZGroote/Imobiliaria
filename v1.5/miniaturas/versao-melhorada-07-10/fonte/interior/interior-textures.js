/* Creates the nine shared interior maps once; no scene or renderer dependency. */
(function(root) {
  "use strict";
  function create({THREE, document}) {
/* ---- textura sem arquivo ----------------------------------------------
   Parede lisa e piso liso viram um cubo branco: sem junta e sem tábua não há escala,
   e um cômodo de 3 m parece do mesmo tamanho que um de 8 m. As três texturas abaixo
   são desenhadas num canvas na hora — a página abre por duplo clique em file://, onde
   arquivo externo não existe, e um PNG embutido em base64 custaria KB por textura.

   Elas saem quase brancas de propósito: a COR vem do `unidade.json`, por vértice, e a
   textura só multiplica. Trocar a cor de um cômodo não exige redesenhar textura. */
function _cv(n) {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  // v16: `willReadFrequently`. Todo canvas que sai daqui e ALTURA lida de volta com
  // `getImageData` (ver normalDeAltura/rugosidadeDeAltura), e sem a dica o Chrome
  // acelera o canvas na GPU e cada leitura vira uma descida de volta pra CPU. Aqui
  // ele fica na CPU, que e onde ja e usado; o envio pra GPU continua sendo o mesmo
  // upload unico do CanvasTexture.
  //
  // NAO e isto que cala o aviso "Multiple readback operations" do console: com a dica
  // nos dois pontos de leitura ele continua saindo duas vezes, entao ele vem de outro
  // canvas (os que viram textura sem passar por aqui: halo de POI, ambiente, ceu -- o
  // upload de canvas pra GPU tambem conta como leitura). Fica registrado: a mudanca se
  // justifica pelo que estes canvas fazem, nao por um aviso que ela nao apagou.
  return [c, c.getContext("2d", { willReadFrequently: true })];
}
function _tex(c, rep, linear) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  // COR e sRGB; RELEVO e RUGOSIDADE nao sao cor. Marcar um mapa de normal como sRGB
  // aplica a curva de gama num vetor -- a normal sai torta e o brilho anda junto,
  // sem erro nenhum no console.
  if (!linear && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.repeat.set(rep, rep);
  return t;
}

/* ---- relevo e rugosidade a partir de uma ALTURA ------------------------
   Ate aqui os tres materiais do interior tinham COR e mais nada: rugosidade
   constante e nenhuma normal. E o que faz superficie parecer papel -- parede
   pintada de verdade tem micro-relevo, junta de porcelanato tem chanfro, regua de
   madeira tem rebaixo. Nada disso e geometria: e o mapa de normal pegando a luz de
   raspao.

   `normalDeAltura` deriva a normal por diferenca central (Sobel simplificado) do
   canal verde de um canvas de altura. `forca` e quanto o relevo pesa -- em parede
   e minusculo de proposito: passar disso vira estuque, e estuque nao e o que o
   anuncio vende.

   As duas rodam UMA vez no boot e o resultado e compartilhado por todas as
   unidades: nao ha custo por casa aberta. */
function normalDeAltura(c, forca) {
  // Mesma dica do `_cv`: a altura e lida DUAS vezes (uma dentro de `_alturaParede`/
  // `_alturaPiso`, outra aqui), e pedir o contexto de novo sem os mesmos atributos
  // deixaria a segunda leitura sem ela.
  const n = c.width, g = c.getContext("2d", { willReadFrequently: true });
  const src = g.getImageData(0, 0, n, n).data;
  const [d, gd] = _cv(n);
  const out = gd.createImageData(n, n);
  const h = (x, y) => src[(((y + n) % n) * n + ((x + n) % n)) * 4 + 1] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * forca;
    const dy = (h(x, y + 1) - h(x, y - 1)) * forca;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * n + x) * 4;
    out.data[i]   = Math.round((-dx / l * 0.5 + 0.5) * 255);
    out.data[i+1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
    out.data[i+2] = Math.round((1 / l * 0.5 + 0.5) * 255);
    out.data[i+3] = 255;
  }
  gd.putImageData(out, 0, 0);
  return _tex(d, null, true);
}

/* Rugosidade que VARIA. Parede pintada nao tem brilho uniforme: a demao deixa
   trecho mais fechado e trecho mais aberto, e e essa variacao que o olho le como
   tinta em vez de plastico. `base` e o valor medio, `amp` o quanto ele passeia --
   em manchas grandes (o rolo), nao em ruido de pixel. */
function rugosidadeManchada(base, amp, semente) {
  const N = 128, [c, g] = _cv(N);
  let s = semente >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "rgb(" + Math.round(base*255) + "," + Math.round(base*255) + "," +
                Math.round(base*255) + ")";
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 90; i++) {
    const v = Math.round(Math.max(0, Math.min(1, base + (rnd()-0.5)*2*amp)) * 255);
    const r = 8 + rnd()*26;
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.5)";
    g.beginPath(); g.arc(rnd()*N, rnd()*N, r, 0, 6.2832); g.fill();
  }
  return _tex(c, null, true);
}
/* ---- as tres ALTURAS -----------------------------------------------------
   Cada uma desenha, em cinza, o RELEVO da superficie -- claro e alto, escuro e
   baixo. `normalDeAltura` converte. Sao as tres coisas que o olho usa pra saber
   que material esta olhando, e nenhuma delas e cor:

     massa corrida  ondulacao larga e rasa da desempenadeira
     porcelanato    o CHANFRO da borda da placa (a junta e um vale em V)
     tabua          o rebaixo entre reguas, mais o veio de leve

   Sao geradas uma vez no boot e compartilhadas por toda unidade. */
function _alturaParede() {
  const N = 128, [c, g] = _cv(N);
  let s = 0x7C1D93F >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#808080"; g.fillRect(0, 0, N, N);
  // ondulacao larga: a marca da desempenadeira, em manchas de 20 a 55 px
  for (let i = 0; i < 130; i++) {
    const v = Math.round(128 + (rnd() - 0.5) * 46);
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.42)";
    g.beginPath(); g.arc(rnd()*N, rnd()*N, 10 + rnd()*18, 0, 6.2832); g.fill();
  }
  // graozinho: o que sobra da textura do rolo
  const d = g.getImageData(0, 0, N, N);
  for (let i = 0; i < d.data.length; i += 4) {
    const j = (rnd() - 0.5) * 16;
    d.data[i] = d.data[i+1] = d.data[i+2] =
      Math.max(0, Math.min(255, d.data[i] + j));
  }
  g.putImageData(d, 0, 0);
  return c;
}

function _alturaPiso() {
  const N = 256, [c, g] = _cv(N);
  g.fillStyle = "#9a9a9a"; g.fillRect(0, 0, N, N);
  // o chanfro: uma borda que DESCE ate a junta. Sem ele a placa e um retangulo
  // pintado; com ele a junta pega sombra de um lado e luz do outro, que e como
  // porcelanato assentado se le de perto.
  const passos = 7;
  for (let k = 0; k < passos; k++) {
    const t = k / passos;
    const v = Math.round(154 - t * 96);
    g.strokeStyle = "rgb(" + v + "," + v + "," + v + ")";
    g.lineWidth = 1.15;
    g.strokeRect(0.6 + k * 1.15, 0.6 + k * 1.15,
                 N - 1.2 - k * 2.3, N - 1.2 - k * 2.3);
  }
  const d = g.getImageData(0, 0, N, N);
  for (let i = 0; i < d.data.length; i += 4) {
    const j = (Math.random() - 0.5) * 5;
    d.data[i] = d.data[i+1] = d.data[i+2] =
      Math.max(0, Math.min(255, d.data[i] + j));
  }
  g.putImageData(d, 0, 0);
  return c;
}

function _alturaMadeira() {
  const N = 512, TAB = 12, H = N / TAB, [c, g] = _cv(N);
  let s = 0x2F6E2B1 >>> 0;    // MESMA semente do albedo: veio e relevo tem que bater
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#8e8e8e"; g.fillRect(0, 0, N, N);
  for (let k = 0; k < TAB; k++) {
    const y0 = k * H;
    for (let i = 0; i < 90; i++) {           // veio: sulco raso
      const y = y0 + rnd() * H;
      const v = Math.round(132 - rnd() * 26);
      g.strokeStyle = "rgba(" + v + "," + v + "," + v + ",0.30)";
      g.lineWidth = 0.6 + rnd() * 1.2;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(N*0.33, y + (rnd()-0.5)*5, N*0.66, y + (rnd()-0.5)*5, N, y);
      g.stroke();
    }
  }
  // rebaixo entre reguas: vale escuro com a quina clara logo abaixo
  for (let k = 0; k <= TAB; k++) {
    const y = k * H;
    g.strokeStyle = "rgba(46,46,46,0.85)"; g.lineWidth = 2.0;
    g.beginPath(); g.moveTo(0, y + 0.9); g.lineTo(N, y + 0.9); g.stroke();
    g.strokeStyle = "rgba(214,214,214,0.55)"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, y + 2.7); g.lineTo(N, y + 2.7); g.stroke();
  }
  return c;
}

const texPiso = (() => {                      // porcelanato: junta fina, 1 placa por UV
  const [c, g] = _cv(256);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 256);
  const d = g.createImageData(256, 256);      // grão finíssimo, tira o "plástico"
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 246 + Math.random() * 9;
    d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 26;
  }
  g.putImageData(d, 0, 0);
  g.strokeStyle = "rgba(120,120,120,0.55)"; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 253);
  return _tex(c);
})();
/* Piso em TÁBUA, não em listra. A primeira versão eram quatro réguas de 40 cm com veio
   corrido e nenhuma junta de topo: sem topo a régua parece infinita, e piso de régua
   infinita não é piso, é papel de parede -- foi o que o usuário apontou.

   Três coisas fazem a tábua ler como tábua, e as três estão aqui:
     1. LARGURA de gente: 12 réguas por UV com passo de 2,40 m dá 20 cm por peça, que é
        a régua que se compra. Com 40 cm o olho lê "painel".
     2. JUNTA DE TOPO escalonada: uma ou duas por régua, em posição sorteada. É ela que
        diz onde uma peça acaba e a outra começa.
     3. TOM POR PEÇA: cada régua sai de um pedaço diferente da tora. Chapar todas no
        mesmo tom é o que dá aparência de impressão.
   O sorteio é SEMEADO (LCG fixo), e não `Math.random`: assim a mesma página desenha o
   mesmo piso em toda sessão. A textura sai quase branca de propósito -- a cor vem de
   `cores.piso_madeira` por vértice e isto aqui só multiplica. */
const texMadeira = (() => {
  const N = 512, TAB = 12, H = N / TAB;
  const [c, g] = _cv(N);
  let s = 0x2F6E2B1 >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, N, N);
  for (let k = 0; k < TAB; k++) {
    const y0 = k * H;
    // Tom por regua: de 0,13 pra 0,26 de amplitude. Piso de madeira de verdade
    // alterna regua clara e escura de forma bem visivel -- foi medido que a cena
    // inteira tinha saturacao media 0,044, e a madeira e a UNICA superficie do
    // apartamento que pode carregar cor sem virar parede colorida.
    g.fillStyle = "rgba(120,88,54," + (rnd() * 0.26).toFixed(3) + ")";
    g.fillRect(0, y0, N, H);
    for (let i = 0; i < 120; i++) {           // veio, sempre DENTRO da régua
      const y = y0 + rnd() * H;
      g.strokeStyle = "rgba(126,92,58," + (0.08 + rnd()*0.16).toFixed(3) + ")";
      g.lineWidth = 0.5 + rnd()*1.1;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(N*0.33, y + (rnd()-0.5)*5, N*0.66, y + (rnd()-0.5)*5, N, y);
      g.stroke();
    }
    for (let i = 0, nj = 1 + (rnd() < 0.45 ? 1 : 0); i < nj; i++) {
      const x = Math.round((0.12 + rnd()*0.76) * N);
      g.strokeStyle = "rgba(74,56,38,0.50)"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y0 + 1.2); g.lineTo(x, y0 + H - 1.2); g.stroke();
    }
  }
  // Junta longitudinal: fio escuro e, logo abaixo, um fio claro. O par é o chanfro da
  // régua pegando luz de raspão -- sem ele a junta vira um risco desenhado.
  for (let k = 0; k <= TAB; k++) {
    const y = k * H;
    g.strokeStyle = "rgba(70,52,34,0.55)"; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(0, y + 0.85); g.lineTo(N, y + 0.85); g.stroke();
    g.strokeStyle = "rgba(255,250,240,0.40)"; g.lineWidth = 1.0;
    g.beginPath(); g.moveTo(0, y + 2.5); g.lineTo(N, y + 2.5); g.stroke();
  }
  return _tex(c);
})();
const texParede = (() => {                    // massa corrida: quase nada, e é o ponto
  const [c, g] = _cv(128);
  const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 243 + Math.random() * 12;
    d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255;
  }
  g.putImageData(d, 0, 0);
  return _tex(c);
})();

// Massa corrida é quase toda difusa; porcelanato polido é o oposto e é ele que dá o
// reflexo do ambiente no chão -- o detalhe que mais faz o cômodo parecer construído.
// 0,15 de ambiente era quase nada. Massa corrida e difusa, sim, mas a parede de um
// comodo real recebe do ceu da janela e do piso o tempo todo -- e e isso que faz o
// canto sombrio parar de ser um retangulo chapado.
/* As TRES superficies do interior, agora com relevo e rugosidade variavel.
   `normalScale` e pequeno de proposito em tudo: o alvo e superficie construida,
   nao estuque. A parede leva o menor de todos (0,22) -- massa corrida tem
   micro-relevo, e passar disso denuncia o truque na primeira luz de raspao. */
const nrmParede = normalDeAltura(_alturaParede(), 1.4);
const nrmPiso = normalDeAltura(_alturaPiso(), 4.5);
const nrmMadeira = normalDeAltura(_alturaMadeira(), 2.6);
const rugParede = rugosidadeManchada(0.78, 0.09, 0x51A3D1);
const rugPiso = rugosidadeManchada(0.20, 0.07, 0x9E3B77);
const rugMadeira = rugosidadeManchada(0.52, 0.10, 0x2C7F4A);

    return {texParede, texPiso, texMadeira, nrmParede, nrmPiso, nrmMadeira, rugParede, rugPiso, rugMadeira};
  }
  root.InteriorTextures = {create};
})(globalThis);
