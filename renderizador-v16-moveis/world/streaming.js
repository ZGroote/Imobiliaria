/* Spatial streaming queue. Scene assembly and disposal stay with the caller. */
(function(root) {
  "use strict";
  function create({target, live:gLive, getGroups, getRadius, hysteresis, budgetMs,
                   dropGroup, buildGroup, rebuildOverlay, now}) {
    let streamQ = [], anchorX = 1e9, anchorZ = 1e9, ready = false;
function update(force) {
  if (!ready) return;
  const dx = target.x - anchorX, dz = target.z - anchorZ;
  if (!force && dx*dx + dz*dz < 60*60) return;   // andou pouco: nada muda
  anchorX = target.x; anchorZ = target.z;

  const keep = getRadius() + hysteresis;
  const gGroups = getGroups();
  let dropped = false;
  const want = [];
  for (let i = 0; i < gGroups.length; i++) {
    const g = gGroups[i];
    const d = Math.hypot(g.cx - target.x, g.cz - target.z) - g.rad;
    if (gLive.has(i)) { if (d > keep) { dropGroup(i); dropped = true; } }
    else if (d <= getRadius()) want.push([d, i]);
  }
  // monta de dentro pra fora: o que está debaixo do nariz aparece primeiro
  want.sort((a, b) => a[0] - b[0]);
  streamQ = want.map(w => w[1]);
  if (dropped) rebuildOverlay();
}


    function buildNext() {
      if (!streamQ.length) return false;
      buildGroup(streamQ.shift());
      return true;
    }
    function pump() {
      const t0 = now();
      let count = 0;
      while (streamQ.length && now() - t0 < budgetMs) { buildNext(); count++; }
      return count;
    }
    function reset() { streamQ = []; anchorX = anchorZ = 1e9; ready = false; }
    return {update, pump, buildNext, reset, start() { ready = true; },
      get pending() { return streamQ.length; }};
  }
  root.WorldStreaming = Object.freeze({create});
})(globalThis);
