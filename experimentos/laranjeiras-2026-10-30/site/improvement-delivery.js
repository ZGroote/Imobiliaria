// Seleção compartilhada pelo runtime e pelo empacotador. Nenhuma alteração visual.
export function matchesImprovementAsset(asset,item,typology){
  return asset.types.includes(item.tipo)&&(!asset.typology||asset.typology===typology)&&
    (!asset.namePattern||new RegExp(asset.namePattern,'i').test(item.name||item.nome||''));
}
export function selectImprovementAssets(catalog,{items=null,typology='canto',includeDecorations=true}={}){
  if(!items)return catalog.assets;
  const required=new Set([...(catalog.materialOverrides||[]).map(o=>o.assetId),
    ...(includeDecorations?catalog.decorations||[]:[]).filter(o=>!o.typology||o.typology===typology).map(o=>o.assetId)]);
  return catalog.assets.filter(asset=>required.has(asset.id)||items.some(item=>matchesImprovementAsset(asset,item,typology)));
}

const digest=/^[a-f0-9]{64}$/;
export const imageURI=hash=>`texturas/${hash}`;
export function selectPreparedDelivery(catalog,assets,typology){
  const delivery=catalog.delivery,entry=delivery?.typologies?.[typology];
  if(delivery?.schema!=='liv-improvement-delivery-v1'||!entry||!Array.isArray(entry.assetIds)||!Array.isArray(entry.packs))return null;
  if(!assets.every(asset=>entry.assetIds.includes(asset.id)&&delivery.models?.[asset.id]?.sourceSHA256===asset.sha256))return null;
  return {models:delivery.models,packs:entry.packs};
}

// O SHA do arquivo completo é verificado pelo carregador antes de chegar aqui.
// As imagens continuam PNG/JPEG/WebP originais, sem recompressão ou mudança de cor.
export function decodeImagePack(bytes){
  const raw=bytes instanceof ArrayBuffer?new Uint8Array(bytes):new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength),view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  if(raw.length<12||new TextDecoder().decode(raw.subarray(0,8))!=='LIVIMG01')throw Error('Pacote de imagens inválido.');
  const length=view.getUint32(8,true),base=Math.ceil((12+length)/4)*4;
  if(length>raw.length-12||base>raw.length)throw Error('Cabeçalho das imagens incompleto.');
  const header=JSON.parse(new TextDecoder().decode(raw.subarray(12,12+length)));
  if(header.schema!=='liv-image-pack-v1'||!Array.isArray(header.images))throw Error('Índice das imagens inválido.');
  const images=new Map();let end=0;
  for(const image of header.images){
    if(!digest.test(image.sha256)||images.has(image.sha256)||!['image/png','image/jpeg','image/webp'].includes(image.mimeType)||
      !Number.isSafeInteger(image.offset)||!Number.isSafeInteger(image.bytes)||image.offset<end||image.bytes<=0||image.bytes>raw.length-base-image.offset)throw Error('Imagem fora do pacote.');
    images.set(image.sha256,{...image,data:raw.subarray(base+image.offset,base+image.offset+image.bytes)});end=image.offset+image.bytes;
  }
  return images;
}

export function createPackedImageLoader({delivery,resource,signal,onBitmap,createBitmap=globalThis.createImageBitmap}){
  const packJobs=new Map(),bitmapJobs=new Map(),locations=new Map();let released=false;
  const check=()=>{if(released||signal?.aborted)throw new DOMException('Carregamento das imagens cancelado.','AbortError');};
  for(const pack of delivery.packs){
    if(!Array.isArray(pack.images))throw Error('Lista de imagens ausente.');
    for(const image of pack.images){
      if(!digest.test(image.sha256)||locations.has(image.sha256))throw Error('Identidade de imagem inválida.');
      locations.set(image.sha256,{pack,image});
    }
  }
  const loadPack=pack=>{
    if(!packJobs.has(pack.path))packJobs.set(pack.path,(async()=>{
      const {bytes}=await resource(pack,'bin.gz');check();
      const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();check();
      if(raw.byteLength!==pack.decodedBytes)throw Error('Pacote de imagens incompleto.');
      const images=decodeImagePack(raw);
      if(images.size!==pack.images.length)throw Error('Índice das imagens divergente.');
      for(const expected of pack.images){const actual=images.get(expected.sha256);
        if(!actual||actual.bytes!==expected.bytes||actual.mimeType!==expected.mimeType)throw Error('Imagem de outra revisão.');}
      return images;
    })());
    return packJobs.get(pack.path);
  };
  const bitmap=expected=>{
    check();const hash=expected.sha256,location=locations.get(hash);
    if(!location||location.image.bytes!==expected.bytes||location.image.mimeType!==expected.mimeType)throw Error('Imagem não prevista para esta planta.');
    if(!bitmapJobs.has(hash))bitmapJobs.set(hash,(async()=>{
      const image=(await loadPack(location.pack)).get(hash);check();
      const result=await createBitmap(new Blob([image.data],{type:image.mimeType}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
      onBitmap(result);check();return result;
    })());
    return bitmapJobs.get(hash);
  };
  return {
    handler:{isImageBitmapLoader:true,load(url,onLoad,_progress,onError){
      const hash=String(url).match(/\/texturas\/([a-f0-9]{64})$/)?.[1],entry=locations.get(hash);
      Promise.resolve().then(()=>{if(!entry)throw Error('URL de imagem não autorizada.');return bitmap(entry.image);}).then(onLoad,onError);
    }},
    async prepare(images){await Promise.all(images.map(bitmap));check();},
    // Os templates conservam os ImageBitmaps; os buffers PNG e as promessas saem da memória.
    release(){released=true;packJobs.clear();bitmapJobs.clear();locations.clear();},
  };
}
