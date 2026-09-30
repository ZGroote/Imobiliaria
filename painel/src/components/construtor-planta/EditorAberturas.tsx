'use client'
import {useState,type FormEvent} from 'react'
import {aplicar,geometriaParedes,metros,metrosParaMm,parDaAbertura,type Session,type OpeningInput} from './modelo'
import styles from './capturador.module.css'

type Props={session:Session;wallId:string|null;openingId:string|null;
  onSelect:(wallId:string|null,openingId?:string)=>void;onPending:()=>void;onSave:(next:Session,id:string)=>void;
  onDelete:(next:Session)=>void}

export default function EditorAberturas({session:s,wallId,openingId,onSelect,onPending,onSave,onDelete}:Props){
  const opening=s.present.openings.find(o=>o.id===openingId)
  const [kind,setKind]=useState<'door'|'window'>(opening?.kind??'door')
  const [fields,setFields]=useState({offset:opening?metros(opening.offsetMm):'',width:opening?metros(opening.widthMm):'',
    height:opening?metros(opening.heightMm):'',sill:opening?metros(opening.sillMm):''})
  const [error,setError]=useState('')
  const walls=geometriaParedes(s.present.rooms),wall=walls.find(w=>w.id===wallId)
  function input():OpeningInput{
    if(!wall) throw new Error('Selecione uma parede existente no desenho ou na lista.')
    return {kind,wallId:wall.id,offsetMm:metrosParaMm(fields.offset,true),widthMm:metrosParaMm(fields.width),
      heightMm:metrosParaMm(fields.height),sillMm:kind==='door'?0:metrosParaMm(fields.sill,true)}
  }
  let pairMessage='O par interno será determinado pelo trecho ocupado.'
  try{
    const pair=parDaAbertura(s.present.rooms,input())
    pairMessage=pair.error??(pair.id?'Trecho interno · par: '+(walls.find(w=>w.id===pair.id)?.label??pair.id):'Trecho externo · sem par.')
  }catch{/* Campos incompletos ainda não têm trecho para classificar. */}
  function submit(e:FormEvent){
    e.preventDefault()
    try{
      const data=input(),next=aplicar(s,opening?{type:'opening-edit',id:opening.id,...data}:{type:'opening-add',...data})
      onSave(next,opening?.id??'a'+s.nextOpeningId)
    }catch(e){setError((e as Error).message)}
  }
  const field=(label:string,key:keyof typeof fields)=><label>{label}<input required inputMode="decimal" autoComplete="off"
    maxLength={16} value={fields[key]} onChange={e=>{setFields({...fields,[key]:e.target.value});onPending();setError('')}}/></label>
  return <section className={styles.editor} aria-label="Portas e janelas">
    <div className={styles.editorTitle}><h2>{opening?'Editar abertura':'Nova abertura'}</h2>
      <button onClick={()=>onSelect(wallId)}>Nova abertura</button></div>
    <label>Parede selecionada<select value={wallId??''} onChange={e=>onSelect(e.target.value||null)}>
      <option value="">Toque uma parede no desenho</option>
      {walls.map(w=><option key={w.id} value={w.id}>{w.label}</option>)}
    </select></label>
    {wall&&<p className={styles.hint}>Comprimento: {metros(wall.end-wall.start)} m. Posição desde {wall.axis==='x'?'a extremidade esquerda':'a extremidade inferior'}.
      O ponto destacado no desenho marca o início (0 m).</p>}
    <form onSubmit={submit}><fieldset disabled={!wall}>
      <label>Tipo<select value={kind} onChange={e=>{setKind(e.target.value as 'door'|'window');onPending();setError('')}}>
        <option value="door">Porta</option><option value="window">Janela</option>
      </select></label>
      {field('Posição desde o início (m)','offset')}
      <div className={styles.pair}>{field('Largura da abertura (m)','width')}{field('Altura da abertura (m)','height')}</div>
      {kind==='window'?field('Peitoril (m)','sill'):<p className={styles.hint}>Porta: peitoril fixo em 0 m.</p>}
      <p className={styles.hint}>{pairMessage}</p>
      {error&&<p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}><button type="submit" className={styles.primary}>{opening?'Aplicar abertura':'Adicionar abertura'}</button>
        {opening&&<button type="button" onClick={()=>onDelete(aplicar(s,{type:'opening-delete',id:opening.id}))}>Excluir abertura</button>}</div>
    </fieldset></form>
    <h2 className={styles.listTitle}>Aberturas da planta</h2>
    {!s.present.openings.length&&<p className={styles.hint}>Selecione uma parede para começar.</p>}
    <ul className={styles.list}>{s.present.openings.map(o=><li key={o.id}>
      <button aria-pressed={openingId===o.id} onClick={()=>onSelect(o.wallId,o.id)}>
        <span>{o.kind==='door'?'Porta':'Janela'} {o.id} · {walls.find(w=>w.id===o.wallId)?.label??o.wallId}</span>
        <small>{metros(o.widthMm)} m</small>
      </button></li>)}</ul>
  </section>
}
