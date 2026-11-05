// MapLibre supplies P*V in map/model coordinates. Recover the eye for PBR shading
// while preserving the same final clip coordinates for geometry and picking.
export function applyMapCamera(camera,projection){
  const inverse=camera.projectionMatrixInverse.copy(projection).invert().elements;
  if(Math.abs(inverse[11])>1e-12)camera.position.set(inverse[8]/inverse[11],inverse[9]/inverse[11],inverse[10]/inverse[11]);
  camera.updateMatrixWorld(true);
  camera.projectionMatrix.multiplyMatrices(projection,camera.matrixWorld);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

// MapLibre reserves depth subranges. Three's shadow maps must encode 0..1,
// otherwise their stored depths no longer match the shader's shadow comparison.
export function withStandardDepthRange(gl,render){
  const previous=gl.getParameter(gl.DEPTH_RANGE);
  gl.depthRange(0,1);
  try{return render();}
  finally{gl.depthRange(previous[0],previous[1]);}
}
