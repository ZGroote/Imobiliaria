// M1.1-A: avalia um download preservado; não registra participação nem aceite físico.
// Node 24+: usa os mesmos módulos TypeScript puros do editor.
import {execFile} from 'node:child_process'
import {createHash} from 'node:crypto'
import {lstat,readFile,writeFile,mkdir,mkdtemp,rename,rm,realpath,unlink} from 'node:fs/promises'
import {dirname,join,resolve,basename} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {carregar,documento,exportarMoveis} from '../painel/src/components/construtor-planta/modelo.ts'
import {carregarEditorState} from '../painel/src/components/construtor-planta/editorDocument.ts'

const ROOT=fileURLToPath(new URL('..',import.meta.url))
const LIMIT=1024*1024
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const encode=value=>JSON.stringify(value,null,2)+'\n'
const problem=(code,message,path='')=>({code,path,message})
const fail=(code,message)=>Object.assign(new Error(code+': '+message),{code})
class Recusa extends Error {constructor(errors){super('Download recusado');this.errors=errors}}
const STRICT_JSON=`import json,sys
from pipeline.validar_leitura import _unique_object,_invalid_constant
from pipeline.normalizar_planta import serializar
try:
    value=json.loads(sys.stdin.buffer.read().decode('utf-8'),object_pairs_hook=_unique_object,parse_constant=_invalid_constant)
    output=serializar(value)
except (UnicodeError,ValueError,RecursionError,TypeError):
    print(json.dumps({'errors':[{'code':'INVALID_JSON','path':'','message':'JSON inválido ou ambíguo.'}]}))
    sys.exit(2)
sys.stdout.buffer.write(output)
`

async function semLinks(path){
  for(let current=resolve(path);;current=dirname(current)){
    try{if((await lstat(current)).isSymbolicLink())throw fail('SYMLINK_RECUSADO','Não use links simbólicos na entrada ou saída.')}
    catch(e){if(e.code!=='ENOENT')throw e}
    if(dirname(current)===current)break
  }
}
async function novoDestino(path){
  await semLinks(path)
  try{await lstat(path)}catch(e){if(e.code==='ENOENT')return;throw e}
  throw fail('DESTINO_OCUPADO','O destino deve ser uma pasta que ainda não existe.')
}
async function lerOriginal(path){
  await semLinks(path)
  const stat=await lstat(path)
  if(!stat.isFile())throw fail('ENTRADA_INVALIDA','A entrada precisa ser um arquivo regular.')
  if(stat.size>LIMIT)throw fail('ENTRADA_GRANDE','Use um download de até 1 MiB.')
  const bytes=await readFile(path)
  await semLinks(path)
  if(bytes.length>LIMIT)throw fail('ENTRADA_GRANDE','Use um download de até 1 MiB.')
  return bytes
}
function pythonJson(python,args,input){
  return new Promise((accept,reject)=>{
    const child=execFile(python,args,{cwd:ROOT,timeout:45000,maxBuffer:16*1024*1024,windowsHide:true,
      env:{...process.env,PYTHONUTF8:'1'}},(err,out)=>{
      if(err&&typeof err.code==='string'){reject(fail('PYTHON_INDISPONIVEL','Não foi possível executar o Python informado.'));return}
      let data
      try{data=JSON.parse(out)}catch{reject(fail('PIPELINE_INDISPONIVEL','O pipeline não retornou um relatório JSON.'));return}
      accept({status:err?typeof err.code==='number'?err.code:1:0,data})
    })
    child.stdin.on('error',()=>{});child.stdin.end(input)
  })
}
async function jsonEstrito(python,bytes){
  const result=await pythonJson(python,['-c',STRICT_JSON],bytes)
  if(result.status!==0)throw new Recusa(result.data.errors??[problem('INVALID_JSON','JSON inválido.')])
  return result.data
}
function registrar(report,errors,etapa,andar){
  report.errors.push(...errors.map(e=>({...e,etapa,...(andar!==undefined?{andar}:{})})))
}
function errosDaCadeia(r){
  return ['m1_0','m1_a','consumidor','encaixe','maquete'].flatMap(key=>{
    const step=r[key]
    return step&&typeof step==='object'&&step.ok===false?step.errors??[problem('ETAPA_RECUSADA',`Etapa ${key} recusada.`)]:[]
  })
}
async function limparTrabalho(path,parent){
  if(!path)return
  // A única remoção recursiva é da pasta temporária criada por esta execução.
  if(dirname(path)!==parent||!basename(path).startsWith('.m1-1-captura-'))throw fail('TRABALHO_INVALIDO','Pasta temporária fora do destino esperado.')
  try{
    if((await lstat(path)).isSymbolicLink()){await unlink(path);return}
    if((await realpath(path)).toLowerCase()!==resolve(path).toLowerCase())throw fail('SYMLINK_RECUSADO','O trabalho temporário mudou de localização.')
    await rm(path,{recursive:true,force:true})
  }catch(e){if(e.code!=='ENOENT')throw e}
}

export async function avaliarProjetoCapturado({arquivo,caso,destino,andar,demo=false,contexto,python=process.env.PYTHON??'python'}){
  if(!arquivo||!destino||!/^C[1-5]$/.test(caso??'')||![undefined,0,1].includes(andar)||typeof demo!=='boolean')
    throw fail('ARGUMENTOS_INVALIDOS','Declare arquivo, caso C1..C5, destino novo e pavimento 0 ou 1.')
  if(demo&&contexto)throw fail('MODO_AMBIGUO','Escolha --demo ou --contexto, nunca ambos.')
  destino=resolve(destino);const parent=dirname(destino)
  await novoDestino(destino)
  const original=await lerOriginal(resolve(arquivo)),contextBytes=contexto?await lerOriginal(resolve(contexto)):undefined
  await mkdir(parent,{recursive:true});await novoDestino(destino)
  let trabalho=await mkdtemp(join(parent,'.m1-1-captura-'))
  const report={schema:1,caso,physicalAccepted:false,original:{arquivo:'original.json',bytes:original.length,sha256:sha(original)},
    tipo:'desconhecido',andarSelecionado:andar??null,modo:demo?'demo':contexto?'contexto-real':'avaliacao',validacao:{ok:false,errors:[]},andares:[],errors:[],ok:false}
  try{
    await writeFile(join(trabalho,'original.json'),original,{flag:'wx'})
    if(contextBytes){
      await writeFile(join(trabalho,'contexto-original.json'),contextBytes,{flag:'wx'})
      report.contexto={arquivo:'contexto-original.json',bytes:contextBytes.length,sha256:sha(contextBytes)}
    }
    let loaded
    try{
      const value=await jsonEstrito(python,original)
      const companion=value&&typeof value==='object'&&(Object.hasOwn(value,'floors')||Object.hasOwn(value,'activeFloor'))
      report.tipo=companion?'editorState':'leitura'
      const reading=companion&&Array.isArray(value.floors)?value.floors.find(f=>f?.floor===value.activeFloor)?.leitura:null
      const prepared=await pythonJson(python,['-m','pipeline.preparar_leitura',...(companion?['--envelope']:[])],
        companion?JSON.stringify({leituraJson:JSON.stringify(reading??null),editorStateJson:original.toString('utf8')}):original)
      if(prepared.status!==0)throw new Recusa(prepared.data.errors??[problem('LEITURA_RECUSADA','O contrato normativo recusou o download.')])
      try{loaded=companion?carregarEditorState(prepared.data.editorState,prepared.data.leitura):{activeFloor:0,sessions:{0:carregar(prepared.data.leitura)}}}
      catch(e){throw new Recusa([problem('PROJETO_NAO_REABRIVEL',e.message)])}
      report.validacao={ok:true,errors:[]}
      report.andarSelecionado=andar??loaded.activeFloor
    }catch(e){
      if(!e.errors)throw e
      report.validacao={ok:false,errors:e.errors};registrar(report,e.errors,'entrada')
    }
    if(loaded){
      let contextOk=true
      if(contextBytes){
        try{
          const c=await jsonEstrito(python,contextBytes)
          if(!c||typeof c!=='object'||Array.isArray(c)||typeof c.propertyId!=='string'||!c.propertyId||typeof c.agencyId!=='string'||!c.agencyId)
            throw new Recusa([problem('CONTEXTO_INVALIDO','Declare o imóvel e a agência em um objeto de contexto.')])
          if(c.andar!==report.andarSelecionado)
            throw new Recusa([problem('CONTEXTO_ANDAR_DIVERGENTE','O contexto declarado pertence a outro pavimento.','/andar')])
        }catch(e){if(!e.errors)throw e;contextOk=false;registrar(report,e.errors,'contexto')}
      }
      if(!loaded.sessions[report.andarSelecionado])registrar(report,[problem('ANDAR_INEXISTENTE','O pavimento selecionado não está no download.')],'selecao')
      for(const [key,session] of Object.entries(loaded.sessions)){
        const floor=Number(key),dir=join(trabalho,'andar-'+floor),selected=floor===report.andarSelecionado
        await mkdir(dir)
        const leitura=encode(documento(session)),moveis=exportarMoveis(session)
        await writeFile(join(dir,'leitura.json'),leitura,{flag:'wx'});await writeFile(join(dir,'moveis.json'),moveis,{flag:'wx'})
        const entry={andar:floor,arquivos:{leitura:`andar-${floor}/leitura.json`,moveis:`andar-${floor}/moveis.json`},
          integridade:{leitura:{bytes:Buffer.byteLength(leitura),sha256:sha(leitura)},moveis:{bytes:Buffer.byteLength(moveis),sha256:sha(moveis)}},encaixeReal:'nao-avaliado'}
        report.andares.push(entry)
        const args=['-m','pipeline.avaliar_captura',join(dir,'leitura.json'),'--caso',caso]
        if(selected&&contextBytes&&contextOk)args.push('--contexto',join(trabalho,'contexto-original.json'))
        const assessment=await pythonJson(python,args)
        entry.avaliacao=assessment.data
        await writeFile(join(dir,'avaliacao.json'),encode(assessment.data),{flag:'wx'})
        const errors=errosDaCadeia(assessment.data)
        registrar(report,errors,'avaliacao',floor)
        // O harness retorna zero também em recusa; são os booleans que decidem.
        const gates=assessment.status===0&&['m1_0','m1_a','consumidor'].every(k=>assessment.data[k]?.ok===true)
        if(!gates&&!errors.length)registrar(report,[problem('CADEIA_INCOMPLETA','A avaliação não concluiu os três portões.')],'avaliacao',floor)
        if(selected&&contextBytes){
          entry.encaixeReal=contextOk&&assessment.data.encaixe?.ok===true?'conferido':'recusado'
          if(contextOk&&assessment.data.encaixe?.ok!==true&&!errors.length)
            registrar(report,[problem('CONTEXTO_INVALIDO','O encaixe declarado não foi conferido.')],'contexto',floor)
        }
        if(selected&&(demo||contextBytes)&&gates&&contextOk&&(!contextBytes||assessment.data.encaixe?.ok===true)){
          const args=['-m','pipeline.gerar_maquete',join(dir,'leitura.json'),'--caso',caso,'--destino',join(dir,'maquete'),
            '--moveis',join(dir,'moveis.json'),'--json',...(demo?['--demo']:['--contexto',join(trabalho,'contexto-original.json')])]
          const generation=await pythonJson(python,args)
          entry.geracao={ok:generation.status===0&&generation.data.ok===true,
            ...(generation.data.relatorio?{relatorio:generation.data.relatorio}:{}),...(generation.data.errors?{errors:generation.data.errors}:{})}
          if(entry.geracao.ok){
            entry.geracao.andarNoArtefato=demo?0:floor
            if(demo)entry.geracao.rotulo=`Prédio ilustrativo, pavimento demonstrativo 0 com arquitetura extraída do piso ${floor}.`
          }
          if(!entry.geracao.ok)registrar(report,generation.data.errors??[problem('GERACAO_RECUSADA','A maquete não foi gerada.')],'geracao',floor)
        }
      }
    }
    report.ok=report.validacao.ok&&report.errors.length===0
    await writeFile(join(trabalho,'relatorio.json'),encode(report),{flag:'wx'})
    await novoDestino(destino)
    await rename(trabalho,destino);trabalho=null
    return report
  }finally{await limparTrabalho(trabalho,parent)}
}

function argumentos(argv){
  const [arquivo,...rest]=argv,result={arquivo},seen=new Set()
  for(let i=0;i<rest.length;i++){
    const option=rest[i]
    if(!['--caso','--destino','--andar','--demo','--contexto','--python'].includes(option)||seen.has(option))
      throw fail('ARGUMENTOS_INVALIDOS','Argumento desconhecido ou repetido: '+option)
    seen.add(option)
    if(option==='--demo'){result.demo=true;continue}
    const value=rest[++i]
    if(!value||value.startsWith('--'))throw fail('ARGUMENTOS_INVALIDOS','Valor ausente: '+option)
    if(option==='--andar'&&!['0','1'].includes(value))throw fail('ARGUMENTOS_INVALIDOS','--andar deve ser 0 ou 1.')
    result[option.slice(2)]=option==='--andar'?Number(value):value
  }
  return result
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const report=await avaliarProjetoCapturado(argumentos(process.argv.slice(2)))
    process.stdout.write(encode(report));process.exitCode=report.ok?0:2
  }catch(e){
    process.stderr.write(encode({ok:false,physicalAccepted:false,errors:[problem(e.code??'FALHA_OPERACIONAL',e.message)]}))
    process.exitCode=1
  }
}
