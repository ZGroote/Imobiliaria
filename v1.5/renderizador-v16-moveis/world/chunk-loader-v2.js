/* Runtime V2 chunk loader: network/cache/decode orchestration, independent of Three.js. */
(function(root) {
  "use strict";

  function create(opts) {
    const fetchJson = opts.fetchJson;
    const decode = opts.decode;
    const maxResident = Math.max(1, opts.maxResident || 256);
    const resident = new Map();
    const pending = new Map();
    let clock = 0;

    function touch(id) {
      const e = resident.get(id);
      if (e) e.used = ++clock;
      return e;
    }

    async function load(chunk) {
      const hit = touch(chunk.id);
      if (hit) return hit.value;
      if (pending.has(chunk.id)) return pending.get(chunk.id);
      const p = (async () => {
        const raw = await fetchJson(chunk.url);
        const value = decode(raw, chunk);
        resident.set(chunk.id, {value, used:++clock});
        return value;
      })().finally(() => pending.delete(chunk.id));
      pending.set(chunk.id, p);
      return p;
    }

    function evict(keepIds) {
      const keep = keepIds || new Set();
      const candidates = [...resident.entries()]
        .filter(([id]) => !keep.has(id))
        .sort((a,b) => a[1].used-b[1].used);
      while (resident.size > maxResident && candidates.length) {
        const [id] = candidates.shift();
        resident.delete(id);
      }
    }

    async function sync(index, wanted) {
      const byId = new Map((index.chunks || []).map(c => [c.id,c]));
      const values = [];
      for (const w of wanted) {
        const c = byId.get(w.id);
        if (c) values.push({id:w.id,state:w.state,value:await load(c)});
      }
      evict(new Set(wanted.map(w=>w.id)));
      return values;
    }

    return Object.freeze({
      load, sync, evict,
      has:id=>resident.has(id),
      residentIds:()=>new Set(resident.keys()),
      pendingIds:()=>new Set(pending.keys())
    });
  }

  root.CityChunkLoaderV2 = Object.freeze({create});
})(globalThis);
