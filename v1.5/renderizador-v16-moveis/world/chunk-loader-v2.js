/* Runtime V2 chunk loader: network/cache/decode orchestration, independent of Three.js. */
(function(root) {
  "use strict";

  function create(opts) {
    const fetchJson = opts.fetchJson;
    const decode = opts.decode;
    const maxResident = Math.max(1, opts.maxResident || 256);
    const maxResidentBytes = Math.max(1, opts.maxResidentBytes || Infinity);
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
        let raw;
        if (chunk.packUrl) {
          const pack = await fetchJson(chunk.packUrl);
          raw = pack && pack.chunks && pack.chunks[chunk.id];
          if (!raw) throw Error("Runtime V2 pack missing chunk " + chunk.id);
        } else {
          raw = await fetchJson(chunk.url);
        }
        const value = decode(raw, chunk);
        resident.set(chunk.id, {value, used:++clock, bytes:chunk.bytes || 0});
        return value;
      })().finally(() => pending.delete(chunk.id));
      pending.set(chunk.id, p);
      return p;
    }

    function residentBytes() {
      let n=0; for (const e of resident.values()) n += e.bytes || 0; return n;
    }

    function evict(keepIds, pinnedIds) {
      const keep = keepIds || new Set();
      const pinned = pinnedIds || new Set();
      // keep is a preference, not immunity. Only pinned visible chunks are protected;
      // otherwise a large cone could defeat maxResident forever (the old 1,529 case).
      const candidates = [...resident.entries()]
        .filter(([id]) => !pinned.has(id))
        .sort((a,b) => {
          const ak=keep.has(a[0])?1:0, bk=keep.has(b[0])?1:0;
          return ak===bk ? a[1].used-b[1].used : ak-bk;
        });
      let bytes=residentBytes();
      while ((resident.size > maxResident || bytes > maxResidentBytes) && candidates.length) {
        const [id,e] = candidates.shift();
        if (resident.delete(id)) bytes -= e.bytes || 0;
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
      residentBytes,
      pendingIds:()=>new Set(pending.keys())
    });
  }

  root.CityChunkLoaderV2 = Object.freeze({create});
})(globalThis);
