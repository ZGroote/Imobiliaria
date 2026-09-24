/* Urban-model selection and road collision cache; owns no scene objects. */
(function(root) {
  "use strict";
  function create({geometry, types, terrainY}) {
    const {shoelace, safeInset, obbOf} = geometry;
    const {ST, tipoDe, BUILDING_INSET} = types;
    let roadSafetyCache = new WeakMap();
const explicitBuilding = b => b.lancamento || b.parede != null || b.sacadas;
function buildingOverRoad(b, roadSafety) {
  if (!roadSafety || explicitBuilding(b)) return false;
  if (!roadSafetyCache.has(b)) roadSafetyCache.set(b,!!roadSafety.hit(b.r));
  return roadSafetyCache.get(b);
}
function urbanSplit(records, urban, roadSafety) {
  const rest=[], slots=[], shadows=[];
  if (!urban) return {rest:records,slots,shadows};
  const ordered = records.slice().sort((a,b)=>a.r[0][0]-b.r[0][0]||a.r[0][1]-b.r[0][1]);
  for (const b of ordered) {
    const gerado = shoelace(b.r)>0;
    const ring = safeInset(gerado?b.r.slice().reverse():b.r,gerado?.25:BUILDING_INSET);
    const ob = obbOf(ring,Math.abs(shoelace(ring))/2);
    const st = tipoDe(b.c,b.h,b.area,ob);
    const category = st===ST.CASA?'casas':st===ST.SOBRADO?'sobrados':
      (st===ST.PREDIO||(st===ST.TORRE&&b.c!==2))?'predios':null;
    const chosen = urban.select(b,ob,ring,category,slots);
    if (chosen && roadSafety?.hit(chosen.corners)) { rest.push(b); continue; }
    if (!chosen) { rest.push(b); continue; }
    let base = terrainY(chosen.x,chosen.z);
    for(const p of chosen.corners) base = Math.max(base,terrainY(p[0],p[1]));
    slots.push(urban.add(chosen,b,base));
    shadows.push(chosen.x,chosen.z,Math.cos(chosen.theta),-Math.sin(chosen.theta),
      chosen.asset.size[0]*chosen.scale/2,chosen.asset.size[2]*chosen.scale/2,
      base,chosen.asset.size[1]*chosen.scale);
  }
  return {rest,slots,shadows};
}
    return {explicitBuilding, blocked:buildingOverRoad, split:urbanSplit, clear(){roadSafetyCache = new WeakMap();}};
  }
  root.BuildingPlacement = {create};
})(globalThis);
