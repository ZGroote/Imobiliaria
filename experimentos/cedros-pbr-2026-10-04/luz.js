/* Experimento: um SpotLight por cômodo, no plafom e apontado para baixo, SEM sombra. A PointLight
   a 16 cm do forro estourava um disco no teto; luminária de teto ilumina o chão, não o forro. Luz não é acabamento
   (o guia pede limites e provas próprios), por isso fica fora do visual.js. `?luz=0` desliga.
   Sem sombra, a luz atravessa parede: o alcance limitado ao cômodo é o que segura o vazamento. */
(function (root) {
  'use strict';
  root.CedrosLuz = {start({THREE: T, maq, PL_R, intensidade, cor, preenchimento = 0}) {
    if (!PL_R || new URL(location.href).searchParams.get('luz') === '0') return null;
    const luzes = [], cena = maq.cena, antes = cena.onBeforeRender;
    // A planta só nasce ao entrar em Planta 3D/Visita. A luz entra no MESMO render em que ela
    // aparece: um quadro depois, o three recompilaria todo material já compilado sem as luzes.
    cena.onBeforeRender = function (...a) {
      const casa = maq.planta();
      if (casa && !luzes.length) poe(casa);
      return antes.apply(this, a);
    };
    function poe(casa) {
      for (const c of PL_R.comodos) {
        const xs = c.poly.map(p => p[0]), zs = c.poly.map(p => p[1]);
        const meiaDiagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2;
        const y = (PL_R.pd || 2.6) - 0.12;  // o alcance conta o pé-direito: no banho a diagonal é menor que ele
        const l = new T.SpotLight(cor, intensidade, Math.hypot(meiaDiagonal, y) * 1.15, Math.PI / 2.4, 0.9, 2);
        l.position.set(c.cx, y, c.cz);
        l.target.position.set(c.cx, 0, c.cz);
        casa.add(l, l.target); luzes.push(l);
      }
      // Preenchimento: imita a luz rebatida que o PREMIUM traz do Cycles. Mora na casa, então só
      // conta em Planta 3D/Visita; o "chão" da hemisférica é o tom do piso rebatido.
      if (preenchimento > 0) { const h = new T.HemisphereLight(0xFFF6EC, 0x8F877D, preenchimento); casa.add(h); luzes.push(h); }
      casa.updateMatrixWorld(true);  // o render já atualizou as matrizes antes deste gancho
    }
    return (root.__cedrosLuz = {luzes});
  }};
})(window);
