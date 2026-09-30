'use client'
import {useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent} from 'react'
import {aplicar, desfazer, refazer, iniciar, metros, metrosParaMm, problemas, exportar, snap, type Session, type Room} from './modelo'
import styles from './capturador.module.css'

type Fields = {name:string; width:string; depth:string; height:string}
const blank:Fields={name:'',width:'',depth:'',height:''}
type Drag = {id:string; pointerId:number; start:{x:number;y:number}; clientX:number; clientY:number;
  room:Room; moved:boolean; position:{xMm:number;yMm:number}}

export default function Capturador(){
  const [session,setSession]=useState<Session|null>(null)
  const [selected,setSelected]=useState<string|null>(null)
  const [fields,setFields]=useState<Fields>(blank)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [preview,setPreview]=useState<{id:string;xMm:number;yMm:number}|null>(null)
  const svg=useRef<SVGSVGElement>(null)
  const drag=useRef<Drag|null>(null)
  useEffect(()=>{setSession(iniciar('leitura-'+crypto.randomUUID()))},[])
  if(!session) return <p className="p-6">Preparando a planta local…</p>

  const s=session
  const rooms=s.present.rooms
  const shown=rooms.map(r=>preview?.id===r.id?{...r,...preview}:r)
  const issues=problemas({...s.present,rooms:shown})
  const invalidIds=new Set(issues.flatMap(e=>e.ids))
  const chosen=rooms.find(r=>r.id===selected)
  let draftPending=!!(fields.name||fields.width||fields.depth)
  if(chosen){
    try{
      draftPending=fields.name.trim()!==chosen.name||metrosParaMm(fields.width)!==chosen.widthMm
        ||metrosParaMm(fields.depth)!==chosen.depthMm||metrosParaMm(fields.height)!==s.present.ceilingHeightMm
    }catch{draftPending=true}
  }else if(s.present.ceilingHeightMm!==null){
    try{draftPending ||= metrosParaMm(fields.height)!==s.present.ceilingHeightMm}catch{draftPending=true}
  }
  const json=problemas(s.present).length||draftPending?'':exportar(s)
  // Enquadramento segue o estado confirmado; fica estável durante todo o gesto.
  const minX=Math.min(0,...rooms.map(r=>r.xMm))-1000
  const maxX=Math.max(6000,...rooms.map(r=>r.xMm+r.widthMm))+1000
  const minY=Math.min(0,...rooms.map(r=>r.yMm))-1000
  const maxY=Math.max(5000,...rooms.map(r=>r.yMm+r.depthMm))+1000

  function newRoom(next=s){
    setSelected(null);setFields({...blank,height:next.present.ceilingHeightMm?metros(next.present.ceilingHeightMm):''})
    setError('')
  }
  function select(room:Room){
    setSelected(room.id);setFields({name:room.name,width:metros(room.widthMm),depth:metros(room.depthMm),
      height:s.present.ceilingHeightMm?metros(s.present.ceilingHeightMm):''});setError('')
  }
  function submit(e:FormEvent){
    e.preventDefault()
    try{
      const measures={name:fields.name,widthMm:metrosParaMm(fields.width),depthMm:metrosParaMm(fields.depth),
        ceilingHeightMm:metrosParaMm(fields.height)}
      const next=aplicar(s,selected?{type:'edit',id:selected,...measures}:{type:'add',...measures})
      setSession(next);setSelected(selected??'c'+s.nextId);setError('')
      setNotice(selected?'Medidas aplicadas.':'Cômodo adicionado. Arraste para encaixar.')
    }catch(e){setError((e as Error).message)}
  }
  function history(redo=false){
    const next=redo?refazer(s):desfazer(s)
    setSession(next);newRoom(next);setNotice(redo?'Ação refeita.':'Ação desfeita.')
  }
  function remove(){
    if(!selected) return
    const next=aplicar(s,{type:'delete',id:selected});setSession(next);newRoom(next)
    setNotice('Cômodo excluído. Você pode desfazer.')
  }
  function point(e:ReactPointerEvent){
    const matrix=svg.current?.getScreenCTM()
    if(!matrix) return null
    const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse())
    return {x:p.x,y:-p.y,scale:Math.abs(matrix.a)}
  }
  function start(e:ReactPointerEvent<SVGGElement>,room:Room){
    if(drag.current || e.button!==0) return
    const p=point(e);if(!p) return
    e.preventDefault();select(room)
    drag.current={id:room.id,pointerId:e.pointerId,start:p,clientX:e.clientX,clientY:e.clientY,
      room,moved:false,position:{xMm:room.xMm,yMm:room.yMm}}
    svg.current?.setPointerCapture(e.pointerId)
    setPreview({id:room.id,xMm:room.xMm,yMm:room.yMm})
  }
  function moving(e:ReactPointerEvent<SVGSVGElement>){
    const d=drag.current
    if(!d||d.pointerId!==e.pointerId) return
    const p=point(e);if(!p) return
    if(Math.hypot(e.clientX-d.clientX,e.clientY-d.clientY)<3&&!d.moved) return
    d.moved=true
    // Quantização de posição do gesto; medidas digitadas nunca usam float/round.
    d.position=snap(rooms,d.id,d.room.xMm+Math.round(p.x-d.start.x),
      d.room.yMm+Math.round(p.y-d.start.y),12/p.scale)
    setPreview({id:d.id,...d.position})
  }
  function finish(e:ReactPointerEvent<SVGSVGElement>,cancel=false){
    const d=drag.current
    if(!d||d.pointerId!==e.pointerId) return
    drag.current=null;setPreview(null)
    if(!cancel&&d.moved){
      setSession(aplicar(s,{type:'move',id:d.id,...d.position}))
      setNotice('Posição aplicada. Desfazer reverte o arraste inteiro.')
    }
    if(svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId)
  }
  function step(room:Room,dx:number,dy:number){
    if(drag.current) return
    const p=snap(rooms,room.id,room.xMm+dx,room.yMm+dy,0)
    setSession(aplicar(s,{type:'move',id:room.id,...p}));setNotice('Posição alterada em 10 cm.')
  }
  function download(){
    if(!json||preview) return
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download='leitura.json';a.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Download de leitura.json iniciado.')
  }
  const input=(label:string,key:keyof Fields,placeholder:string)=>(
    <label>{label}<input value={fields[key]} onChange={e=>setFields({...fields,[key]:e.target.value})}
      inputMode={key==='name'?'text':'decimal'} placeholder={placeholder} required
      maxLength={key==='name'?100:16} autoComplete="off" /></label>
  )
  return <main className={styles.page}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>CAPTURA LOCAL · CÔMODOS</p><h1>Desenhe sua planta</h1></div>
      <p>Somente nesta aba. Baixe o arquivo antes de sair; recarregar apaga o trabalho.</p>
    </header>
    <p className={styles.rule}>Informe medidas <strong>entre eixos das paredes</strong>. O pé-direito é único para toda a planta.</p>
    <div className={styles.workspace}>
      <section className={styles.drawing} aria-label="Área de desenho">
        <div className={styles.toolbar}>
          <strong>{rooms.length} {rooms.length===1?'cômodo':'cômodos'}</strong>
          <button disabled={!s.past.length||!!preview} onClick={()=>history()}>Desfazer</button>
          <button disabled={!s.future.length||!!preview} onClick={()=>history(true)}>Refazer</button>
        </div>
        <svg ref={svg} className={styles.canvas} viewBox={`${minX} ${-maxY} ${maxX-minX} ${maxY-minY}`}
          aria-label="Planta em escala; selecione e arraste os cômodos"
          onPointerMove={moving} onPointerUp={e=>finish(e)}
          onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)}>
          <defs><pattern id="grade-planta" width="1000" height="1000" patternUnits="userSpaceOnUse">
            <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#dbe2e8" strokeWidth="12"/>
          </pattern></defs>
          <rect x={minX} y={-maxY} width={maxX-minX} height={maxY-minY} fill="url(#grade-planta)"/>
          {shown.map(room=><g key={room.id} role="button" tabIndex={0}
            aria-label={'Mover '+room.name} aria-pressed={selected===room.id}
            onPointerDown={e=>start(e,room)} onFocus={()=>{if(!drag.current) select(room)}}
            onKeyDown={e=>{
              const delta:Record<string,[number,number]>={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,100],ArrowDown:[0,-100]}
              if(delta[e.key]){e.preventDefault();step(room,...delta[e.key])}
              if(e.key==='Enter'||e.key===' '){e.preventDefault();select(room)}
            }}>
            <rect x={room.xMm} y={-room.yMm-room.depthMm} width={room.widthMm} height={room.depthMm}
              fill={invalidIds.has(room.id)?'#fff1f2':selected===room.id?'#d5eee9':'#edf3f7'}
              stroke={invalidIds.has(room.id)?'#be123c':selected===room.id?'#0f766e':'#64748b'}
              strokeWidth={selected===room.id?4:2} vectorEffect="non-scaling-stroke"/>
            <text x={room.xMm+room.widthMm/2} y={-room.yMm-room.depthMm/2} textAnchor="middle"
              fontSize={Math.min(280,room.widthMm/Math.max(room.name.length,12))} fill="#0f172a" pointerEvents="none">
              {room.name.slice(0,24)}
              <tspan x={room.xMm+room.widthMm/2} dy="1.5em" fontSize="0.85em">{metros(room.widthMm)} × {metros(room.depthMm)} m</tspan>
            </text>
          </g>)}
        </svg>
        <p className={styles.hint}>Grade de 1 m. Arraste pelo interior do cômodo; paredes próximas encaixam. Role a página fora do desenho.</p>
        {chosen&&<div className={styles.position}>
          <span>{chosen.name} · x {metros(chosen.xMm)} m · y {metros(chosen.yMm)} m</span>
          <div aria-label="Mover em passos de 10 cm">
            <button disabled={!!preview} aria-label="Mover à esquerda 10 cm" onClick={()=>step(chosen,-100,0)}>←</button>
            <button disabled={!!preview} aria-label="Mover acima 10 cm" onClick={()=>step(chosen,0,100)}>↑</button>
            <button disabled={!!preview} aria-label="Mover abaixo 10 cm" onClick={()=>step(chosen,0,-100)}>↓</button>
            <button disabled={!!preview} aria-label="Mover à direita 10 cm" onClick={()=>step(chosen,100,0)}>→</button>
          </div>
        </div>}
        <div className={issues.length?styles.problems:styles.ready} role="status" aria-live="polite">
          {issues.length?<><strong>{rooms.length?'Ajuste a planta para exportar':'Comece pelas medidas'}</strong>
            <ul>{issues.map((p,i)=><li key={i}>{p.message}</li>)}</ul></>:<strong>{draftPending?'Aplique as medidas em edição ou escolha Novo cômodo para descartá-las.':'Pronta para exportar · cômodos conectados, sem sobreposição'}</strong>}
        </div>
      </section>
      <section className={styles.editor} aria-label="Medidas do cômodo">
        <div className={styles.editorTitle}><h2>{selected?'Editar cômodo':'Novo cômodo'}</h2>
          <button disabled={!!preview} onClick={()=>newRoom()}>Novo cômodo</button></div>
        <form onSubmit={submit}>
          <fieldset disabled={!!preview}>
            {input('Nome do cômodo','name','Como você chama este espaço?')}
            <div className={styles.pair}>{input('Largura (m)','width','Ex.: 4,20')}{input('Profundidade (m)','depth','Ex.: 3,00')}</div>
            {input('Pé-direito da planta (m)','height','Declare a altura')}
            <p className={styles.hint}>Até três casas decimais. Alterar o pé-direito vale para todos os cômodos.</p>
            {error&&<p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.actions}><button className={styles.primary} type="submit">{selected?'Aplicar medidas':'Adicionar cômodo'}</button>
              {selected&&<button type="button" onClick={remove}>Excluir cômodo</button>}</div>
          </fieldset>
        </form>
        {rooms.length>0&&<><h2 className={styles.listTitle}>Cômodos da planta</h2><ul className={styles.list}>
          {rooms.map(r=><li key={r.id}><button disabled={!!preview} onClick={()=>select(r)} aria-pressed={selected===r.id}>
            <span>{r.name}</span><small>{metros(r.widthMm)} × {metros(r.depthMm)} m</small>
          </button></li>)}</ul></>}
      </section>
    </div>
    <section className={styles.export} aria-label="Exportação local">
      <div><h2>Leve a planta com você</h2><p>Baixe o JSON das medidas declaradas. Nenhum dado é enviado.</p></div>
      <button className={styles.primary} disabled={!json||!!preview} onClick={download}>Baixar leitura.json</button>
      <details><summary>Inspecionar JSON</summary>{json?<textarea aria-label="JSON da planta" readOnly value={json} rows={14}/>:<p>Corrija os avisos para gerar o arquivo.</p>}</details>
    </section>
    <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
  </main>
}
