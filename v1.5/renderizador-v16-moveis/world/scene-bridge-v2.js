/* Runtime V2 scene bridge: prefetch warm chunks, mount only visible chunks. */
(function(root) {
  "use strict";

  function create({loader,mountChunk,unmountChunk,concurrency=8}) {
    const mounted=new Map();
    let generation=0, syncing=0;

    async function sync(index,wanted) {
      const gen=++generation;
      syncing++;
      try {
        const byId=new Map((index.chunks||[]).map(c=>[c.id,c]));
        const visible=new Set(wanted.filter(w=>w.state==="visible").map(w=>w.id));
        const keep=new Set(wanted.map(w=>w.id));

        for (const [id,handle] of [...mounted]) {
          if (!visible.has(id)) {
            unmountChunk(id,handle);
            mounted.delete(id);
          }
        }

        async function loadBatch(items) {
          let cursor=0;
          async function worker() {
            while (cursor < items.length) {
              const w=items[cursor++], meta=byId.get(w.id);
              if (!meta || gen!==generation) continue;
              const value=await loader.load(meta);
              if (gen!==generation) return;
              if (w.state==="visible" && !mounted.has(w.id))
                mounted.set(w.id,mountChunk(w.id,value,meta));
            }
          }
          const n=Math.min(Math.max(1,concurrency|0),items.length);
          await Promise.all(Array.from({length:n},worker));
        }

        // Anything on screen wins over speculative prefetch. Only after every visible
        // request settles do warm chunks get network slots.
        await loadBatch(wanted.filter(w=>w.state==="visible"));
        if (gen!==generation) return {stale:true,mounted:new Set(mounted.keys())};
        await loadBatch(wanted.filter(w=>w.state!=="visible"));
        if (gen!==generation) return {stale:true,mounted:new Set(mounted.keys())};

        loader.evict(keep, visible);
        return {stale:false,mounted:new Set(mounted.keys())};
      } finally {
        syncing--;
      }
    }

    function reset() {
      generation++;
      for (const [id,handle] of [...mounted]) unmountChunk(id,handle);
      mounted.clear();
      loader.evict(new Set());
    }

    return Object.freeze({sync,reset,mountedIds:()=>new Set(mounted.keys()),syncing:()=>syncing});
  }

  root.CitySceneBridgeV2=Object.freeze({create});
})(globalThis);
