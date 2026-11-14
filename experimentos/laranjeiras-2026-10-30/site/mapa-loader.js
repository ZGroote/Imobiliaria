/* Embedded by preparar_mapa.py in the preserved map application. */
(function () {
  'use strict';
  const assets = __LIV_MAP_ASSETS__;
  const requested = location.hash.slice(1);
  const edition = Object.hasOwn(assets, requested) ? requested : 'base';
  const spec = assets[edition];
  const status = window.__livMapLoad = {edition, ready:false, verified:false, sourceModelSHA256:spec.sourceModelSHA256};
  window.LivVerifiedMap = {
    load(onLoad, unusedProgress, onError) {
      (async () => {
        const url = new URL(spec.url, document.baseURI);
        const response = await fetch(url);
        if (!response.ok) throw Error('Não foi possível carregar o modelo do LIV.');
        const bytes = await response.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
          .map(value => value.toString(16).padStart(2, '0')).join('');
        if (bytes.byteLength !== spec.bytes || hash !== spec.sha256) throw Error('O modelo do LIV pertence a outra revisão.');
        status.verified = true;
        const gltf = await new Promise((resolve, reject) => {
          new THREE.GLTFLoader().parse(bytes, new URL('.', url).href, resolve, reject);
        });
        gltf.scene.userData.livMapAsset = {
          edition, sourceModelSHA256:spec.sourceModelSHA256, assetSHA256:hash,
          assetBytes:bytes.byteLength, geometryVerified:true, lighting:'map-lights'
        };
        onLoad(gltf);
        status.ready = true;
      })().catch(error => {
        status.error = error.message;
        onError(error);
      });
    }
  };
})();
