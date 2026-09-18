/* Sombra PROJETADA na cidade: enquadramento do mapa por zoom, bias e o sol baixo.

   Portado do v15 (`renderizador/app.js`), onde nasceu medido. Vale so quando a chave de
   aparencia `sombra_projetada` esta ligada na cidade: sem ela nada aqui muda um pixel, e
   o renderizador segue com a caixa fixa de 640 m e o bias do interior, como estava.

   Duas coisas que a medida do v15 deixou registradas, e que sao o motivo de isto existir:

   1. A ELEVACAO DO SOL DECIDE SE A SOMBRA EXISTE, por um fator de 9. Com o sol a 48,7
      graus (y=940), ligar `castShadow` em predio, muro e arvore mudou 2,00% do quadro de
      rua e 4,03% do de bairro -- tecnicamente ligado, praticamente invisivel, porque uma
      casa de 6 m projetava 5,3 m de sombra e ela caia debaixo da propria casa. A 30 graus
      (y=476) os MESMOS objetos e as MESMAS chamadas de desenho dao 18,80% e 25,22%.

   2. A meia-extensao do mapa sai do ENQUADRAMENTO, nao do tamanho da cidade. Presa em
      640 m, uma caixa de 1.280 m sobre um mapa de 2.048 vale 0,625 m por texel: grosso
      pra telhado e invisivel pra muro (que tem 20 cm). Num quadro de rua (raio ~130) a
      mesma memoria passa a valer 0,20 m por texel. A histerese de 8% existe porque mexer
      na projecao invalida o mapa: sem ela, arrastar o zoom redesenharia a passada toda.

   `bias` empurra ao longo do RAIO e, forte demais, descola a sombra do pe do muro --
   justo onde o contato precisa aparecer. `normalBias` empurra ao longo da NORMAL, que e
   o que mata a acne em parede quase paralela ao sol sem pagar esse preco. O -0,0012 do
   modo sem projecao foi calibrado pro INTERIOR, onde a cena cabe em poucos metros.     */
(function(root) {
  "use strict";
  // Altura do sol em relacao ao alvo: 30 graus de elevacao com projecao, 48,7 sem.
  const ALTURA_COM = 476, ALTURA_SEM = 940;

  function create({sun, sph, sujaSombra, projeta}) {
    const sc = sun.shadow.camera;
    sc.near = 200; sc.far = 3200;
    if (!projeta) {
      // O que o v16 sempre fez: caixa fixa e bias do interior.
      const SHR = 640;
      sc.left = -SHR; sc.right = SHR; sc.top = SHR; sc.bottom = -SHR;
      sun.shadow.bias = -0.0012;
      return {porQuadro: () => {}};
    }
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.55;
    let SHR = 0;
    function porQuadro() {
      const r = Math.min(640, Math.max(120, sph.radius * 1.6));
      if (SHR && Math.abs(r - SHR) < SHR * 0.08) return;
      SHR = r;
      sc.left = -SHR; sc.right = SHR; sc.top = SHR; sc.bottom = -SHR;
      sc.updateProjectionMatrix();
      sujaSombra();
    }
    porQuadro();
    return {porQuadro};
  }

  root.CityShadow = Object.freeze({create, ALTURA_COM, ALTURA_SEM});
})(globalThis);
