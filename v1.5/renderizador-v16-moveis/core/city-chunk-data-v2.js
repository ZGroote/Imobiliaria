/* Runtime V2 adapters around the existing compact CityData decoder. */
(function(root) {
  "use strict";

  function decodeContext(decode, context) {
    const data={...context,b:[],bm:[],bl:[]};
    const out=decode(data);
    return {R:out.R,G:out.G};
  }

  function decodeChunk(decode, raw, meta, cityId) {
    if (!cityId) throw Error("Runtime V2 chunk without cityId");
    const data={...raw,r:[],g:[],bl:[]};
    const out=decode(data);
    if (!Array.isArray(raw.bid) || raw.bid.length!==out.B.length)
      throw Error("Runtime V2 chunk building identity mismatch");
    for (let i=0;i<out.B.length;i++)
      out.B[i].id=cityId+":b:"+String(raw.bid[i]);
    return {
      id:meta.id,cx:meta.cx,cz:meta.cz,rad:meta.rad,
      B:out.B,R:[],G:[]
    };
  }

  root.CityChunkDataV2=Object.freeze({decodeContext,decodeChunk});
})(globalThis);
