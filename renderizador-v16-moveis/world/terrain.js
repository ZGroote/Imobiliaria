/* Owns the elevation grid, sampling cache and registered geometries. */
(function(root) {
  'use strict';
  function create({THREE, TerrainFit, n, half, exaggeration, getAmount}) {
    const ELEV_N = n, ELEV_HALF = half, TERRAIN_EXAG = exaggeration;
    let elevGrid = null, terrainRegistry = [];
    function terrainY(x, z) {
      return elevGrid ? TerrainFit.sample(elevGrid,ELEV_N,ELEV_HALF,x,z)*TERRAIN_EXAG : 0;
    }
    terrainY.grid={n:ELEV_N,half:ELEV_HALF};
    /* 1.2 do plano da Fase 1, na forma pedida: uma casa de cache pro ponto amostrado com
       mais frequencia, que e o ALVO da orbita. Uma casa so basta porque quem chama de
       verdade em sequencia e sempre o mesmo ponto; qualquer outro uso derruba o cache e
       volta a custar a amostragem cheia. */
    let _tyCache = { x: NaN, z: NaN, v: 0 };
    function terrainYCached(x, z) {
      if (x !== _tyCache.x || z !== _tyCache.z) {
        _tyCache.x = x; _tyCache.z = z; _tyCache.v = terrainY(x, z);
      }
      return _tyCache.v;
    }

    function registerTerrain(geo) {
      if(geo.userData.chaoDetalhe || geo.attributes.aVia) TerrainFit.refine(THREE,geo,terrainY);
      const pos = geo.attributes.position, n = pos.count;
      const baseY = new Float32Array(n);
      // Prédios já chegam com um valor de relevo por vértice pré-calculado (presetDY, um só
      // por edificação — ver buildBuildings) em vez de cada vértice amostrar o seu próprio
      // ponto; chão/rua/verde continuam amostrando por vértice normalmente.
      const dy = geo.userData.presetDY || new Float32Array(n);
      for (let i = 0; i < n; i++) { baseY[i] = pos.getY(i); if (!geo.userData.presetDY) dy[i] = terrainY(pos.getX(i), pos.getZ(i)); }
      geo.userData.terrain = { baseY, dy };
      // v8: so o shader de predio (dynamicHeight) le aDY. Chao/rua/muro tem o
      // relevo aplicado na CPU por applyTerrainToGeo -- ali o atributo e peso
      // morto na GPU (4 B x 1,45 M vertices).
      if (geo.userData.dynamicHeight)
        geo.setAttribute("aDY", new THREE.BufferAttribute(dy, 1));
      terrainRegistry.push(geo);
      if (getAmount()) applyTerrainToGeo(geo, getAmount(), true);
    }
    function applyTerrainToGeo(geo, amount, settle) {
      const t = geo.userData.terrain; if (!t) return;
      // Prédios/risers levam o relevo pelo uniform uRelief no shader (ver facadeMaterial/riseLine),
      // não por posição de vértice, para não serem esticados junto do exagero de altura (hs).
      if (geo.userData.dynamicHeight) return;
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, t.baseY[i] + t.dy[i]*amount);
      pos.needsUpdate = true;
      if (settle) {
        if (geo.attributes.normal) geo.computeVertexNormals();
        geo.computeBoundingSphere();
      }
    }

    function recompute() {
      for (const geo of terrainRegistry) {
        const t = geo.userData.terrain, pos = geo.attributes.position, ctr = geo.userData.presetCenter;
        // Prédio recalcula pelo centro da edificação (mesmo valor pra todo mundo dela), não
        // pela posição de cada vértice — mantém o telhado nivelado (ver buildBuildings).
        if (ctr) for (let i = 0; i < pos.count; i++) t.dy[i] = terrainY(ctr[i*2], ctr[i*2+1]);
        else for (let i = 0; i < pos.count; i++) t.dy[i] = terrainY(pos.getX(i), pos.getZ(i));
        if (geo.attributes.aDY) geo.attributes.aDY.needsUpdate = true;
      }

    }
    return Object.freeze({
      get grid() { return elevGrid; },
      set grid(value) { elevGrid = value; _tyCache.x = _tyCache.z = NaN; },
      sample: terrainY, sampleCached: terrainYCached,
      register: registerTerrain, apply: applyTerrainToGeo, recompute,
      geometries: () => terrainRegistry.values(),
      unregister(geo) {
        const i = terrainRegistry.indexOf(geo);
        if (i >= 0) terrainRegistry.splice(i, 1);
      },
      retain(predicate) { terrainRegistry = terrainRegistry.filter(predicate); }
    });
  }
  root.WorldTerrain = Object.freeze({create});
})(globalThis);
