"""Registro ilustrativo e consultas do polígono; sem dependência do Blender."""
import hashlib
import json
import math
from pathlib import Path


def interpolate(value, inputs, outputs):
    if not math.isfinite(value):
        raise ValueError('Coordenada não finita')
    for a, b, c, d in zip(inputs, inputs[1:], outputs, outputs[1:]):
        if min(a, b)-1e-9 <= value <= max(a, b)+1e-9:
            return c+(value-a)*(d-c)/(b-a)
    raise ValueError('Coordenada fora do registro')


def signed_area(points):
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points, points[1:]+points[:1]))/2


def validate_outline(points):
    if len(points)<8 or len(set(map(tuple,points)))!=len(points):
        raise ValueError('Contorno com poucos vértices ou repetição')
    edges=list(zip(points,points[1:]+points[:1]))
    for a,b in edges:
        if not all(math.isfinite(value) for value in [*a,*b]) or (a[0]!=b[0] and a[1]!=b[1]):
            raise ValueError('Contorno deve ser ortogonal e finito')
    for i,(a,b) in enumerate(edges):
        for j,(c,d) in enumerate(edges):
            if j<=i+1 or (i==0 and j==len(edges)-1):continue
            if a[0]==b[0] and c[1]==d[1]:
                crossing=min(c[0],d[0])<=a[0]<=max(c[0],d[0]) and min(a[1],b[1])<=c[1]<=max(a[1],b[1])
            elif a[1]==b[1] and c[0]==d[0]:
                crossing=min(a[0],b[0])<=c[0]<=max(a[0],b[0]) and min(c[1],d[1])<=a[1]<=max(c[1],d[1])
            elif a[0]==b[0]==c[0]==d[0]:
                crossing=max(min(a[1],b[1]),min(c[1],d[1]))<=min(max(a[1],b[1]),max(c[1],d[1]))
            elif a[1]==b[1]==c[1]==d[1]:
                crossing=max(min(a[0],b[0]),min(c[0],d[0]))<=min(max(a[0],b[0]),max(c[0],d[0]))
            else:crossing=False
            if crossing:raise ValueError('Contorno com auto-interseção')
    if signed_area(points)<=0:raise ValueError('Orientação/área inválida')


def triangulate(points):
    """Ear clipping: uma diagonal não pode passar por outro vértice do contorno."""
    if signed_area(points)<=0:raise ValueError('Triangulação exige orientação CCW')
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    remaining=list(range(len(points)));triangles=[]
    while len(remaining)>3:
        for k,b in enumerate(remaining):
            a,c=remaining[k-1],remaining[(k+1)%len(remaining)]
            if cross(points[a],points[b],points[c])<=1e-9:continue
            if any(all(cross(points[i],points[j],points[p])>=-1e-9 for i,j in [(a,b),(b,c),(c,a)])
                   for p in remaining if p not in [a,b,c]):continue
            triangles.append((a,b,c));remaining.pop(k);break
        else:raise ValueError('Contorno sem triangulação segura')
    if cross(*(points[i] for i in remaining))<=1e-9:raise ValueError('Triângulo final degenerado')
    return triangles+[tuple(remaining)]


class Outline:
    def __init__(self,path,root=None):
        self.path=Path(path);self.spec=json.loads(self.path.read_text('utf-8'))
        if self.spec['schema']!='liv-tower-outline-v1':raise ValueError('Esquema de contorno inválido')
        self.registration=self.spec['registration'];self.pixels=self.spec['verticesUV']
        if root is not None:
            source=Path(root)/self.spec['source']['path']
            if hashlib.sha256(source.read_bytes()).hexdigest()!=self.spec['source']['sha256']:
                raise ValueError('A imagem fonte mudou')
        self.points=[self.to_model(*point) for point in self.pixels]
        validate_outline(self.points)

    def to_model(self,u,v):
        r=self.registration
        x=interpolate(v,r['imageAxisV'],r['modelAxisX'])
        a,b=r['imageBodySidesU'];c,d=r['modelBodySidesZ']
        return (x,c+(u-a)*(d-c)/(b-a))

    def to_image(self,x,z):
        r=self.registration
        v=interpolate(x,r['modelAxisX'],r['imageAxisV'])
        a,b=r['modelBodySidesZ'];c,d=r['imageBodySidesU']
        return (c+(z-a)*(d-c)/(b-a),v)

    def face(self,x,sign):
        values=[a[1] for a,b in zip(self.points,self.points[1:]+self.points[:1])
                if abs(a[1]-b[1])<1e-8 and min(a[0],b[0])-1e-8<=x<=max(a[0],b[0])+1e-8]
        if not values:raise ValueError('X fora da fachada')
        return max(values) if sign==1 else min(values)

    def end(self,z,sign):
        values=[a[0] for a,b in zip(self.points,self.points[1:]+self.points[:1])
                if abs(a[0]-b[0])<1e-8 and min(a[1],b[1])-1e-8<=z<=max(a[1],b[1])+1e-8]
        if not values:raise ValueError('Z fora da cabeceira')
        return max(values) if sign==1 else min(values)

    def window_centers(self,centers,width=1.14,margin=.08):
        breaks=sorted({x for x,z in self.points});result=[]
        for value in centers:
            a,b=next((a,b) for a,b in zip(breaks,breaks[1:]) if a<=value<=b)
            half=width/2+margin
            if b-a<2*half:raise ValueError('Vão não cabe no pano')
            result.append(min(max(value,a+half),b-half))
        return result
