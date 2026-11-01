import {WebGLRenderer,WebGLRenderTarget,ShaderMaterial,Scene,Mesh,PlaneGeometry,OrthographicCamera,Data3DTexture,Vector3,HalfFloatType,RGBAFormat,LinearSRGBColorSpace,SRGBColorSpace,NoToneMapping,NoBlending} from 'three/webgl';
export function createClassicInteriorRenderer(options){
 const renderer=new WebGLRenderer({...options,antialias:false});renderer.isClassicInteriorRenderer=true;
 const gl=renderer.getContext();
 if(!renderer.extensions.has('EXT_color_buffer_float')&&!renderer.extensions.has('EXT_color_buffer_half_float')){
  renderer.dispose();renderer.forceContextLoss();throw Error('Este contexto WebGL2 não suporta o alvo HDR do interior.');
 }
 const samples=options.antialias?Math.max(0,...Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]).filter(value=>value<=4)):0;
 renderer.interiorCapabilities={colorBuffer:'RGBA16F',samples,maxTextureUnits:renderer.capabilities.maxTextures};
 renderer.backend={isWebGPUBackend:false,isWebGLBackend:true,gl};
 renderer.localClippingEnabled=true;renderer.info.autoReset=false;renderer.toneMapping=NoToneMapping;renderer.outputColorSpace=SRGBColorSpace;
 const target=new WebGLRenderTarget(1,1,{type:HalfFloatType,format:RGBAFormat,samples,depthBuffer:true,stencilBuffer:false});target.texture.colorSpace=LinearSRGBColorSpace;
 const placeholder=new Data3DTexture(new Uint16Array(4),1,1,1);placeholder.type=HalfFloatType;placeholder.needsUpdate=true;
 const uniforms={tColor:{value:target.texture},livLook:{value:placeholder},livLookInfo:{value:new Vector3(-10,20,2)},livUseLook:{value:0},toneMappingExposure:{value:1}};
 const material=new ShaderMaterial({uniforms,depthTest:false,depthWrite:false,blending:NoBlending,toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
  fragmentShader:`precision highp sampler3D;varying vec2 vUv;uniform sampler2D tColor;uniform sampler3D livLook;uniform vec3 livLookInfo;uniform float livUseLook;
   #include <tonemapping_pars_fragment>
   void main(){vec4 color=texture2D(tColor,vUv);vec3 linear=color.rgb;
    if(livUseLook>0.5){vec3 p=clamp((log2(max(linear*toneMappingExposure,vec3(exp2(livLookInfo.x))))-livLookInfo.x)/livLookInfo.y,0.0,1.0);linear=texture(livLook,p*((livLookInfo.z-1.0)/livLookInfo.z)+0.5/livLookInfo.z).rgb;}
    else linear=AgXToneMapping(linear);
    gl_FragColor=vec4(linear,color.a);
    #include <colorspace_fragment>
   }`});
 const quad=new Mesh(new PlaneGeometry(2,2),material),output=new Scene(),camera=new OrthographicCamera(-1,1,1,-1,0,1);output.add(quad);
 const adapted=new WeakSet();
 const prepare=scene=>scene.traverse(mesh=>{if(!mesh.isMesh||adapted.has(mesh))return;adapted.add(mesh);const before=mesh.onBeforeRender;
  mesh.onBeforeRender=function(r,s,c,g,m,...rest){before.call(this,r,s,c,g,m,...rest);let group=this.parent,planes=null;while(group){if(group.isClippingGroup&&group.enabled)planes=group.clippingPlanes;group=group.parent;}m.clippingPlanes=planes;m.clipShadows=false;};
 });
 const size=renderer.setSize.bind(renderer);renderer.setSize=(w,h,style)=>{size(w,h,style);target.setSize(renderer.domElement.width,renderer.domElement.height);};
 const compile=renderer.compileAsync.bind(renderer),render=renderer.render.bind(renderer);
 renderer.compileAsync=async(scene,cam,targetScene,progress)=>{prepare(scene);const previous=renderer.getRenderTarget();renderer.setRenderTarget(target);try{await compile(scene,cam,targetScene);renderer.setRenderTarget(null);await compile(output,camera);progress?.({loaded:1,total:1});}finally{renderer.setRenderTarget(previous);}};
 renderer.renderAsync=async(scene,cam)=>{prepare(scene);const previous=renderer.getRenderTarget();renderer.info.reset();renderer.setRenderTarget(target);render(scene,cam);renderer.setRenderTarget(null);uniforms.toneMappingExposure.value=renderer.toneMappingExposure;render(output,camera);renderer.setRenderTarget(previous);};
 renderer.init=async()=>renderer;
 renderer.installInteriorLook=({texture,lo,span,size})=>{uniforms.livLook.value=texture;uniforms.livLookInfo.value.set(lo,span,size);uniforms.livUseLook.value=1;};
 const lost=event=>{event.preventDefault();renderer.onDeviceLost?.({message:'Contexto WebGL2 perdido.',reason:'unknown'});};renderer.domElement.addEventListener('webglcontextlost',lost);
 renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{renderer.lastShaderError={program:gl.getProgramInfoLog(program),vertex:gl.getShaderInfoLog(vertex),fragment:gl.getShaderInfoLog(fragment)};renderer.onError?.(Error('Falha ao compilar o material WebGL.')); };
 const dispose=renderer.dispose.bind(renderer);let disposed=false;
 renderer.dispose=()=>{if(disposed)return;disposed=true;renderer.domElement.removeEventListener('webglcontextlost',lost);target.dispose();quad.geometry.dispose();material.dispose();placeholder.dispose();dispose();renderer.forceContextLoss();};
 return renderer;
}
