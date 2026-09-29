# -*- coding: utf-8 -*-
"""Compile any compact city.json into city-agnostic Runtime V2 spatial packages."""
from __future__ import annotations
import argparse, base64, hashlib, json, re
from pathlib import Path

FORMAT = "city-runtime-v2"
VERSION = 2
CITY_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def building_slices(flat):
    out=[]; i=0; bi=0
    while i < len(flat):
        start=i; i += 2
        n=flat[i]; i += 1 + n*2
        out.append((bi,start,i)); bi += 1
    return out


def metadata_by_building(data):
    return {data["bm"][i]: data["bm"][i:i+3] for i in range(0,len(data.get("bm",[])),3)}


def _ring_from_slice(flat, start):
    i=start+2; n=flat[i]; i+=1
    x=z=0; ring=[]
    for _ in range(n):
        x+=flat[i]; z+=flat[i+1]; i+=2
        ring.append((x,z))
    return ring


def _canonical_cycle(points):
    """Same polygon -> same tuple regardless of start vertex or winding."""
    if not points:
        return ()
    seq=list(points)
    if len(seq)>1 and seq[0]==seq[-1]:
        seq.pop()
    if not seq:
        return ()
    def best_rotation(items):
        smallest=min(items)
        starts=[i for i,p in enumerate(items) if p==smallest]
        return min(tuple(items[i:]+items[:i]) for i in starts)
    return min(best_rotation(seq),best_rotation(list(reversed(seq))))


def building_fingerprint(flat, start):
    """80-bit footprint identity suffix; class/height/appearance never participate."""
    ring=_canonical_cycle(_ring_from_slice(flat,start))
    raw=";".join(f"{x},{z}" for x,z in ring).encode("ascii")
    digest=hashlib.blake2b(raw,digest_size=10,person=b"city-bldg").digest()
    return base64.b32encode(digest).decode("ascii").rstrip("=").lower()


def _building_ids(flat, slices):
    ids=[building_fingerprint(flat,start) for _,start,_ in slices]
    seen={}
    for i,bid in enumerate(ids):
        prior=seen.setdefault(bid,i)
        if prior!=i:
            raise ValueError(f"duplicate building footprint identity {bid}: {prior} and {i}")
    return ids


def _valid_city_id(city_id):
    if not isinstance(city_id,str) or not CITY_ID_RE.fullmatch(city_id):
        raise ValueError("city_id must be a stable slug-like identifier")
    return city_id


def compile_city(source: Path, out_dir: Path, *, city_id: str):
    city_id=_valid_city_id(city_id)
    data=json.loads(source.read_text(encoding="utf-8"))
    q=data.get("q",10); bl=data.get("bl") or []
    if len(bl)%5: raise ValueError("invalid bl[]")
    slices=building_slices(data["b"]); meta=metadata_by_building(data)
    building_ids=_building_ids(data["b"],slices)
    out_dir.mkdir(parents=True,exist_ok=True); (out_dir/"chunks").mkdir(exist_ok=True)

    # Shared non-building context stays independent of every chunk. Roads and green
    # areas keep their original name indices, so the global names table belongs here.
    context={"v":VERSION,"q":q,"names":data.get("names",[]),
             "r":data.get("r",[]),"g":data.get("g",[])}
    context_raw=json.dumps(context,separators=(",",":"),ensure_ascii=False)
    (out_dir/"context.json").write_text(context_raw,encoding="utf-8")

    chunks=[]
    for gi in range(0,len(bl),5):
        cx,cz,rad,start,count=bl[gi:gi+5]; end=start+count
        if start < 0 or end > len(slices): raise ValueError("group building range out of bounds")
        bflat=[]; bm=[]; bid=[]
        for new_i, old_i in enumerate(range(start,end)):
            _,a,z=slices[old_i]; bflat.extend(data["b"][a:z]); bid.append(building_ids[old_i])
            if old_i in meta:
                _,ni,ai=meta[old_i]; bm.extend([new_i,ni,ai])

        # Chunk-local string pool avoids repeating the city-wide table thousands of times.
        global_names=data.get("names",[]); used=[]
        for i in range(1,len(bm),3): used.extend([bm[i],bm[i+1]])
        remap={old:new for new,old in enumerate(dict.fromkeys(used))}
        local_names=[global_names[old] for old in remap]
        for i in range(1,len(bm),3):
            bm[i]=remap[bm[i]]; bm[i+1]=remap[bm[i+1]]

        # bid[] is the stable building identity suffix. Runtime prefixes cityId:b:,
        # keeping chunk payloads smaller while preserving a globally unique identity.
        payload={"v":VERSION,"q":q,"names":local_names,"b":bflat,"bm":bm,"bid":bid}

        # Preserve decoder-visible per-building semantics while remapping to local indices.
        if isinstance(data.get("fa"),list):
            payload["fa"]=data["fa"][start:end]
        if isinstance(data.get("urbanLots"),dict):
            local={}
            for new_i,old_i in enumerate(range(start,end)):
                key=str(old_i)
                if key in data["urbanLots"]: local[str(new_i)]=data["urbanLots"][key]
            if local: payload["urbanLots"]=local

        cid=f"{gi//5:06d}"
        raw=json.dumps(payload,separators=(",",":"),ensure_ascii=False)
        rel=f"chunks/{cid}.json"; (out_dir/rel).write_text(raw,encoding="utf-8")
        chunks.append({"id":cid,"cx":cx/q,"cz":cz/q,"rad":rad/q,"buildings":count,
                       "bytes":len(raw.encode("utf-8")),"url":rel})

    index={"format":FORMAT,"version":VERSION,"cityId":city_id,
           "center":data.get("c"),"q":q,
           "sourceFormatVersion":data.get("v"),"sourceArtifact":source.name,
           "buildingCount":len(building_ids),
           "context":{"url":"context.json","bytes":len(context_raw.encode("utf-8"))},
           "chunks":chunks}
    (out_dir/"index.json").write_text(json.dumps(index,separators=(",",":"),ensure_ascii=False),encoding="utf-8")
    return index


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--city-id",required=True,help="stable city namespace, e.g. sao-carlos")
    p.add_argument("source",type=Path); p.add_argument("output",type=Path)
    a=p.parse_args(); idx=compile_city(a.source,a.output,city_id=a.city_id)
    print(f"{len(idx['chunks'])} chunks / {idx['buildingCount']} buildings -> {a.output}")


if __name__=="__main__": main()
