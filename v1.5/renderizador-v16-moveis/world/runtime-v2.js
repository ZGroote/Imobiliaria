/* City Runtime V2: pure spatial/directional scheduling. No scene or network dependency. */
(function(root) {
  "use strict";

  const STATES = Object.freeze({ COLD:"cold", QUEUED:"queued", WARM:"warm", VISIBLE:"visible" });

  function norm(x, z) {
    const m = Math.hypot(x, z);
    return m > 1e-9 ? [x / m, z / m] : [0, 1];
  }

  function score(chunk, view) {
    const dx = chunk.cx - view.x, dz = chunk.cz - view.z;
    const distance = Math.max(0, Math.hypot(dx, dz) - (chunk.rad || 0));
    const [vx, vz] = norm(view.dirX || 0, view.dirZ == null ? 1 : view.dirZ);
    const [tx, tz] = norm(dx, dz);
    const ahead = vx * tx + vz * tz; // -1 behind, +1 ahead
    const priority = distance - Math.max(0, ahead) * (view.prefetchBias || 0);
    return {distance, ahead, priority};
  }

  function select(index, view) {
    const renderRadius = view.renderRadius;
    const prefetchRadius = Math.max(renderRadius, view.prefetchRadius || renderRadius);
    const keepRadius = prefetchRadius + (view.hysteresis || 0);
    const wanted = [];
    for (const chunk of index.chunks || []) {
      const s = score(chunk, view);
      const forwardReach = prefetchRadius + Math.max(0, s.ahead) * (view.forwardExtra || 0);
      if (s.distance <= renderRadius) wanted.push({...s, id:chunk.id, state:STATES.VISIBLE});
      else if (s.distance <= forwardReach) wanted.push({...s, id:chunk.id, state:STATES.WARM});
      else if (s.distance <= keepRadius && view.resident && view.resident.has(chunk.id))
        wanted.push({...s, id:chunk.id, state:STATES.WARM});
    }
    wanted.sort((a,b) => a.state === b.state ? a.priority-b.priority :
      (a.state === STATES.VISIBLE ? -1 : 1));
    return wanted;
  }

  root.CityRuntimeV2 = Object.freeze({STATES, score, select});
})(globalThis);
