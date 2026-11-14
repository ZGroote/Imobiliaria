import * as THREE from 'three/webgpu';

// Vagas do apartamento escolhido piscando no amarelo do destaque do final.
// As posições vêm de vagas.json, gerado junto com o modelo (modelo/entrada/vagas_oficiais.py).
export function validarVagas(data){
  if(data?.schema!=='liv-parking-v1'||!Array.isArray(data.vagas))throw Error('Mapa de vagas inválido.');
  const byNumber=new Map();
  for(const v of data.vagas){
    if(!Number.isInteger(v.numero)||v.numero<1||![v.x,v.z,v.largura,v.comprimento].every(Number.isFinite)||!['x','z'].includes(v.sentido)||byNumber.has(v.numero))
      throw Error('Mapa de vagas inválido.');
    byNumber.set(v.numero,v);
  }
  return byNumber;
}

export function createParkingHighlight(scene,data){
  const byNumber=validarVagas(data);
  const fill=new THREE.MeshBasicMaterial({color:0xffd400,toneMapped:false,transparent:true,opacity:.85,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  const line=new THREE.LineBasicMaterial({color:0xffffff,toneMapped:false,transparent:true});
  // Volume de 1,8 m sobre a vaga: aparece acima de um carro estacionado e também vendo de lado.
  const ALTURA=1.8,box=new THREE.BoxGeometry(1,1,1).translate(0,.5,0),edges=new THREE.EdgesGeometry(box);
  const group=new THREE.Group();group.name='Vagas do apartamento selecionado';group.userData.livPresentation=true;group.visible=false;
  scene.add(group);
  // Pulso de 1,2 s; o laço de desenho da maquete já roda todo quadro enquanto ela está ativa.
  const pulse=()=>{const k=.5+.5*Math.sin(performance.now()/1200*Math.PI*2);fill.opacity=.55+.4*k;line.opacity=.6+.4*k;};
  let shown='';
  return {
    group,
    setSpaces(numbers){
      const list=[...new Set(numbers??[])].filter(n=>byNumber.has(n)).sort((a,b)=>a-b),key=list.join();
      if(key===shown)return list;
      shown=key;group.clear();
      for(const n of list){
        const v=byNumber.get(n),w=v.sentido==='z'?v.largura:v.comprimento,d=v.sentido==='z'?v.comprimento:v.largura;
        const mesh=new THREE.Mesh(box,fill),outline=new THREE.LineSegments(edges,line);
        for(const o of [mesh,outline]){o.position.set(v.x,.21,v.z);o.scale.set(w,ALTURA,d);o.renderOrder=2;}
        mesh.onBeforeRender=pulse;mesh.name=`Vaga ${n}`;group.add(mesh,outline);
      }
      group.visible=list.length>0;
      return list;
    },
    getState(){return {spaces:shown?shown.split(',').map(Number):[],total:byNumber.size};},
    dispose(){scene.remove(group);group.clear();box.dispose();edges.dispose();fill.dispose();line.dispose();},
  };
}
