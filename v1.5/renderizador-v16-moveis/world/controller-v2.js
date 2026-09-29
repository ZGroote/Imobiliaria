/* Runtime V2 directional controller: movement leads while panning, camera leads at rest. */
(function(root) {
  "use strict";

  function norm(x,z,fallbackX=0,fallbackZ=1) {
    const m=Math.hypot(x,z);
    if (m>1e-9) return [x/m,z/m];
    const f=Math.hypot(fallbackX,fallbackZ)||1;
    return [fallbackX/f,fallbackZ/f];
  }

  function create({index,select,bridge,getResident,getSample,getViewConfig,now,onError,
                   moveThreshold=30,turnDot=0.985,motionHoldMs=260}) {
    let anchorX=1e30,anchorZ=1e30,lastX=null,lastZ=null,lastMoveAt=-1e30;
    let moveDir=[0,1],chosenDir=[0,1];

    function update(force=false) {
      const s=getSample();
      const t=now();
      if (lastX!=null) {
        const dx=s.x-lastX,dz=s.z-lastZ;
        if (Math.hypot(dx,dz)>.5) {
          moveDir=norm(dx,dz,moveDir[0],moveDir[1]);
          lastMoveAt=t;
        }
      }
      lastX=s.x; lastZ=s.z;

      const viewDir=norm(s.viewDirX,s.viewDirZ,chosenDir[0],chosenDir[1]);
      const dir=(t-lastMoveAt<=motionHoldMs)?moveDir:viewDir;
      const moved=Math.hypot(s.x-anchorX,s.z-anchorZ)>=moveThreshold;
      const turned=dir[0]*chosenDir[0]+dir[1]*chosenDir[1]<turnDot;
      if (!force && !moved && !turned) return false;

      anchorX=s.x; anchorZ=s.z; chosenDir=dir;
      const wanted=select(index,{...getViewConfig(),x:s.x,z:s.z,dirX:dir[0],dirZ:dir[1],
                                 resident:getResident()});
      Promise.resolve(bridge.sync(index,wanted)).catch(onError||console.error);
      return true;
    }

    function reset() {
      anchorX=anchorZ=1e30; lastX=lastZ=null; lastMoveAt=-1e30;
      moveDir=chosenDir=[0,1];
      bridge.reset();
    }

    return Object.freeze({update,reset,get direction(){return chosenDir.slice();}});
  }

  root.CityControllerV2=Object.freeze({create});
})(globalThis);
