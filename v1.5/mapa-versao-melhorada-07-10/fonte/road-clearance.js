/* Collision against the road strips and junction patches actually rendered.
   Independent of visible blocks, trees and quality level. Coordinates in metres. */
(function(root){
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function inside(p,ring){
    let yes=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[j],b=ring[i];
      if(Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8)return true;
      if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
  }
  function overlaps(a,b){
    if(a.some(p=>inside(p,b))||b.some(p=>inside(p,a)))return true;
    for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
      const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
      if(cross(p,q,r)*cross(p,q,s)<0&&cross(r,s,p)*cross(r,s,q)<0)return true;
    }
    return false;
  }
  const bounds=r=>r.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
  function create(roads,width,margin=.15){
    const grid=new Map(),cell=160;
    function add(ring,road){
      const box=bounds(ring),item={ring,road,box};
      for(let x=Math.floor(box[0]/cell);x<=Math.floor(box[2]/cell);x++)for(let z=Math.floor(box[1]/cell);z<=Math.floor(box[3]/cell);z++){
        const key=x+':'+z;let list=grid.get(key);if(!list)grid.set(key,list=[]);list.push(item);
      }
    }
    for(const w of roads){
      const h=width(w)/2+margin;
      for(let i=1;i<w.pts.length;i++){
        const a=w.pts[i-1],b=w.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
        if(len<.2)continue;
        const px=-dz/len*h,pz=dx/len*h;
        add([[a[0]+px,a[1]+pz],[b[0]+px,b[1]+pz],[b[0]-px,b[1]-pz],[a[0]-px,a[1]-pz]],w);
        // buildRibbons adds an axis-aligned patch at each interior polyline node.
        if(i>1)add([[a[0]-h,a[1]-h],[a[0]+h,a[1]-h],[a[0]+h,a[1]+h],[a[0]-h,a[1]+h]],w);
      }
    }
    function candidates(ring){
      const box=bounds(ring),seen=new Set(),found=[];
      for(let x=Math.floor(box[0]/cell);x<=Math.floor(box[2]/cell);x++)for(let z=Math.floor(box[1]/cell);z<=Math.floor(box[3]/cell);z++)for(const item of grid.get(x+':'+z)||[]){
        if(seen.has(item))continue;seen.add(item);const b=item.box;
        if(box[2]<b[0]||box[0]>b[2]||box[3]<b[1]||box[1]>b[3])continue;
        found.push(item);
      }
      return found;
    }
    return {hit(ring){return candidates(ring).find(item=>overlaps(ring,item.ring))?.road||null;},
      clipSegment(a,b){
        const items=candidates([a,b]),dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
        if(length<1e-8)return [];
        const ts=[0,1];
        for(const item of items)for(let j=0;j<item.ring.length;j++){
          const p=item.ring[j],q=item.ring[(j+1)%item.ring.length],ex=q[0]-p[0],ez=q[1]-p[1];
          const det=dx*ez-dz*ex,rx=p[0]-a[0],rz=p[1]-a[1];
          if(Math.abs(det)>1e-10){
            const t=(rx*ez-rz*ex)/det,u=(rx*dz-rz*dx)/det;
            if(t>0&&t<1&&u>=0&&u<=1)ts.push(t);
          }else if(Math.abs(rx*dz-rz*dx)<1e-8){
            for(const v of [p,q]){const t=((v[0]-a[0])*dx+(v[1]-a[1])*dz)/(length*length);if(t>0&&t<1)ts.push(t);}
          }
        }
        ts.sort((a,b)=>a-b);const out=[];
        for(let i=1;i<ts.length;i++){
          const lo=ts[i-1],hi=ts[i],mid=(lo+hi)/2;
          if((hi-lo)*length<.02)continue;
          if(!items.some(item=>inside([a[0]+mid*dx,a[1]+mid*dz],item.ring)))out.push([lo,hi]);
        }
        return out;
      }
    };
  }
  root.RoadClearance={create,overlaps};
})(globalThis);
