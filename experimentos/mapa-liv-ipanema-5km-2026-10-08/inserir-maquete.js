/* Attach the existing complete LIV model to the existing map scene. */
(function () {
  var attempts=0;
  function start() {
    var I=window.__int, map=window.__livMapa;
    if(!I || !I.livTerrain || !map) {
      if(++attempts<300) setTimeout(start,100);
      return;
    }
    var anchor=[map.centro[0]+8,map.centro[1]-6];
    // Superfícies do mapa têm offsets até .32m; a base estende-se .95m
    // abaixo do piso, permitindo este assentamento sem lacuna no terreno.
    var clearance=0.4;
    var label=document.getElementById('livLocalizacao');
    if(label) label.textContent='Liv Ipanema · carregando maquete';
    window.__livModelReady=new Promise(function(resolve,reject){
      new THREE.GLTFLoader().load('liv-ipanema.glb',function(gltf){
        try {
          var model=LivMapModel.create({THREE:THREE,loadedScene:gltf.scene,scene:I.scene,
            center:anchor,rotation:-Math.PI/3,terrainY:I.livTerrain.sample(anchor[0],anchor[1])*I.livTerrain.amount()+clearance});
          window.__livModel=model;
          I.livTerrain.invalidate();
          model.metadata.positionApproximate=true;
          model.metadata.placementOffsetMeters=[8,-6];
          model.metadata.floorClearanceMeters=clearance;
          // O pino provisório deve sair quando a geometria real chegar.
          map.marker.children.forEach(function(child){if(child.isMesh)child.visible=false;});
          if(label)label.textContent='Liv Ipanema';
          function focus(){
            I.target.set(anchor[0],0,anchor[1]);
            I.sph.radius=290;I.sph.phi=1.05;I.sph.theta=-0.40;
          }
          var focusButton=document.getElementById('livFocar');
          if(focusButton)focusButton.addEventListener('click',focus);
          function frame(){
            var moved=model.updateY(I.livTerrain.sample(anchor[0],anchor[1])*I.livTerrain.amount()+clearance);
            var visible=!(I.INT && I.INT.on) && I.target.distanceToSquared(model.object.position)<16000000;
            if(moved||visible!==model.object.visible)I.livTerrain.invalidate();
            model.object.visible=visible;
            requestAnimationFrame(frame);
          }
          frame();map.focusModel=focus;resolve(model.metadata);
        }catch(error){reject(error);}
      },undefined,reject);
    });
    window.__livModelReady.catch(function(error){
      if(label)label.textContent='Liv Ipanema · falha ao carregar maquete';
      console.error(error);
    });
  }
  start();
})();
