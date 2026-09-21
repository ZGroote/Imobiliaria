/* Stable adapter for geometric probes; the renderer owns scene state. */
(function(root) {
  'use strict';
  function create({terrainY, scene, renderer, camera, target, sph, getArborizacao, monta}) {
    return Object.freeze({
      version: 1,
      terrainY,
      cena() {
        return {scene, renderer, camera, target, sph, ARV: getArborizacao(), monta};
      }
    });
  }
  root.MapDiagnostics = Object.freeze({create});
})(globalThis);
