/* Classification from measured footprint, height and source class. */
(function(root) {
  'use strict';
  const BUILDING_INSET = 1.0; // metros — encolhe o contorno do lote antes de extrudar,
                               // pra simular o recuo/calçada e o prédio não "comer" a rua
  const ST = { CASA:0, SOBRADO:1, PREDIO:2, COMERCIO:3, TORRE:4, GALPAO:5, CIVICO:6, ANEXO:7 };
  const ST_NOME = ["Casa térrea", "Sobrado", "Prédio residencial", "Comércio",
                   "Torre comercial", "Galpão", "Institucional", "Anexo"];
  function tipoDe(cls, h, area, ob) {
    const pav = Math.max(1, Math.round((h - 1.1) / 3.15));
    if (area < 34 && h < 4.4) return ST.ANEXO;                        // garagem, edícula, puxadinho
    if (cls === 3) return ST.CIVICO;
    if (area > 700 && pav <= 2 && ob.rect > 0.70) return ST.GALPAO;   // barracão: grande, baixo e retangular
    if (cls === 2) return pav >= 8 ? ST.TORRE : ST.COMERCIO;
    if (cls === 1) return pav >= 4 ? ST.PREDIO : pav >= 2 ? ST.SOBRADO : ST.CASA;
    if (pav >= 8) return ST.TORRE;
    if (pav >= 4) return ST.PREDIO;
    if (area > 420) return ST.COMERCIO;
    return pav >= 2 ? ST.SOBRADO : ST.CASA;
  }
  root.BuildingType = Object.freeze({ST, ST_NOME, tipoDe, BUILDING_INSET});
})(globalThis);
