export function probeShaderCode(count){
  if(!Number.isInteger(count)||count<1||count>64)throw Error('Quantidade de cômodos inválida.');
  return {cube:`vec3 livAmbientCube(sampler3D volume, vec3 q, vec3 n, vec3 size, float rows) {
    vec3 n2=n*n;
    vec2 xy=vec2((q.x+0.5)/size.x,(q.y+0.5)/size.y);
    vec3 a=texture(volume,vec3(xy,(q.z+0.5)/size.z)).rgb;
    vec3 b=texture(volume,vec3(xy,(q.z+rows+0.5)/size.z)).rgb;
    vec3 c=texture(volume,vec3(xy,(q.z+2.0*rows+0.5)/size.z)).rgb;
    vec3 d=texture(volume,vec3(xy,(q.z+3.0*rows+0.5)/size.z)).rgb;
    vec3 e=texture(volume,vec3(xy,(q.z+4.0*rows+0.5)/size.z)).rgb;
    vec3 f=texture(volume,vec3(xy,(q.z+5.0*rows+0.5)/size.z)).rgb;
    return ((n.x>0.0?a:b)*n2.x+(n.y>0.0?c:d)*n2.y)+(n.z>0.0?e:f)*n2.z;
  }`,transport:`vec3 livProbeTransport(vec3 p,vec3 n,sampler2D roomMap,sampler3D a,sampler3D b,sampler3D night,
    vec4[${count}] origins,vec4[${count}] steps,vec4[${count}] offsets,vec4 bounds,vec4 grid,vec3 weights,float gain){
    int room=int(texture(roomMap,vec2((p.x-bounds.x)/bounds.z,(p.z-bounds.y)/bounds.w)).r*255.0+0.5);
    vec4 o=origins[room],s=steps[room];
    vec3 q=vec3(clamp((p.x-o.x)/s.x,0.0,o.w-1.0),clamp((p.y-o.y)/s.y,0.0,grid.y-1.0),clamp((p.z-o.z)/s.z,0.0,s.w-1.0)+offsets[room].x);
    vec3 first=livAmbientCube(a,q,n,grid.xyz,grid.w)*weights.x;
    vec3 second=livAmbientCube(b,q,n,grid.xyz,grid.w)*weights.y;
    vec3 third=livAmbientCube(night,q,n,grid.xyz,grid.w)*weights.z;
    return ((first+second)+third)*gain;
  }`};
}
