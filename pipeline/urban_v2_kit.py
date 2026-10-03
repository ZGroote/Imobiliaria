# -*- coding: utf-8 -*-
"""Deterministic lightweight city-house kit for Runtime V2.

The visitor receives a few shared low-poly archetypes, never one mesh per building.
Geometry is generated at build time from dimensions/colors so the kit is reproducible
for every city without Blender or glTF parsing.
"""
from __future__ import annotations
import base64, json, math, struct

WALLS=[(229,221,205),(210,217,211),(222,211,194),(196,178,150),
       (203,199,187),(188,199,205),(225,207,184),(183,191,178)]
ROOFS=[(142,69,46),(156,84,55),(124,65,45),(116,112,103),(104,78,64),(166,92,58)]
DARK=(58,67,72); FRAME=(218,216,207); SLAB=(130,128,119); WOOD=(111,79,57)

def _b64(fmt, values):
    if not values: return ""
    return base64.b64encode(struct.pack("<"+fmt*len(values), *values)).decode("ascii")

def _normal(a,b,c):
    ux,uy,uz=b[0]-a[0],b[1]-a[1],b[2]-a[2]
    vx,vy,vz=c[0]-a[0],c[1]-a[1],c[2]-a[2]
    x,y,z=uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx
    m=math.sqrt(x*x+y*y+z*z) or 1
    return x/m,y/m,z/m

class Mesh:
    def __init__(self): self.groups=[[],[]]
    def tri(self,a,b,c,color,material=0): self.groups[material].append((a,b,c,color))
    def quad(self,a,b,c,d,color,material=0):
        self.tri(a,b,c,color,material); self.tri(a,c,d,color,material)
    def box(self,x,y,z,w,h,d,color,material=0):
        x0,x1=x-w/2,x+w/2; y0,y1=y-h/2,y+h/2; z0,z1=z-d/2,z+d/2
        self.quad((x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1),color,material)
        self.quad((x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0),color,material)
        self.quad((x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1),color,material)
        self.quad((x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0),color,material)
        self.quad((x0,y1,z1),(x1,y1,z1),(x1,y1,z0),(x0,y1,z0),color,material)
        self.quad((x0,y0,z0),(x1,y0,z0),(x1,y0,z1),(x0,y0,z1),color,material)
    def gable(self,x,y,z,w,d,rise,color,over=.28):
        x0,x1=x-w/2-over,x+w/2+over; z0,z1=z-d/2-over,z+d/2+over
        if d>=w:
            r0=(x,y+rise,z0); r1=(x,y+rise,z1)
            self.quad((x0,y,z0),(x0,y,z1),r1,r0,color)
            self.quad((x1,y,z1),(x1,y,z0),r0,r1,color)
            self.tri((x0,y,z0),(x1,y,z0),r0,color)
            self.tri((x1,y,z1),(x0,y,z1),r1,color)
        else:
            r0=(x0,y+rise,z); r1=(x1,y+rise,z)
            self.quad((x0,y,z0),r0,r1,(x1,y,z0),color)
            self.quad((x1,y,z1),r1,r0,(x0,y,z1),color)
            self.tri((x0,y,z1),(x0,y,z0),r0,color)
            self.tri((x1,y,z0),(x1,y,z1),r1,color)
    def hip(self,x,y,z,w,d,rise,color,over=.28):
        x0,x1=x-w/2-over,x+w/2+over; z0,z1=z-d/2-over,z+d/2+over
        if d>=w:
            rr=min(d*.22,(d-w)*.35+.7); a=(x,y+rise,z-rr); b=(x,y+rise,z+rr)
            self.quad((x0,y,z0),(x0,y,z1),b,a,color)
            self.quad((x1,y,z1),(x1,y,z0),a,b,color)
            self.tri((x0,y,z0),a,(x1,y,z0),color)
            self.tri((x1,y,z1),b,(x0,y,z1),color)
        else:
            rr=min(w*.22,(w-d)*.35+.7); a=(x-rr,y+rise,z); b=(x+rr,y+rise,z)
            self.quad((x0,y,z0),a,b,(x1,y,z0),color)
            self.quad((x1,y,z1),b,a,(x0,y,z1),color)
            self.tri((x0,y,z1),a,(x0,y,z0),color)
            self.tri((x1,y,z0),b,(x1,y,z1),color)
    def export(self, ident, category, floors, size):
        p=[]; n=[]; col=[]; idx=[]; groups=[]; vertex=0
        for material,tris in enumerate(self.groups):
            start=len(idx)
            for a,b,c,color in tris:
                normal=_normal(a,b,c)
                for point in (a,b,c):
                    p.extend(round(v*100) for v in point)
                    n.extend(round(v*127) for v in normal)
                    col.extend(color); idx.append(vertex); vertex+=1
            if len(idx)>start: groups.append(dict(start=start,count=len(idx)-start,material=material))
        return dict(id=ident,category=category,floors=floors,size=[round(v,2) for v in size],
                    p=_b64("h",p),n=_b64("b",n),c=_b64("B",col),i=_b64("H",idx),groups=groups)

def _house(i,floors,w,d,*,gable=False,garage=False,lshape=False,flat=False,porch=False):
    m=Mesh(); h=3.05*floors; wall=WALLS[i%len(WALLS)]; roof=ROOFS[i%len(ROOFS)]
    if lshape:
        m.box(-w*.12,h/2,0,w*.68,h,d,wall)
        m.box(w*.28,h/2,-d*.15,w*.42,h,d*.62,wall)
    else: m.box(0,h/2,0,w,h,d,wall)
    m.box(0,.12,0,w+.15,.24,d+.15,SLAB)
    if flat:
        m.box(0,h+.18,0,w+.22,.36,d+.22,SLAB)
        m.box(0,h+.48,d/2+.08,w+.3,.6,.16,FRAME); m.box(0,h+.48,-d/2-.08,w+.3,.6,.16,FRAME)
        m.box(w/2+.08,h+.48,0,.16,.6,d+.3,FRAME); m.box(-w/2-.08,h+.48,0,.16,.6,d+.3,FRAME)
        top=h+.78
    else:
        rise=1.2 if floors==1 else 1.4
        (m.gable if gable else m.hip)(0,h,0,w,d,rise,roof); top=h+rise
    zf=d/2+.04; dx=-w*.25
    m.box(dx,1.08,zf,.95,2.16,.08,FRAME); m.box(dx,1.05,zf+.05,.79,2,.035,WOOD,1)
    for x in ([w*.18] if w<7.4 else [w*.08,w*.32]):
        m.box(x,1.72,zf,1.35,1.25,.07,FRAME); m.box(x,1.72,zf+.055,1.17,1.07,.035,DARK,1)
    if floors==2:
        for x in (-w*.25,w*.1,w*.32):
            if abs(x)<=w*.42:
                m.box(x,4.65,zf,1.28,1.18,.07,FRAME); m.box(x,4.65,zf+.055,1.1,1,.035,DARK,1)
        m.box(0,3.08,0,w+.08,.16,d+.08,FRAME)
    m.box(w/2+.035,1.65,-d*.15,.07,1.15,1.35,FRAME)
    m.box(w/2+.07,1.65,-d*.15,.035,.98,1.16,DARK,1)
    extra_depth=0; extra_width=0
    if porch:
        pw=min(3.3,w*.42); m.box(w*.18,2.45,d/2+.85,pw,.14,1.7,SLAB)
        for x in (w*.18-pw*.42,w*.18+pw*.42): m.box(x,1.2,d/2+1.55,.14,2.4,.14,SLAB)
        extra_depth=1.7
    if garage:
        gw=min(3.4,w*.34); gx=-w/2-gw*.48
        m.box(gx,2.55,d*.15,gw,.16,d*.58,SLAB)
        for zz in (-d*.1,d*.38):
            m.box(gx-gw*.4,1.25,zz,.14,2.5,.14,SLAB); m.box(gx+gw*.4,1.25,zz,.14,2.5,.14,SLAB)
        extra_width=gw*.95
    category="casas" if floors==1 else "sobrados"
    return m.export("%s-v2-%02d"%(category,i+1),category,floors,(w+extra_width,top,d+extra_depth))

def build_pack():
    assets=[]
    # V2 city houses deliberately read larger than the first compact experiment.
    # The dimensions target the aerial-reference language: substantial house mass,
    # while preserving front/side setback and backyard.
    one=[(7.8,10.2),(8.4,11.4),(9.0,12.2),(9.6,10.8),(10.2,13.5),(10.8,12.4),(11.4,14.5),(12.0,11.8),
         (9.2,15.2),(10.4,16.0),(11.2,15.0),(12.4,13.8),(13.0,16.0),(9.8,13.2),(11.0,14.5),(12.0,17.0)]
    for i,(w,d) in enumerate(one):
        assets.append(_house(i,1,w,d,gable=i%3==1,garage=i in {2,5,8,11,14},
                             lshape=i in {6,12},flat=i in {3,10,15},porch=i in {1,4,7,13}))
    two=[(7.6,9.8),(8.2,10.8),(8.8,11.8),(9.4,10.4),(10.0,12.4),(10.6,11.5),(11.2,13.2),(11.8,12.0),
         (8.8,14.0),(9.8,14.5),(10.8,14.8),(12.0,13.6)]
    for j,(w,d) in enumerate(two):
        i=16+j; assets.append(_house(i,2,w,d,gable=j%2==1,garage=j in {1,4,7,10},
                                     lshape=j in {5,9},flat=j in {3,8,11},porch=j in {0,6}))
    return dict(version=1,lod=1,units="m",front="+Z",illustrative=True,assets=assets)

def build_pack_json():
    return json.dumps(build_pack(),separators=(",",":"))

if __name__=="__main__":
    raw=build_pack_json()
    print(json.dumps({"assets":len(json.loads(raw)["assets"]),"bytes":len(raw.encode("utf-8"))}))
