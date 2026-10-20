import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const path=new URL('../casa-vistalar-web.glb',import.meta.url).pathname.replace(/^\/(\w:)/,'$1');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(path);
for(const node of doc.getRoot().listNodes())if(node.getName().includes('Suite bathroom toilet')){const p=node.getTranslation();if(p[0]>-2.3){p[0]= -2.72;node.setTranslation(p);}console.log(node.getName(),node.getTranslation());}
await io.write(path,doc);
