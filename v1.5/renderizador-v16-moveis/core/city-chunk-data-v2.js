/* Runtime V2 adapters around the existing compact CityData decoder. */
(function(root) {
  "use strict";

  function decodeContext(decode, context) {
    const data={...context,b:[],bm:[],bl:[]};
    const out=decode(data);
    return {R:out.R,G:out.G};
  }

  function decodeChunk(decode, raw, meta) {
    const data={...raw,r:[],g:[],bl:[]};
    const out=decode(data);
    return {
      id:meta.id,cx:meta.cx,cz:meta.cz,rad:meta.rad,
      B:out.B,R:[],G:[]
    };
  }

  root.CityChunkDataV2=Object.freeze({decodeContext,decodeChunk});
})(globalThis);
