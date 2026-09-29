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
    const visible = [], warm = [];
    for (const chunk of index.chunks || []) {
      const s = score(chunk, view);
      // Visible area = safe circle + forward lobe. Behind/side content disappears
      // earlier while the direction of travel/view receives the full render radius.
      const base = Math.max(0.1, Math.min(1, view.baseRenderFactor == null ? 0.65 : view.baseRenderFactor));
      const renderReach = renderRadius * (base + (1 - base) * Math.max(0, s.ahead));
      const forwardReach = prefetchRadius + Math.max(0, s.ahead) * (view.forwardExtra || 0);
      const item = {...s, id:chunk.id, bytes:chunk.bytes || 0};
      if (s.distance <= renderReach) visible.push({...item, state:STATES.VISIBLE});
      else if (s.distance <= forwardReach) warm.push({...item, state:STATES.WARM});
      else if (s.distance <= keepRadius && view.resident && view.resident.has(chunk.id))
        warm.push({...item, state:STATES.WARM});
    }

    visible.sort((a,b) => a.priority-b.priority);
    warm.sort((a,b) => a.priority-b.priority);

    // A city may contain millions of chunks; the current view must never turn that
    // into an unbounded working set. Budgets are optional so the pure scheduler keeps
    // backwards-compatible behavior unless the runtime supplies limits.
    const maxVisible = Math.max(1, view.maxVisible == null ? Infinity : view.maxVisible);
    const maxWarm = Math.max(0, view.maxWarm == null ? Infinity : view.maxWarm);
    const maxBytes = Math.max(0, view.maxWantedBytes == null ? Infinity : view.maxWantedBytes);
    const wanted = [];
    let usedBytes = 0;
    function take(list, limit) {
      let n = 0;
      for (const item of list) {
        if (n >= limit) break;
        const cost = item.bytes || 0;
        if (wanted.length && usedBytes + cost > maxBytes) break;
        wanted.push(item); usedBytes += cost; n++;
      }
    }
    take(visible, maxVisible);
    take(warm, maxWarm);
    return wanted;
  }

  root.CityRuntimeV2 = Object.freeze({STATES, score, select});
})(globalThis);
