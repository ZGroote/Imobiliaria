// Coordinates here use Blender's XY floor plane and Z height.
export function createNavigation(config){
  const inside=(x,y,b)=>x>=b[0]&&x<=b[1]&&y>=b[2]&&y<=b[3];
  function height(x,y,previous){
    const s=config.stair;
    if(x>=s.xmin&&x<=s.xmax&&y>=s.ymin&&y<=s.ymax){
      const h=config.ground+Math.ceil(Math.max(0,(y-s.ymin)/(s.ymax-s.ymin))*s.steps)*s.rise/s.steps;
      if(Math.abs(h-previous)<.38)return h;
      if(previous<.95)return config.ground; // washroom below the upper treads
      return null;
    }
    if(previous>config.upper-.42){
      if(inside(x,y,config.upperFootprint)||inside(x,y,config.balcony))return config.upper;
      return null;
    }
    if(previous>config.ground+.42)return null;
    if(inside(x,y,config.upperFootprint))return config.ground;
    if(y<.55&&y>-.10&&x>-3.4&&x<-1.65)return .59;
    if(x>.6&&x<7.8&&y>-1&&y<6.1)return .54;
    if(y<.6&&y>-4.3&&x>-3.5&&x<7.8)return .16+.38*Math.max(0,Math.min(1,(y+4.3)/4.9));
    if(y>-.1&&y<7.4)return .48;
    return .16;
  }
  function blocked(x,y,feet,boxes){
    const r=config.radius;
    for(const b of boxes){
      if(b.slopedStairGuard){
        const s=config.stair,t=Math.max(0,Math.min(1,(y-s.ymin)/(s.ymax-s.ymin)));
        const bottom=.70+3.07*t;
        if(feet+config.eye-.1<bottom||feet+.12>bottom+.89)continue;
      }
      if(b.max.y<feet+.12||b.min.y>feet+config.eye-.1)continue;
      const dx=Math.max(b.min.x-x,0,x-b.max.x),dz=Math.max(b.min.z+y,0,-y-b.max.z);
      if(dx*dx+dz*dz<r*r)return true;
    }
    return false;
  }
  function canMove(x,y,previous,boxes){const h=height(x,y,previous);return h!==null&&Math.abs(h-previous)<.38&&!blocked(x,y,h,boxes)&&x>-10&&x<10&&y>-10&&y<9;}
  return {height,blocked,canMove,inside};
}
