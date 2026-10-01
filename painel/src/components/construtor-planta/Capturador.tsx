'use client'
import {useEffect,useRef,useState,type PointerEvent as RPE,type ReactNode} from 'react'
import {aplicar,desfazer,refazer,iniciar,metros,problemas,problemasAberturas,parDaAbertura,exportar,snap,
  paredeProxima,geometriaParedes,type Session,type Room,type OpeningInput} from './modelo'
import styles from './capturador.module.css'
import Folha from './Folha'
import FormComodo,{type MedidasComodo} from './FormComodo'
import FormAbertura from './FormAbertura'
import ParedesEAberturas from './ParedesEAberturas'

// M1.1-B: tela cheia, sem rolagem. Menu lateral para arrastar (ou tocar) cômodo, porta e
// janela; pop-up embaixo com os dados; um toque seleciona e manter pressionado edita; dois
// dedos movem e aproximam a planta. O modelo (modelo.ts) e o arquivo exportado não mudam.
type Ferramenta='quadrado'|'retangulo'|'janela'|'porta'
type Ponto={x:number;y:number}
type Camera={cx:number;cy:number;w:number}                    // centro e largura da vista, em mm
type Sel={tipo:'comodo'|'abertura';id:string}|null
type Alvo=Sel|{tipo:'parede';id:string}
type Aberta={tipo:'comodo-novo';forma:'quadrado'|'retangulo';em:Ponto;tol:number}|{tipo:'comodo';id:string}
  |{tipo:'abertura-nova';kind:'door'|'window';wallId:string;t:number}|{tipo:'abertura';id:string}|{tipo:'status'}|null
type Gesto={tipo:'nada'}
  |{tipo:'pressao';pointerId:number;x0:number;y0:number;alvo:Alvo;p0:Ponto;timer:number}
  |{tipo:'arraste';pointerId:number;room:Room;p0:Ponto;pos:{xMm:number;yMm:number}}
  |{tipo:'pinca';cam0:Camera;d0:number;m0:Ponto}

// Ao soltar o cômodo o encaixe é mais forte que no arraste: o dedo solta antes de saber o
// tamanho, e a parede vizinha só aparece depois de digitar as medidas.
const TOQUE_LONGO=500,FOLGA_PX=8,ENCAIXE_PX=12,ENCAIXE_SOLTAR_PX=32,PAREDE_PX=24
const icone=(d:ReactNode)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const FERRAMENTAS:{id:Ferramenta;rotulo:string;desenho:ReactNode}[]=[
  {id:'quadrado',rotulo:'Quadrado',desenho:icone(<rect x="5" y="5" width="14" height="14"/>)},
  {id:'retangulo',rotulo:'Retângulo',desenho:icone(<rect x="3" y="7" width="18" height="10"/>)},
  {id:'janela',rotulo:'Janela',desenho:icone(<><rect x="4" y="5" width="16" height="14"/><path d="M12 5v14M4 12h16"/></>)},
  {id:'porta',rotulo:'Porta',desenho:icone(<><path d="M4 21h16M7 21V3h10v18"/><circle cx="14" cy="12" r=".8"/></>)},
]

// Vista que mostra tudo: o conjunto com 1 m de folga (e no mínimo 6 x 5 m), no formato da tela.
function enquadrar(rooms:Room[],w:number,h:number):Camera{
  const x0=Math.min(0,...rooms.map(r=>r.xMm))-1000,x1=Math.max(6000,...rooms.map(r=>r.xMm+r.widthMm))+1000
  const y0=Math.min(0,...rooms.map(r=>r.yMm))-1000,y1=Math.max(5000,...rooms.map(r=>r.yMm+r.depthMm))+1000
  return {cx:(x0+x1)/2,cy:(y0+y1)/2,w:Math.max(x1-x0,w&&h?(y1-y0)*w/h:0)}
}
// Zoom que mantém sob o dedo (m) o ponto da planta que estava sob ele no começo (m0).
function zoomEm(c:Camera,r:DOMRect,m0:Ponto,m:Ponto,w:number):Camera{
  w=Math.min(Math.max(w,1500),400000)
  const s0=r.width/c.w,s=r.width/w,ox=r.left+r.width/2,oy=r.top+r.height/2
  const px=c.cx+(m0.x-ox)/s0,py=c.cy-(m0.y-oy)/s0
  return {cx:px-(m.x-ox)/s,cy:py+(m.y-oy)/s,w}
}

export default function Capturador({initialSession,onSave}:{initialSession?:Session;onSave?:(json:string)=>Promise<void>}){
  const [session,setSession]=useState<Session|null>(null)
  const [sel,setSel]=useState<Sel>(null)
  const [aberta,setAberta]=useState<Aberta>(null)
  const [rascComodo,setRascComodo]=useState<{widthMm:number;depthMm:number}|null>(null)
  const [rascAbertura,setRascAbertura]=useState<OpeningInput|null>(null)
  const [camera,setCamera]=useState<Camera|null>(null)          // null: enquadra tudo sozinha
  const [tam,setTam]=useState({w:0,h:0})
  const [topoFolha,setTopoFolha]=useState<number|null>(null)
  const [arrasteMenu,setArrasteMenu]=useState<{ferramenta:Ferramenta;x:number;y:number;parede:string|null}|null>(null)
  const [aguardando,setAguardando]=useState<'door'|'window'|null>(null)
  const [preview,setPreview]=useState<{id:string;xMm:number;yMm:number}|null>(null)
  const [notice,setNotice]=useState('')
  const [saving,setSaving]=useState(false)
  const [saveError,setSaveError]=useState('')
  const svg=useRef<SVGSVGElement>(null),plano=useRef<HTMLDivElement>(null)
  const gesto=useRef<Gesto>({tipo:'nada'}),ponteiros=useRef(new Map<number,Ponto>())
  const menu=useRef<{ferramenta:Ferramenta;pointerId:number;x0:number;y0:number;moveu:boolean}|null>(null)
  const ignorarClique=useRef(false),cameraAntes=useRef<Camera|null>(null),camAtual=useRef<Camera|null>(null)
  const pronto=session!==null
  useEffect(()=>{setSession(initialSession??iniciar('leitura-'+crypto.randomUUID()))},[initialSession])
  useEffect(()=>{
    const el=plano.current
    if(!el) return
    const ro=new ResizeObserver(([e])=>setTam({w:e.contentRect.width,h:e.contentRect.height}))
    ro.observe(el);return ()=>ro.disconnect()
  },[pronto])
  useEffect(()=>{
    // Roda do mouse aproxima no ponto do cursor. Ouvinte nativo: o do React é passivo.
    const el=svg.current
    if(!el) return
    const roda=(e:WheelEvent)=>{
      const c=camAtual.current,r=plano.current?.getBoundingClientRect()
      if(!c||!r) return
      e.preventDefault()
      const m={x:e.clientX,y:e.clientY}
      setCamera(zoomEm(c,r,m,m,c.w*Math.exp(e.deltaY*0.0015)))
    }
    el.addEventListener('wheel',roda,{passive:false});return ()=>el.removeEventListener('wheel',roda)
  },[pronto])
  useEffect(()=>{if(!notice) return;const t=setTimeout(()=>setNotice(''),4000);return ()=>clearTimeout(t)},[notice])
  useEffect(()=>{
    if(!aguardando) return
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape') setAguardando(null)}
    window.addEventListener('keydown',esc);return ()=>window.removeEventListener('keydown',esc)
  },[aguardando])

  const s=session
  const rooms=s?.present.rooms??[]
  const walls=geometriaParedes(rooms)
  const cam=camera??enquadrar(rooms,tam.w,tam.h)
  camAtual.current=cam
  const vbH=tam.w?cam.w*tam.h/tam.w:cam.w*0.75
  const vb={x:cam.cx-cam.w/2,y:-cam.cy-vbH/2,w:cam.w,h:vbH}
  const mmPorPx=tam.w?cam.w/tam.w:20
  // Com o pop-up aberto, a planta enquadra o que está sendo editado na área acima dele.
  const editado=s&&aberta&&aberta.tipo!=='status'?caixaEditada():null
  const chaveCaixa=editado?editado.map(v=>Math.round(v)).join(','):''
  useEffect(()=>{
    const r=plano.current?.getBoundingClientRect()
    if(!editado||!r||!r.width) return
    const baixo=Math.min(r.bottom,topoFolha??r.bottom),altura=Math.max(60,baixo-r.top-12)
    const [x0,y0,x1,y1]=editado
    const k=Math.min(r.width/(Math.max(x1-x0,2000)*1.3),altura/(Math.max(y1-y0,2000)*1.3))
    setCamera({cx:(x0+x1)/2,cy:(y0+y1)/2+((r.top+baixo)/2-(r.top+r.height/2))/k,w:r.width/k})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[chaveCaixa,topoFolha,tam.w,tam.h])
  if(!s) return <p className="p-6">Preparando a planta local…</p>

  const shown=rooms.map(r=>preview?.id===r.id?{...r,...preview}:r)
  const issues=problemas({...s.present,rooms:shown})
  const invalidIds=new Set(issues.flatMap(e=>e.ids))
  const json=problemas(s.present).length?'':exportar(s)
  const selecao=sel&&(sel.tipo==='comodo'?rooms.some(r=>r.id===sel.id):s.present.openings.some(o=>o.id===sel.id))?sel:null
  const ocupado=!!preview||!!arrasteMenu||saving||(!!aberta&&aberta.tipo!=='status')

  function caixaEditada():[number,number,number,number]|null{
    if(!aberta) return null
    if(aberta.tipo==='comodo-novo'){
      const w=rascComodo?.widthMm??3000,d=rascComodo?.depthMm??3000
      return [aberta.em.x-w/2,aberta.em.y-d/2,aberta.em.x+w/2,aberta.em.y+d/2]
    }
    if(aberta.tipo==='comodo'){
      const r=rooms.find(r=>r.id===aberta.id)
      return r?[r.xMm,r.yMm,r.xMm+Math.max(r.widthMm,rascComodo?.widthMm??0),r.yMm+Math.max(r.depthMm,rascComodo?.depthMm??0)]:null
    }
    if(aberta.tipo==='status') return null
    const id=aberta.tipo==='abertura'?aberta.id:null
    const wallId=aberta.tipo==='abertura-nova'?aberta.wallId:s!.present.openings.find(o=>o.id===id)?.wallId
    const w=walls.find(w=>w.id===wallId)
    if(!w) return null
    return w.axis==='x'?[w.start,w.fixed-600,w.end,w.fixed+600]:[w.fixed-600,w.start,w.fixed+600,w.end]
  }
  function aoPlano(cx:number,cy:number):Ponto|null{
    const m=svg.current?.getScreenCTM()
    if(!m) return null
    const p=new DOMPoint(cx,cy).matrixTransform(m.inverse())
    return {x:p.x,y:-p.y}
  }
  function dentroDaPlanta(x:number,y:number){
    const r=plano.current?.getBoundingClientRect()
    return r&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom?aoPlano(x,y):null
  }
  function posicaoSolta(em:Ponto,w:number,d:number,tol:number){
    const x=Math.round(em.x-w/2),y=Math.round(em.y-d/2)
    return snap([...rooms,{id:'__novo',name:'',xMm:x,yMm:y,widthMm:w,depthMm:d}],'__novo',x,y,tol)
  }
  function verificar(o:OpeningInput,ignorar?:string){
    const par=parDaAbertura(rooms,o)
    if(par.error) return {mensagens:[par.error],trecho:''}
    const trecho=par.id?'Trecho interno, compartilhado com '+(walls.find(w=>w.id===par.id)?.label??par.id):'Trecho externo'
    const rasc={...o,id:'__rascunho',...(par.id?{pairedWallId:par.id}:{})}
    const mensagens=problemasAberturas({...s!.present,openings:[...s!.present.openings.filter(x=>x.id!==ignorar),rasc]})
      .filter(e=>e.ids.includes('__rascunho'))
      .map(e=>e.message.replace(/^__rascunho: /,'').replace(/__rascunho/g,'esta abertura'))
    return {mensagens,trecho}
  }

  function abrir(f:NonNullable<Aberta>){
    cameraAntes.current=camera;setAberta(f);setAguardando(null)
    if(f.tipo==='comodo') setSel({tipo:'comodo',id:f.id})
    if(f.tipo==='abertura') setSel({tipo:'abertura',id:f.id})
  }
  function fechar(){
    setAberta(null);setRascComodo(null);setRascAbertura(null);setTopoFolha(null);setCamera(cameraAntes.current)
  }
  function editar(a:Sel){
    if(a) abrir(a.tipo==='comodo'?{tipo:'comodo',id:a.id}:{tipo:'abertura',id:a.id})
  }
  function soltar(f:Ferramenta,p:Ponto){
    if(f==='quadrado'||f==='retangulo'){abrir({tipo:'comodo-novo',forma:f,em:p,tol:ENCAIXE_SOLTAR_PX*mmPorPx});return}
    const nome=f==='porta'?'a porta':'a janela'
    if(!rooms.length){setNotice('Coloque um cômodo antes d'+nome+'.');return}
    const achou=paredeProxima(rooms,p.x,p.y,PAREDE_PX*mmPorPx)
    if(!achou){setNotice('Solte '+nome+' sobre uma parede.');return}
    abrir({tipo:'abertura-nova',kind:f==='porta'?'door':'window',wallId:achou.wall.id,t:achou.t})
  }
  // Toque (ou teclado) no ícone: cômodo entra no centro da vista; porta/janela pede uma parede.
  function tocarFerramenta(f:Ferramenta){
    if(ignorarClique.current){ignorarClique.current=false;return}
    if(ocupado) return
    if(f==='quadrado'||f==='retangulo'){abrir({tipo:'comodo-novo',forma:f,em:{x:cam.cx,y:cam.cy},tol:ENCAIXE_SOLTAR_PX*mmPorPx});return}
    const kind=f==='porta'?'door':'window'
    if(!rooms.length){setNotice('Coloque um cômodo antes d'+(kind==='door'?'a porta':'a janela')+'.');return}
    setSel(null);setAguardando(aguardando===kind?null:kind)
  }
  function menuDescer(e:RPE<HTMLButtonElement>,f:Ferramenta){
    ignorarClique.current=false
    if(ocupado||(e.pointerType==='mouse'&&e.button!==0)) return
    try{e.currentTarget.setPointerCapture(e.pointerId)}catch{/* ponteiro já solto */}
    menu.current={ferramenta:f,pointerId:e.pointerId,x0:e.clientX,y0:e.clientY,moveu:false}
  }
  function menuMover(e:RPE<HTMLButtonElement>){
    const m=menu.current
    if(!m||m.pointerId!==e.pointerId) return
    if(!m.moveu&&Math.hypot(e.clientX-m.x0,e.clientY-m.y0)<FOLGA_PX) return
    m.moveu=true
    const p=m.ferramenta==='porta'||m.ferramenta==='janela'?dentroDaPlanta(e.clientX,e.clientY):null
    setArrasteMenu({ferramenta:m.ferramenta,x:e.clientX,y:e.clientY,
      parede:p?paredeProxima(rooms,p.x,p.y,PAREDE_PX*mmPorPx)?.wall.id??null:null})
  }
  function menuSoltar(e:RPE<HTMLButtonElement>,cancelar=false){
    const m=menu.current
    if(!m||m.pointerId!==e.pointerId) return
    menu.current=null;setArrasteMenu(null)
    if(!m.moveu) return                                       // foi toque: o onClick resolve
    ignorarClique.current=true
    if(cancelar) return
    const p=dentroDaPlanta(e.clientX,e.clientY)
    if(p) soltar(m.ferramenta,p);else setNotice('Solte dentro da planta.')
  }

  function aoDescer(e:RPE<SVGSVGElement>){
    if(e.pointerType==='mouse'&&e.button!==0) return
    ponteiros.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    try{svg.current?.setPointerCapture(e.pointerId)}catch{/* ponteiro já solto */}
    if(ponteiros.current.size>=2){comecarPinca();return}
    const p=aoPlano(e.clientX,e.clientY)
    if(!p) return
    const el=(e.target as Element).closest('[data-comodo],[data-abertura],[data-parede]')
    const alvo:Alvo=!el?null:el.hasAttribute('data-comodo')?{tipo:'comodo',id:el.getAttribute('data-comodo')!}
      :el.hasAttribute('data-abertura')?{tipo:'abertura',id:el.getAttribute('data-abertura')!}
      :{tipo:'parede',id:el.getAttribute('data-parede')!}
    const timer=window.setTimeout(()=>pressaoLonga(e.pointerId),TOQUE_LONGO)
    gesto.current={tipo:'pressao',pointerId:e.pointerId,x0:e.clientX,y0:e.clientY,alvo,p0:p,timer}
  }
  function pressaoLonga(pointerId:number){
    const g=gesto.current
    if(g.tipo!=='pressao'||g.pointerId!==pointerId) return
    gesto.current={tipo:'nada'}
    const a=g.alvo
    if(aberta||aguardando||!a||a.tipo==='parede') return
    navigator.vibrate?.(12)
    if(selecao?.tipo===a.tipo&&selecao.id===a.id) editar(a)
    else{setSel(a);setNotice('Selecionado. Mantenha pressionado de novo para editar.')}
  }
  function aoMover(e:RPE<SVGSVGElement>){
    if(!ponteiros.current.has(e.pointerId)) return
    ponteiros.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    const g=gesto.current
    if(g.tipo==='pinca'){moverPinca(g);return}
    if(g.tipo==='pressao'&&g.pointerId===e.pointerId){
      if(Math.hypot(e.clientX-g.x0,e.clientY-g.y0)<FOLGA_PX) return
      clearTimeout(g.timer)
      const room=g.alvo?.tipo==='comodo'&&!aberta&&!aguardando?rooms.find(r=>r.id===g.alvo!.id):undefined
      if(!room){gesto.current={tipo:'nada'};return}
      setSel({tipo:'comodo',id:room.id})
      gesto.current={tipo:'arraste',pointerId:e.pointerId,room,p0:g.p0,pos:{xMm:room.xMm,yMm:room.yMm}}
    }
    const a=gesto.current
    if(a.tipo==='arraste'&&a.pointerId===e.pointerId){
      const p=aoPlano(e.clientX,e.clientY)
      if(!p) return
      // Quantização de posição do gesto; medidas digitadas nunca usam float/round.
      a.pos=snap(rooms,a.room.id,a.room.xMm+Math.round(p.x-a.p0.x),a.room.yMm+Math.round(p.y-a.p0.y),ENCAIXE_PX*mmPorPx)
      setPreview({id:a.room.id,...a.pos})
    }
  }
  function aoSubir(e:RPE<SVGSVGElement>,cancelar=false){
    if(!ponteiros.current.delete(e.pointerId)) return
    if(svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId)
    const g=gesto.current
    if(g.tipo==='pinca'){if(!ponteiros.current.size) gesto.current={tipo:'nada'};return}
    if(g.tipo==='pressao'&&g.pointerId===e.pointerId){
      clearTimeout(g.timer);gesto.current={tipo:'nada'}
      if(!cancelar) tocar(g.alvo,g.p0)
    }
    if(g.tipo==='arraste'&&g.pointerId===e.pointerId){
      gesto.current={tipo:'nada'};setPreview(null)
      if(!cancelar){
        const next=aplicar(s!,{type:'move',id:g.room.id,...g.pos})
        setSession(next);setNotice(avisoDoPar(next)||'Posição aplicada. Desfazer reverte o arraste inteiro.')
      }
    }
  }
  function tocar(alvo:Alvo,p:Ponto){
    if(aberta) return                                         // com o pop-up aberto a planta só mostra
    if(aguardando){
      const achou=paredeProxima(rooms,p.x,p.y,PAREDE_PX*mmPorPx)
      if(!achou){setNotice('Toque sobre uma parede.');return}
      abrir({tipo:'abertura-nova',kind:aguardando,wallId:achou.wall.id,t:achou.t});return
    }
    setSel(alvo&&alvo.tipo!=='parede'?alvo:null)
  }
  function comecarPinca(){
    const g=gesto.current
    if(g.tipo==='pressao') clearTimeout(g.timer)
    if(g.tipo==='arraste') setPreview(null)
    const [a,b]=[...ponteiros.current.values()]
    gesto.current={tipo:'pinca',cam0:cam,d0:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),m0:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}
  }
  function moverPinca(g:Extract<Gesto,{tipo:'pinca'}>){
    const [a,b]=[...ponteiros.current.values()],r=plano.current?.getBoundingClientRect()
    if(!b||!r) return
    const d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))
    setCamera(zoomEm(g.cam0,r,g.m0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},g.cam0.w*g.d0/d))
  }

  // O par acompanha a geometria (modelo: reparear); a tela avisa quando uma abertura muda de lado.
  function avisoDoPar(depois:Session){
    const o=depois.present.openings.find(o=>{const a=s!.present.openings.find(x=>x.id===o.id)
      return a&&a.pairedWallId!==o.pairedWallId})
    if(!o) return ''
    return (o.kind==='door'?'A porta':'A janela')+(o.pairedWallId?' passou a ser comum aos dois cômodos.':' agora dá para fora.')
  }
  function step(room:Room,dx:number,dy:number){
    const p=snap(rooms,room.id,room.xMm+dx,room.yMm+dy,0),next=aplicar(s!,{type:'move',id:room.id,...p})
    setSession(next);setNotice(avisoDoPar(next)||'Posição alterada em 10 cm.')
  }
  function historia(redo=false){
    setSession(redo?refazer(s!):desfazer(s!));setSel(null);setNotice(redo?'Ação refeita.':'Ação desfeita.')
  }
  function download(){
    if(!json||ocupado) return
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download='leitura.json';a.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Download de leitura.json iniciado.')
  }
  async function save(){
    if(!json||ocupado||!onSave) return
    setSaving(true);setSaveError('')
    try{await onSave(json);setNotice('Versão salva. Alterações futuras geram outra versão.')}
    catch(e){setSaveError((e as Error).message)}finally{setSaving(false)}
  }

  function conteudoDaFolha():{titulo:string;corpo:ReactNode}|null{
    if(!aberta) return null
    if(aberta.tipo==='status') return {titulo:issues.length?'Ajuste para baixar':'Pronta para baixar',corpo:<div className={styles.form}>
      {issues.length?<ul className={styles.alerta}>{issues.map((p,i)=><li key={i}>{p.message}</li>)}</ul>
        :<p>Planta e aberturas sem bloqueios locais.</p>}
      <p className={styles.dica}>Medidas entre eixos das paredes. {onSave?'As alterações ficam nesta aba até você salvar a versão.'
        :'Somente nesta aba: baixe o arquivo antes de sair; recarregar apaga o trabalho.'}</p>
      <details><summary>Ver JSON</summary>{json?<textarea aria-label="JSON da planta" readOnly value={json} rows={10}/>
        :<p className={styles.dica}>Corrija os avisos para gerar o arquivo.</p>}</details>
    </div>}
    if(aberta.tipo==='comodo-novo'){
      const confirmar=(m:MedidasComodo)=>{
        const pos=posicaoSolta(aberta.em,m.widthMm,m.depthMm,aberta.tol)
        const next=aplicar(s!,{type:'add',...m,...pos})
        fechar();setSession(next);setSel({tipo:'comodo',id:'c'+s!.nextId})
        setNotice(avisoDoPar(next)||'Cômodo adicionado: '+m.name.trim()+'.')
      }
      return {titulo:aberta.forma==='quadrado'?'Novo cômodo quadrado':'Novo cômodo',corpo:<FormComodo forma={aberta.forma}
        peDireito={s!.present.ceilingHeightMm} pedirPeDireito={s!.present.ceilingHeightMm===null}
        onRascunho={setRascComodo} onConfirmar={confirmar} onCancelar={fechar}/>}
    }
    if(aberta.tipo==='comodo'){
      const room=rooms.find(r=>r.id===aberta.id)
      if(!room) return null
      return {titulo:'Editar '+room.name,corpo:<FormComodo forma="retangulo" inicial={room}
        peDireito={s!.present.ceilingHeightMm} pedirPeDireito onRascunho={setRascComodo}
        onConfirmar={m=>{const next=aplicar(s!,{type:'edit',id:room.id,...m});fechar();setSession(next)
          setNotice(avisoDoPar(next)||'Medidas aplicadas.')}}
        onExcluir={()=>{const next=aplicar(s!,{type:'delete',id:room.id});fechar();setSession(next);setSel(null)
          setNotice(avisoDoPar(next)||'Cômodo excluído. Você pode desfazer.')}} onCancelar={fechar}>
        <div className={styles.posicao}><span>Posição: x {metros(room.xMm)} · y {metros(room.yMm)} m</span>
          <div role="group" aria-label="Mover em passos de 10 cm">
            <button type="button" aria-label="Mover à esquerda 10 cm" onClick={()=>step(room,-100,0)}>←</button>
            <button type="button" aria-label="Mover acima 10 cm" onClick={()=>step(room,0,100)}>↑</button>
            <button type="button" aria-label="Mover abaixo 10 cm" onClick={()=>step(room,0,-100)}>↓</button>
            <button type="button" aria-label="Mover à direita 10 cm" onClick={()=>step(room,100,0)}>→</button>
          </div></div>
      </FormComodo>}
    }
    const o=aberta.tipo==='abertura'?s!.present.openings.find(x=>x.id===aberta.id):undefined
    const wall=walls.find(w=>w.id===(aberta.tipo==='abertura-nova'?aberta.wallId:o?.wallId))
    if(!wall||(aberta.tipo==='abertura'&&!o)) return null
    const nova=aberta.tipo==='abertura-nova'
    return {titulo:nova?(aberta.kind==='door'?'Nova porta':'Nova janela'):(o!.kind==='door'?'Editar porta':'Editar janela'),
      corpo:<FormAbertura wall={wall} kind={nova?aberta.kind:o!.kind} inicial={o} t={nova?aberta.t:undefined}
        verificar={x=>verificar(x,o?.id)} onRascunho={setRascAbertura}
        onConfirmar={x=>{
          const next=aplicar(s!,o?{type:'opening-edit',id:o.id,...x}:{type:'opening-add',...x})
          fechar();setSession(next);setSel({tipo:'abertura',id:o?.id??'a'+s!.nextOpeningId})
          setNotice(o?'Abertura aplicada.':(x.kind==='door'?'Porta adicionada.':'Janela adicionada.'))
        }}
        onExcluir={o&&(()=>{const next=aplicar(s!,{type:'opening-delete',id:o.id});fechar();setSession(next);setSel(null)
          setNotice('Abertura excluída. Você pode desfazer.')})} onCancelar={fechar}/>}
  }

  const folha=conteudoDaFolha()
  const editando=aberta?.tipo==='abertura'?aberta.id:null
  const novo=aberta?.tipo==='comodo-novo'&&rascComodo?{...posicaoSolta(aberta.em,rascComodo.widthMm,rascComodo.depthMm,aberta.tol),...rascComodo}:null
  const redimensionado=aberta?.tipo==='comodo'&&rascComodo?rooms.find(r=>r.id===aberta.id):undefined
  const paredeDestaque=arrasteMenu?.parede??rascAbertura?.wallId??null
  const nomeSel=!selecao?'':selecao.tipo==='comodo'?(()=>{const r=rooms.find(r=>r.id===selecao.id)!
    return r.name+' · '+metros(r.widthMm)+' × '+metros(r.depthMm)+' m'})()
    :(()=>{const o=s.present.openings.find(o=>o.id===selecao.id)!
      return (o.kind==='door'?'Porta ':'Janela ')+metros(o.widthMm)+' m · '+(walls.find(w=>w.id===o.wallId)?.label??'')})()
  const pendentes=issues.filter(p=>p.code!=='EMPTY'&&p.code!=='HEIGHT_REQUIRED').length

  return <div className={styles.app} aria-busy={saving}>
    <div className={styles.barra} inert={saving}>
      <button aria-label="Desfazer" title="Desfazer" disabled={!s.past.length||ocupado} onClick={()=>historia()}>
        {icone(<><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></>)}</button>
      <button aria-label="Refazer" title="Refazer" disabled={!s.future.length||ocupado} onClick={()=>historia(true)}>
        {icone(<><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/></>)}</button>
      <button className={rooms.length&&pendentes?styles.avisos:rooms.length?styles.pronta:styles.neutro}
        disabled={ocupado} onClick={()=>abrir({tipo:'status'})}>
        {!rooms.length?'Planta vazia':pendentes?pendentes+(pendentes===1?' aviso':' avisos'):'Pronta'}</button>
      <span className={styles.espaco}/>
      <button aria-label="Enquadrar a planta" title="Enquadrar a planta" disabled={ocupado} onClick={()=>setCamera(null)}>
        {icone(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>)}</button>
      {onSave&&<button className={styles.primario} disabled={!json||ocupado} onClick={save}>Salvar</button>}
      <button className={styles.primario} aria-label="Baixar leitura.json" title="Baixar leitura.json"
        disabled={!json||ocupado} onClick={download}>{icone(<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>)}<span>Baixar</span></button>
    </div>
    <nav className={styles.menu} aria-label="Adicionar à planta" inert={saving} onContextMenu={e=>e.preventDefault()}>
      {FERRAMENTAS.map(f=><button key={f.id} type="button"
        aria-pressed={f.id==='porta'?aguardando==='door':f.id==='janela'?aguardando==='window':undefined}
        aria-label={f.rotulo+': arraste até a planta ou toque'} onPointerDown={e=>menuDescer(e,f.id)}
        onPointerMove={menuMover} onPointerUp={e=>menuSoltar(e)} onPointerCancel={e=>menuSoltar(e,true)}
        onClick={()=>tocarFerramenta(f.id)}>{f.desenho}<span>{f.rotulo}</span></button>)}
    </nav>
    <div ref={plano} className={styles.plano}>
      <svg ref={svg} className={styles.canvas} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        aria-label="Planta em escala: toque para selecionar, mantenha pressionado para editar, arraste para mover"
        onPointerDown={aoDescer} onPointerMove={aoMover} onPointerUp={e=>aoSubir(e)}
        onPointerCancel={e=>aoSubir(e,true)} onContextMenu={e=>e.preventDefault()}>
        <defs><pattern id="grade-planta" width="1000" height="1000" patternUnits="userSpaceOnUse">
          <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#dbe2e8" strokeWidth="12"/>
        </pattern></defs>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grade-planta)"/>
        {shown.map(room=>{
          const marcado=selecao?.tipo==='comodo'&&selecao.id===room.id
          return <g key={room.id} data-comodo={room.id} role="button" tabIndex={0} aria-pressed={marcado}
            aria-label={room.name+', '+metros(room.widthMm)+' por '+metros(room.depthMm)+' m'}
            onKeyDown={e=>{
              const delta:Record<string,[number,number]>={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,100],ArrowDown:[0,-100]}
              if(delta[e.key]&&marcado&&!ocupado){e.preventDefault();step(room,...delta[e.key])}
              if(e.key==='Enter'||e.key===' '){e.preventDefault();if(marcado) editar(selecao);else setSel({tipo:'comodo',id:room.id})}
            }}>
            <rect x={room.xMm} y={-room.yMm-room.depthMm} width={room.widthMm} height={room.depthMm}
              fill={invalidIds.has(room.id)?'#fff1f2':marcado?'#d5eee9':'#edf3f7'}
              stroke={invalidIds.has(room.id)?'#be123c':marcado?'#0f766e':'#64748b'}
              strokeWidth={marcado?4:2} vectorEffect="non-scaling-stroke"/>
            <text x={room.xMm+room.widthMm/2} y={-room.yMm-room.depthMm/2} textAnchor="middle"
              fontSize={Math.min(280,room.widthMm/Math.max(room.name.length,12))} fill="#0f172a" pointerEvents="none">
              {room.name.slice(0,24)}
              <tspan x={room.xMm+room.widthMm/2} dy="1.5em" fontSize="0.85em">{metros(room.widthMm)} × {metros(room.depthMm)} m</tspan>
            </text>
          </g>})}
        {redimensionado&&rascComodo&&<rect pointerEvents="none" x={redimensionado.xMm}
          y={-redimensionado.yMm-rascComodo.depthMm} width={rascComodo.widthMm} height={rascComodo.depthMm}
          fill="none" stroke="#0f766e" strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>}
        {novo&&<rect pointerEvents="none" x={novo.xMm} y={-novo.yMm-novo.depthMm} width={novo.widthMm} height={novo.depthMm}
          fill="rgba(15,118,110,.12)" stroke="#0f766e" strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>}
        <ParedesEAberturas rooms={shown} openings={s.present.openings} paredesAtivas={!!aguardando}
          paredeDestaque={paredeDestaque} selecionada={selecao?.tipo==='abertura'?selecao.id:null} invalidIds={invalidIds}
          rascunho={rascAbertura?{o:rascAbertura,ok:!verificar(rascAbertura,editando??undefined).mensagens.length}:null}
          ignorar={editando} mmPorPx={mmPorPx}
          onParedeTeclado={id=>{const w=walls.find(w=>w.id===id)!
            if(aguardando) abrir({tipo:'abertura-nova',kind:aguardando,wallId:id,t:(w.end-w.start)/2})}}
          onAberturaTeclado={id=>{if(selecao?.tipo==='abertura'&&selecao.id===id) editar(selecao);else setSel({tipo:'abertura',id})}}/>
      </svg>
      {!rooms.length&&!aberta&&!arrasteMenu&&<div className={styles.vazio}>
        <strong>Arraste um quadrado ou retângulo para a planta</strong> ou toque nele. Medidas entre eixos das paredes.
        {!onSave&&' Somente nesta aba: baixe o arquivo antes de sair.'}</div>}
      {aguardando&&<div className={styles.faixa} role="status"><span>Toque na parede onde vai a {aguardando==='door'?'porta':'janela'}</span>
        <button onClick={()=>setAguardando(null)}>Cancelar</button></div>}
      {selecao&&!aberta&&!aguardando&&!preview&&<div className={styles.faixa}><span>{nomeSel}</span>
        <button className={styles.primario} onClick={()=>editar(selecao)}>Editar</button></div>}
    </div>
    {arrasteMenu&&<div className={styles.fantasma} style={{left:arrasteMenu.x,top:arrasteMenu.y}} aria-hidden="true">
      {FERRAMENTAS.find(f=>f.id===arrasteMenu.ferramenta)!.desenho}</div>}
    {aberta&&folha&&<Folha key={JSON.stringify(aberta)} titulo={folha.titulo} onFechar={fechar}
      onTopo={y=>setTopoFolha(t=>t!==null&&Math.abs(t-y)<1?t:y)}>{folha.corpo}</Folha>}
    {saveError&&<p role="alert" className={styles.toastErro}>{saveError}</p>}
    <p className={styles.toast} role="status" aria-live="polite">{saving?'Validando e salvando versão…':notice}</p>
  </div>
}
