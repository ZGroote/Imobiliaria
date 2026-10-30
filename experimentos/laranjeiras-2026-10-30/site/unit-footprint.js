// Coordinates are [x,z], in the same approximate world frame as the slab.
export function containsPoint(ring,x,z,tolerance=1e-6){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1];
    if(Math.abs((x-a[0])*dz-(z-a[1])*dx)<=tolerance*Math.hypot(dx,dz)&&
      x>=Math.min(a[0],b[0])-tolerance&&x<=Math.max(a[0],b[0])+tolerance&&
      z>=Math.min(a[1],b[1])-tolerance&&z<=Math.max(a[1],b[1])+tolerance)return true;
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

export function validFootprint(ring){
  if(!Array.isArray(ring)||ring.length<4||ring.length>64||
    !ring.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||
    new Set(ring.map(p=>p.join(','))).size!==ring.length)return false;
  const edges=ring.map((a,i)=>[a,ring[(i+1)%ring.length]]);
  if(edges.some(([a,b])=>a[0]!==b[0]&&a[1]!==b[1])||
    edges.reduce((sum,[a,b])=>sum+a[0]*b[1]-b[0]*a[1],0)<=0)return false;
  for(let i=0;i<edges.length;i++)for(let j=i+2;j<edges.length;j++){
    if(i===0&&j===edges.length-1)continue;
    const [a,b]=edges[i],[c,d]=edges[j];
    if(Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&
      Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1])))return false;
  }
  return true;
}

// First hit on a closed prism, including top/bottom. A roof or another floor
// remains an occluder, even when the target zone is visible through a notch.
export function intersectPrism(ray,{footprint,minY,maxY},point){
  const o=ray.origin,d=ray.direction;
  if(o.y>=minY&&o.y<=maxY&&containsPoint(footprint,o.x,o.z))return null;
  let closest=Infinity;
  for(const y of [minY,maxY]){
    const t=(y-o.y)/d.y;
    if(Number.isFinite(t)&&t>=0&&containsPoint(footprint,o.x+t*d.x,o.z+t*d.z))closest=Math.min(closest,t);
  }
  for(let i=0;i<footprint.length;i++){
    const a=footprint[i],b=footprint[(i+1)%footprint.length],ex=b[0]-a[0],ez=b[1]-a[1];
    const det=d.x*ez-d.z*ex;if(Math.abs(det)<1e-12)continue;
    const ax=a[0]-o.x,az=a[1]-o.z,t=(ax*ez-az*ex)/det,s=(ax*d.z-az*d.x)/det,y=o.y+t*d.y;
    if(t>=0&&s>=-1e-9&&s<=1+1e-9&&y>=minY-1e-9&&y<=maxY+1e-9)closest=Math.min(closest,t);
  }
  return Number.isFinite(closest)?ray.at(closest,point):null;
}
