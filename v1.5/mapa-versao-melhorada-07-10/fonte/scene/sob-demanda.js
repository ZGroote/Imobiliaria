/* Desenho sob demanda (v2 do mapa melhorado).

   Ate aqui o laco desenhava a cena inteira em TODO quadro da tela, parado ou nao: no
   celular fraco eram 39 ms de CPU por quadro com a camera imovel, e ~8 M triangulos
   enviados a GPU 60 vezes por segundo para refazer a mesma imagem. Bateria e
   aquecimento sem nenhum pixel novo.

   O laco continua o mesmo (um rAF, a mesma ordem de atualizacao), mas a passada de
   desenho so acontece quando alguma coisa VISIVEL mudou. "Mudou" e decidido de duas
   formas que se completam:

   1. ASSINATURA DO QUADRO (scene/frame.js): matriz da camera e da projecao, tamanho e
      resolucao da tela, sol, luzes, neblina e os uniformes globais do relevo, altura,
      noite e furo. E barata (umas 60 comparacoes) e pega tudo que e camera ou ajuste.

   2. CONTADOR DE MUDANCA (este arquivo): os pontos do three por onde passa toda mudanca
      de conteudo ganham um gancho que so incrementa um numero --
        - `needsUpdate = true` em atributo de geometria, material e textura (e por ai
          que chega geometria nova de quarteirao, matriz de instancia, imagem que
          terminou de carregar);
        - `add`/`remove` de objeto (quarteirao que entra, casa que sai);
        - `visible` de qualquer objeto (o streaming esconde e mostra grupos).
      O laco compara o numero com o do ultimo quadro desenhado.

   O que anima sozinho (voo, maquete da ficha, farol, predio subindo, interior, tour,
   montagem pendente) avisa por `animando()` e desenha todo quadro enquanto durar.
   Toque, mouse, teclado e roda marcam a tela por um instante (`suja`), porque o gesto
   pode mexer em coisa que nao passa por nenhum dos ganchos (cor de destaque, rotulo). */
(function (root) {
  "use strict";
  const T = root.THREE;
  let versao = 0, sujoAte = 0;
  const bump = () => { versao++; };
  const agora = () => (root.performance ? performance.now() : Date.now());

  function ganchoNeedsUpdate(proto) {
    if (!proto) return;
    const d = Object.getOwnPropertyDescriptor(proto, "needsUpdate");
    if (!d || !d.set) return;
    Object.defineProperty(proto, "needsUpdate", {
      configurable: true, enumerable: d.enumerable,
      get: d.get, set(v) { d.set.call(this, v); if (v) versao++; } });
  }

  if (T) {
    ganchoNeedsUpdate(T.BufferAttribute && T.BufferAttribute.prototype);
    ganchoNeedsUpdate(T.InterleavedBuffer && T.InterleavedBuffer.prototype);
    ganchoNeedsUpdate(T.Material && T.Material.prototype);
    ganchoNeedsUpdate(T.Texture && T.Texture.prototype);
    const O = T.Object3D && T.Object3D.prototype;
    if (O) {
      const add = O.add, remove = O.remove;
      O.add = function () { versao++; return add.apply(this, arguments); };
      O.remove = function () { versao++; return remove.apply(this, arguments); };
      // `visible` nasce como propriedade PROPRIA no construtor (`this.visible = true`).
      // Com um acessor no prototipo, essa atribuicao passa pelo setter e nenhuma
      // instancia ganha a propriedade propria: todo objeto do three fica coberto.
      Object.defineProperty(O, "visible", {
        configurable: true,
        get() { return this._visivel !== false; },
        set(v) { v = !!v; if (this._visivel !== v) { this._visivel = v; versao++; } } });
    }
  }

  function suja(ms) { const t = agora() + (ms || 0); if (t > sujoAte) sujoAte = t; versao++; }

  // Gesto: a tela fica marcada um pouco alem do ultimo evento (inercia de camera,
  // destaque que acende no `pointermove`).
  if (root.addEventListener) {
    const marca = () => suja(700);
    for (const ev of ["pointerdown", "pointermove", "pointerup", "wheel", "keydown", "keyup",
                      "touchstart", "touchmove", "touchend", "resize", "orientationchange"])
      root.addEventListener(ev, marca, { passive: true, capture: true });
    if (root.document) root.document.addEventListener("visibilitychange", marca);
  }

  root.SobDemanda = Object.freeze({
    versao: () => versao,
    suja,
    sujo: () => agora() < sujoAte,
    bump,
  });
})(globalThis);
