'use client'
import {useEffect,useState,type FormEvent} from 'react'
import {distanciaSugerida,metros,metrosParaMm,type Opening,type OpeningInput,type Wall} from './modelo'
import styles from './capturador.module.css'

// Sugestão editável: o campo seleciona o texto ao receber foco. Manter o padrão em vez da
// medida real é risco de fidelidade a observar nas sessões (M1.1-A).
const PADRAO={door:{width:800,height:2100,sill:0},window:{width:1200,height:1000,sill:1100}}
type Props={wall:Wall;kind:'door'|'window';inicial?:Opening;t?:number;
  verificar:(o:OpeningInput)=>{mensagens:string[];trecho:string};
  onRascunho:(o:OpeningInput|null)=>void;onConfirmar:(o:OpeningInput)=>void;onExcluir?:()=>void;onCancelar:()=>void}
const mm=(t:string,zero=false)=>{try{return metrosParaMm(t,zero)}catch{return null}}
const seleciona=(e:{currentTarget:HTMLInputElement})=>e.currentTarget.select()
const medidas=(k:'door'|'window',o?:Opening)=>({width:metros(o?.widthMm??PADRAO[k].width),
  height:metros(o?.heightMm??PADRAO[k].height),sill:metros(o?.sillMm??PADRAO[k].sill)})

export default function FormAbertura({wall,kind:inicioKind,inicial,t,verificar,onRascunho,onConfirmar,onExcluir,onCancelar}:Props){
  const [kind,setKind]=useState(inicial?.kind??inicioKind)
  const [f,setF]=useState(()=>({...medidas(kind,inicial),
    offset:metros(inicial?.offsetMm??distanciaSugerida(wall,t??0,PADRAO[kind].width))}))
  const [erro,setErro]=useState('')
  const w=mm(f.width),h=mm(f.height),s=kind==='door'?0:mm(f.sill,true),off=mm(f.offset,true)
  const o:OpeningInput|null=w!==null&&h!==null&&s!==null&&off!==null
    ?{kind,wallId:wall.id,offsetMm:off,widthMm:w,heightMm:h,sillMm:s}:null
  const chave=o?JSON.stringify(o):''
  // A abertura anda na parede enquanto as medidas são digitadas.
  useEffect(()=>{onRascunho(o)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[chave])
  const v=o?verificar(o):null
  function trocar(k:'door'|'window'){
    if(k===kind) return
    setKind(k);setErro('')
    if(!inicial) setF(x=>({...x,...medidas(k)}))     // nova: muda para o padrão do outro tipo
  }
  function confirmar(e:FormEvent){
    e.preventDefault()
    try{
      if(!o) throw new Error('Use metros com até três casas decimais, como 0,80.')
      onConfirmar(o)
    }catch(e){setErro((e as Error).message)}
  }
  const campo=(rotulo:string,chave:'width'|'height'|'sill'|'offset')=><label>{rotulo}
    <input value={f[chave]} onChange={e=>{setF({...f,[chave]:e.target.value});setErro('')}} onFocus={seleciona}
      inputMode="decimal" required maxLength={16} autoComplete="off" enterKeyHint="done"/></label>
  return <form className={styles.form} onSubmit={confirmar}>
    <div className={styles.tipos} role="group" aria-label="Tipo de abertura">
      <button type="button" aria-pressed={kind==='door'} onClick={()=>trocar('door')}>Porta</button>
      <button type="button" aria-pressed={kind==='window'} onClick={()=>trocar('window')}>Janela</button>
    </div>
    <div className={styles.par}>{campo('Largura (m)','width')}{campo('Altura (m)','height')}</div>
    <div className={styles.par}>
      {campo('Distância do canto ● (m)','offset')}
      {kind==='window'?campo('Peitoril (m)','sill'):<p className={styles.dica}>Porta: peitoril 0.</p>}
    </div>
    <p className={styles.dica}>{wall.label} · parede de {metros(wall.end-wall.start)} m.
      O ● marca o canto de onde a distância é medida.{v?.trecho?' '+v.trecho+'.':''}</p>
    {v&&v.mensagens.length>0&&<ul className={styles.alerta} aria-live="polite">{v.mensagens.map((m,i)=><li key={i}>{m}</li>)}</ul>}
    {erro&&<p role="alert" className={styles.erro}>{erro}</p>}
    <div className={styles.acoes}>
      <button type="submit" className={styles.primario}>{inicial?'Aplicar':'Adicionar'}</button>
      {onExcluir&&<button type="button" onClick={onExcluir}>Excluir</button>}
      <button type="button" onClick={onCancelar}>Cancelar</button>
    </div>
  </form>
}
