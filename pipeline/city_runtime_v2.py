# -*- coding: utf-8 -*-
"""Compile any existing compact city.json into Runtime V2 spatial packages.

The compiler is city-agnostic: all geography and identity come from the input.
V1 files stay untouched. Output is an index plus independently fetchable chunks.
"""
from __future__ import annotations
import argparse, json, math
from pathlib import Path

FORMAT = "city-runtime-v2"
VERSION = 1

def building_slices(flat):
    out=[]; i=0; bi=0
    while i < len(flat):
        start=i; i += 2
        n=flat[i]; i += 1 + n*2
        out.append((bi,start,i)); bi += 1
    return out

def metadata_by_building(data):
    return {data["bm"][i]: data["bm"][i:i+3] for i in range(0,len(data.get("bm",[])),3)}

def compile_city(source: Path, out_dir: Path):
    data=json.loads(source.read_text(encoding="utf-8"))
    q=data.get("q",10); bl=data.get("bl") or []
    if len(bl)%5: raise ValueError("invalid bl[]")
    slices=building_slices(data["b"]); meta=metadata_by_building(data)
    out_dir.mkdir(parents=True,exist_ok=True); (out_dir/"chunks").mkdir(exist_ok=True)
    chunks=[]
    for gi in range(0,len(bl),5):
        cx,cz,rad,start,count=bl[gi:gi+5]; end=start+count
        if start < 0 or end > len(slices): raise ValueError("group building range out of bounds")
        bflat=[]; bm=[]
        for new_i, old_i in enumerate(range(start,end)):
            _,a,z=slices[old_i]; bflat.extend(data["b"][a:z])
            if old_i in meta:
                _,ni,ai=meta[old_i]; bm.extend([new_i,ni,ai])
        cid=f"{gi//5:06d}"
        # Local string pool: chunks must not repeat the city-wide names table.
        global_names=data.get("names",[])
        used=[]
        for i in range(1,len(bm),3):
            used.extend([bm[i],bm[i+1]])
        remap={old:new for new,old in enumerate(dict.fromkeys(used))}
        local_names=[global_names[old] for old in remap]
        for i in range(1,len(bm),3):
            bm[i]=remap[bm[i]]; bm[i+1]=remap[bm[i+1]]
        payload={"v":VERSION,"q":q,"names":local_names,"b":bflat,"bm":bm}
        raw=json.dumps(payload,separators=(",",":"),ensure_ascii=False)
        rel=f"chunks/{cid}.json"; (out_dir/rel).write_text(raw,encoding="utf-8")
        chunks.append({"id":cid,"cx":cx/q,"cz":cz/q,"rad":rad/q,"buildings":count,
                       "bytes":len(raw.encode("utf-8")),"url":rel})
    index={"format":FORMAT,"version":VERSION,"center":data.get("c"),"q":q,
           "sourceFormatVersion":data.get("v"),"sourceArtifact":source.name,"chunks":chunks}
    (out_dir/"index.json").write_text(json.dumps(index,separators=(",",":"),ensure_ascii=False),encoding="utf-8")
    return index

def main():
    p=argparse.ArgumentParser()
    p.add_argument("source",type=Path); p.add_argument("output",type=Path)
    a=p.parse_args(); idx=compile_city(a.source,a.output)
    print(f"{len(idx['chunks'])} chunks -> {a.output}")

if __name__=="__main__": main()
