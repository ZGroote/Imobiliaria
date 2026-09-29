/* Runtime V2 scene bridge: prefetch warm chunks, mount only visible chunks. */
(function(root) {
  "use strict";

  function create({loader,mountChunk,unmountChunk}) {
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

        for (const w of wanted) {
          const meta=byId.get(w.id);
          if (!meta) continue;
          const value=await loader.load(meta);
          if (gen!==generation) return {stale:true,mounted:new Set(mounted.keys())};
          if (w.state==="visible" && !mounted.has(w.id))
            mounted.set(w.id,mountChunk(w.id,value,meta));
        }
        loader.evict(keep);
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
