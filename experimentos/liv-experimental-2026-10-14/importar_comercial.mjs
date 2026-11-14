import {readFileSync,writeFileSync,copyFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {exteriorEdition} from './edicoes.js';
import {expandBuildingCatalog} from './catalogo-unidades.js';
import {validateCommercial} from './comercial.js';
const directory=dirname(fileURLToPath(import.meta.url));
export function importCommercial(input,output,edition='entrada'){
  const source=resolve(input),destination=resolve(output);
  if(source===destination)throw Error('Entrada e destino devem ser arquivos diferentes.');
  const bytes=readFileSync(source);if(bytes.length>1048576)throw Error('Tabela comercial excede 1 MiB.');
  const pilot=JSON.parse(readFileSync(join(directory,exteriorEdition(edition).units),'utf8'));
  const verified=validateCommercial(JSON.parse(bytes.toString('utf8')),expandBuildingCatalog(pilot));
  if(verified.status!=='fornecido')throw Error('O arquivo não contém uma tabela fornecida; nenhuma oferta foi alterada.');
  const packed=JSON.stringify(verified,null,2)+'\n';
  if(existsSync(destination)&&readFileSync(destination,'utf8')===packed)return {changed:false,units:verified.units.length};
  const temporary=join(dirname(destination),`.${basename(destination)}.liv-${process.pid}.tmp`);
  writeFileSync(temporary,packed,{flag:'wx',mode:0o600});
  try{
    if(existsSync(destination))copyFileSync(destination,destination+'.previous');
    renameSync(temporary,destination);
  }catch(error){if(existsSync(temporary))unlinkSync(temporary);throw error;}
  return {changed:true,units:verified.units.length,source:verified.source,previous:existsSync(destination+'.previous')?destination+'.previous':null};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const options={};
    for(let i=2;i<process.argv.length;i+=2){
      const key=process.argv[i],value=process.argv[i+1];
      if(!['--entrada','--saida','--geometria','--modelo'].includes(key)||!value||Object.hasOwn(options,key))throw Error('Use --entrada tabela.json --saida comercial.json [--geometria entrada], ou --modelo arquivo.json.');
      options[key]=value;
    }
    if(options['--modelo']){
      if(options['--entrada']||options['--saida'])throw Error('--modelo não pode ser combinado com importação.');
      const pilot=JSON.parse(readFileSync(join(directory,exteriorEdition(options['--geometria']||'entrada').units),'utf8'));
      const catalog=expandBuildingCatalog(pilot),template={schema:'liv-commercial-v1',status:'fornecido',bookSHA256:pilot.source.bookSHA256,
        source:{label:null,asOf:null},units:catalog.units.map(unit=>({id:unit.id,commercialNumber:null,availability:'nao_informada',priceCents:null,parking:null,conditions:null}))};
      writeFileSync(resolve(options['--modelo']),JSON.stringify(template,null,2)+'\n',{flag:'wx'});
      console.log(JSON.stringify({template:true,units:170,needsSourceAndDate:true}));
    }else{
      if(!options['--entrada']||!options['--saida'])throw Error('Informe --entrada e --saida.');
      console.log(JSON.stringify(importCommercial(options['--entrada'],options['--saida'],options['--geometria']||'entrada')));
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
