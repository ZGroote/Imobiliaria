'use client'
import {useEffect,useRef,useState,type PointerEvent as RPE,type ReactNode} from 'react'
import {aplicar,desfazer,refazer,iniciar,metros,problemas,problemasAberturas,parDaAbertura,exportar,snap,
  paredeProxima,geometriaParedes,relacoes,paredes,mesmoGrupoMesclado,grupoDoComodo,
  decomporPoligonoOrtogonal,contornoPoligono,exportarMoveis,
  type Session,type Room,type Opening,type OpeningInput,type Wall,type FurnitureItem} from './modelo'
import styles from './capturador.module.css'
import Folha from './Folha'
import FormComodo,{type MedidasComodo} from './FormComodo'
import FormAbertura from './FormAbertura'
import ParedesEAberturas from './ParedesEAberturas'
import Movel2D from './Movel2D'
import PainelMoveis from './PainelMoveis'
import {type DefinicaoMovel} from './catalogoMoveis'
import {requisitarMaquete3D} from '@/lib/leituras'
import {carregarEditorState,exportarEditor,type EditorState,type Floor} from './editorDocument'

// M1.1-B: tela cheia, sem rolagem. Menu lateral para arrastar (ou tocar) cômodo, porta e
// janela; pop-up embaixo com os dados; um toque seleciona e manter pressionado edita; dois
// dedos movem e aproximam a planta. O modelo (modelo.ts) e o arquivo exportado não mudam.
// M1.1-C2: mesclar cômodos encostados em formato L/T/U e separá-los pelo formulário ou seleção.
type Ferramenta='parede'|'quadrado'|'retangulo'|'escada'|'janela'|'porta'|'movel'
type Ponto={x:number;y:number}
type Camera={cx:number;cy:number;w:number}                    // centro e largura da vista, em mm
type Sel={tipo:'comodo'|'abertura'|'movel';id:string}|null
type Alvo=Sel|{tipo:'parede';id:string}
type Aberta={tipo:'comodo-novo';forma:'quadrado'|'retangulo';em:Ponto;tol:number;inicial?:{name?:string;widthMm?:number;depthMm?:number}}|{tipo:'comodo';id:string}
  |{tipo:'comodo-poligono';retangulos:Array<{xMm:number;yMm:number;widthMm:number;depthMm:number}>;perimetroMm:number;areaMm2:number;inicial?:{name?:string}}
  |{tipo:'abertura-nova';kind:'door'|'window';wallId:string;t:number}|{tipo:'abertura';id:string}|{tipo:'status'}|{tipo:'catalogo-moveis'}|null
type Gesto={tipo:'nada'}
  |{tipo:'pressao';pointerId:number;x0:number;y0:number;alvo:Alvo;p0:Ponto;timer:number}
  |{tipo:'arraste';pointerId:number;room:Room;p0:Ponto;pos:{xMm:number;yMm:number}}
  |{tipo:'arraste-abertura';pointerId:number;opening:Opening;wall:Wall;p0:Ponto;offset0:number;offsetAtual:number}
  |{tipo:'arraste-movel';pointerId:number;movel:FurnitureItem;p0:Ponto;pos0:{xMm:number;yMm:number};posAtual:{xMm:number;yMm:number}}
  |{tipo:'pan';pointerId:number;cam0:Camera;x0:number;y0:number}
  |{tipo:'pinca';cam0:Camera;d0:number;m0:Ponto}
  |{tipo:'desenho-parede';pointerId:number;p0:Ponto;pAtual:Ponto}

// Ao soltar o cômodo o encaixe é mais forte que no arraste: o dedo solta antes de saber o
// tamanho, e a parede vizinha só aparece depois de digitar as medidas.
const TOQUE_LONGO=500,FOLGA_PX=8,ENCAIXE_PX=12,ENCAIXE_SOLTAR_PX=32,PAREDE_PX=24
const icone=(d:ReactNode)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
const FERRAMENTAS:{id:Ferramenta;rotulo:string;desenho:ReactNode}[]=[
  {id:'parede',rotulo:'Parede',desenho:icone(<><rect x="3" y="4" width="18" height="16" rx="2" strokeDasharray="3 2"/><path d="M3 12h18M12 4v8M7 12v8M17 12v8"/></>)},
  {id:'quadrado',rotulo:'Quadrado',desenho:icone(<rect x="5" y="5" width="14" height="14"/>)},
  {id:'retangulo',rotulo:'Retângulo',desenho:icone(<rect x="3" y="7" width="18" height="10"/>)},
  {id:'escada',rotulo:'Escada',desenho:icone(<><path d="M4 19h4v-4h4v-4h4V7h4"/><path d="m14 17 4-4m0 0h-3m3 0v3"/></>)},
  {id:'janela',rotulo:'Janela',desenho:icone(<><rect x="4" y="5" width="16" height="14"/><path d="M12 5v14M4 12h16"/></>)},
  {id:'porta',rotulo:'Porta',desenho:icone(<><path d="M4 21h16M7 21V3h10v18"/><circle cx="14" cy="12" r=".8"/></>)},
  {id:'movel',rotulo:'Móveis',desenho:icone(<><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z"/><path d="M5 18v2M19 18v2"/></>)},
]

// Vista que mostra tudo: o conjunto com 1 m de folga (e no mínimo 6 x 5 m), no formato da tela.
function enquadrar(rooms:Room[],w:number,h:number,gabarito:Room[]=[]):Camera{
  const base=rooms.length?rooms:(gabarito.length?gabarito:[])
  const x0=Math.min(0,...base.map(r=>r.xMm))-1000,x1=Math.max(6000,...base.map(r=>r.xMm+r.widthMm))+1000
  const y0=Math.min(0,...base.map(r=>r.yMm))-1000,y1=Math.max(5000,...base.map(r=>r.yMm+r.depthMm))+1000
  return {cx:(x0+x1)/2,cy:(y0+y1)/2,w:Math.max(x1-x0,w&&h?(y1-y0)*w/h:0)}
}
// Zoom que mantém sob o dedo (m) o ponto da planta que estava sob ele no começo (m0).
function zoomEm(c:Camera,r:DOMRect,m0:Ponto,m:Ponto,w:number):Camera{
  w=Math.min(Math.max(w,1500),400000)
  const s0=r.width/c.w,s=r.width/w,ox=r.left+r.width/2,oy=r.top+r.height/2
  const px=c.cx+(m0.x-ox)/s0,py=c.cy-(m0.y-oy)/s0
  return {cx:px-(m.x-ox)/s,cy:py+(m.y-oy)/s,w}
}

export default function Capturador({initialSession,initialEditorState,onSave,onGerar3D}:{initialSession?:Session;initialEditorState?:EditorState;onSave?:(json:string,editorStateJson:string)=>Promise<void>;onGerar3D?:(json:string,moveisJson:string,floor:Floor)=>Promise<string|{html:string}>}){
  const [andarAtivo,setAndarAtivo]=useState<Floor>(0)
  const [sessoesPavimento,setSessoesPavimento]=useState<Record<number,Session>>({})
  const [sel,setSel]=useState<Sel>(null)
  const [aberta,setAberta]=useState<Aberta>(null)
  const [rascComodo,setRascComodo]=useState<{widthMm:number;depthMm:number}|null>(null)
  const [rascAbertura,setRascAbertura]=useState<OpeningInput|null>(null)
  const [camera,setCamera]=useState<Camera|null>(null)          // null: enquadra tudo sozinha
  const [tam,setTam]=useState({w:0,h:0})
  const [topoFolha,setTopoFolha]=useState<number|null>(null)
  const [arrasteMenu,setArrasteMenu]=useState<{ferramenta:Ferramenta;x:number;y:number;parede:string|null}|null>(null)
  const [aguardando,setAguardando]=useState<'door'|'window'|'parede'|null>(null)
  const [caminhoParedes,setCaminhoParedes]=useState<Ponto[]>([])
  const [rascunhoParede,setRascunhoParede]=useState<{p0:Ponto;p1:Ponto;clientX:number;clientY:number;lenMm:number}|null>(null)
  const [fecharSugerido,setFecharSugerido]=useState(false)
  const [preview,setPreview]=useState<{id:string;xMm:number;yMm:number}|null>(null)
  const [previewAbertura,setPreviewAbertura]=useState<{id:string;offsetMm:number;wallId:string}|null>(null)
  const [previewMovel,setPreviewMovel]=useState<{id:string;xMm:number;yMm:number}|null>(null)
  const [pontoInserirMovel,setPontoInserirMovel]=useState<Ponto|null>(null)
  const [badgeAbertura,setBadgeAbertura]=useState<{clientX:number;clientY:number;offsetMm:number;widthMm:number}|null>(null)
  const [notice,setNotice]=useState('')
  const [saving,setSaving]=useState(false)
  const [openingProject,setOpeningProject]=useState(false)
  const [saveError,setSaveError]=useState('')
  const [gerando3D,setGerando3D]=useState(false)
  const [modal3DAberto,setModal3DAberto]=useState(false)
  const [floorMaquete,setFloorMaquete]=useState<Floor>(0)
  const [htmlMaquete,setHtmlMaquete]=useState('')
  const [blobUrlMaquete,setBlobUrlMaquete]=useState('')
  const svg=useRef<SVGSVGElement>(null),plano=useRef<HTMLDivElement>(null),arquivoProjeto=useRef<HTMLInputElement>(null)
  const fecharMaquete=useRef<HTMLButtonElement>(null)
  const gesto=useRef<Gesto>({tipo:'nada'}),ponteiros=useRef(new Map<number,Ponto>())
  const menu=useRef<{ferramenta:Ferramenta;pointerId:number;x0:number;y0:number;moveu:boolean}|null>(null)
  const ignorarClique=useRef(false),cameraAntes=useRef<Camera|null>(null),camAtual=useRef<Camera|null>(null)

  useEffect(()=>{
    if(initialEditorState){
      const loaded=carregarEditorState(initialEditorState)
      setSessoesPavimento(loaded.sessions);setAndarAtivo(loaded.activeFloor)
      return
    }
    const s0=initialSession??iniciar('leitura-'+crypto.randomUUID())
    setSessoesPavimento({0:s0});setAndarAtivo(0)
  },[initialSession,initialEditorState])

  const s=sessoesPavimento[andarAtivo]??null
  const setSession=(next:Session)=>{
    setSessoesPavimento(prev=>({...prev,[andarAtivo]:next}))
  }
  const pronto=s!==null
  const roomsTerreo=sessoesPavimento[0]?.present.rooms??[]

  function trocarPavimento(novoAndar:Floor){
    if(ocupado||novoAndar===andarAtivo) return
    if(!sessoesPavimento[novoAndar]){
      const s0=sessoesPavimento[0]
      const h=s0?.present.ceilingHeightMm??null
      const nova:Session={
        id:'leitura-'+crypto.randomUUID(),
        revision:1,
        nextId:1,
        nextOpeningId:1,
        nextFurnitureId:1,
        present:{rooms:[],openings:[],ceilingHeightMm:h,furniture:[]},
        past:[],
        future:[]
      }
      setSessoesPavimento(prev=>({...prev,[novoAndar]:nova}))
    }
    setAndarAtivo(novoAndar)
    setSel(null)
    setAberta(null)
    setAguardando(null)
    setCamera(null)
    setNotice(novoAndar===0?'Editando Pavimento Térreo.':'Editando Pavimento Superior.')
  }

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

  const rooms=s?.present.rooms??[]
  const walls=geometriaParedes(rooms)
  const cam=camera??enquadrar(rooms,tam.w,tam.h,roomsTerreo)
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

  useEffect(()=>{
    if(!htmlMaquete) return
    const url=URL.createObjectURL(new Blob([htmlMaquete],{type:'text/html'}))
    setBlobUrlMaquete(url)
    return ()=>{URL.revokeObjectURL(url)}
  },[htmlMaquete])

  useEffect(()=>{
    if(!modal3DAberto) return
    const anterior=document.activeElement as HTMLElement|null
    fecharMaquete.current?.focus()
    return ()=>anterior?.focus()
  },[modal3DAberto])

  if(!s) return <p className="p-6">Preparando a planta local…</p>

  const shown=rooms.map(r=>preview?.id===r.id?{...r,...preview}:r)
  const openingsExibidas=(s?.present.openings??[]).map(o=>previewAbertura?.id===o.id?{...o,offsetMm:previewAbertura.offsetMm}:o)
  const issues=problemas({...s.present,rooms:shown,openings:openingsExibidas})
  const invalidIds=new Set(issues.flatMap(e=>e.ids))
  const json=problemas(s.present).length?'':exportar(s)
  const selecao=sel&&(sel.tipo==='comodo'?rooms.some(r=>r.id===sel.id):sel.tipo==='abertura'?s.present.openings.some(o=>o.id===sel.id):(s.present.furniture??[]).some(f=>f.id===sel.id))?sel:null
  const ocupado=!!preview||!!previewAbertura||!!previewMovel||!!arrasteMenu||saving||openingProject||gerando3D||(!!aberta&&aberta.tipo!=='status'&&aberta.tipo!=='catalogo-moveis')

  function caixaEditada():[number,number,number,number]|null{
    if(!aberta) return null
    if(aberta.tipo==='comodo-novo'){
      const w=rascComodo?.widthMm??aberta.inicial?.widthMm??3000,d=rascComodo?.depthMm??aberta.inicial?.depthMm??3000
      return [aberta.em.x-w/2,aberta.em.y-d/2,aberta.em.x+w/2,aberta.em.y+d/2]
    }
    if(aberta.tipo==='comodo-poligono'){
      const minX=Math.min(...aberta.retangulos.map(r=>r.xMm)), maxX=Math.max(...aberta.retangulos.map(r=>r.xMm+r.widthMm))
      const minY=Math.min(...aberta.retangulos.map(r=>r.yMm)), maxY=Math.max(...aberta.retangulos.map(r=>r.yMm+r.depthMm))
      return [minX,minY,maxX,maxY]
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
    const par=parDaAbertura(rooms,o,s!.present.mergedGroups)
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
    if(!a) return
    if(a.tipo==='comodo') abrir({tipo:'comodo',id:a.id})
    else if(a.tipo==='abertura') abrir({tipo:'abertura',id:a.id})
  }
  function adicionarMovel(def:DefinicaoMovel){
    let xMm=pontoInserirMovel?.x??Math.round(cam.cx/50)*50
    let yMm=pontoInserirMovel?.y??Math.round(cam.cy/50)*50
    if(!pontoInserirMovel&&selecao?.tipo==='comodo'){
      const r=rooms.find(rm=>rm.id===selecao.id)
      if(r){
        xMm=Math.round((r.xMm+r.widthMm/2)/50)*50
        yMm=Math.round((r.yMm+r.depthMm/2)/50)*50
      }
    }
    xMm=Math.round(xMm/50)*50
    yMm=Math.round(yMm/50)*50
    const nextFId=s!.nextFurnitureId??1
    const next=aplicar(s!,{
      type:'furniture-add',
      item:{
        tipoCatalogo:def.id,
        tipo3D:def.tipo3D,
        nome:def.nome,
        widthMm:def.widthMm,
        depthMm:def.depthMm,
        alturaMm:def.alturaMm,
        xMm,
        yMm,
        rotDegrees:0,
        cor:def.corPadrao
      }
    })
    setSession(next)
    setSel({tipo:'movel',id:'m'+nextFId})
    setPontoInserirMovel(null)
    setNotice(`${def.nome} adicionado. Arraste para posicionar ou gire 90°.`)
  }
  function girarMovel(id:string){
    try{
      const next=aplicar(s!,{type:'furniture-rotate',id,deltaDegrees:90})
      setSession(next)
      navigator.vibrate?.(10)
      const m=next.present.furniture?.find(f=>f.id===id)
      setNotice(`${m?.nome??'Móvel'} girado para ${m?.rotDegrees??0}°.`)
    }catch(e){
      setNotice((e as Error).message)
    }
  }
  function excluirMovel(id:string){
    try{
      const nome=s!.present.furniture?.find(f=>f.id===id)?.nome??'Móvel'
      const next=aplicar(s!,{type:'furniture-delete',id})
      setSession(next)
      setSel(null)
      navigator.vibrate?.(15)
      setNotice(`${nome} removido.`)
    }catch(e){
      setNotice((e as Error).message)
    }
  }
  function nudgeMovel(id:string,dxMm:number,dyMm:number){
    try{
      const m=s!.present.furniture?.find(f=>f.id===id)
      if(!m) return
      const next=aplicar(s!,{type:'furniture-move',id,xMm:m.xMm+dxMm,yMm:m.yMm+dyMm})
      setSession(next)
    }catch(e){
      setNotice((e as Error).message)
    }
  }
  function soltar(f:Ferramenta,p:Ponto){
    if(f==='movel'){
      setPontoInserirMovel({x:Math.round(p.x/50)*50,y:Math.round(p.y/50)*50})
      abrir({tipo:'catalogo-moveis'})
      return
    }
    if(f==='parede'){
      setSel(null)
      setCaminhoParedes([{x:Math.round(p.x/50)*50,y:Math.round(p.y/50)*50}])
      setRascunhoParede(null)
      setAguardando('parede')
      setNotice('Ponto inicial fixado. Arraste ou toque na planta para traçar a primeira parede.')
      return
    }
    if(f==='quadrado'||f==='retangulo'){abrir({tipo:'comodo-novo',forma:f,em:p,tol:ENCAIXE_SOLTAR_PX*mmPorPx});return}
    if(f==='escada'){abrir({tipo:'comodo-novo',forma:'retangulo',em:p,tol:ENCAIXE_SOLTAR_PX*mmPorPx,inicial:{name:'Escada',widthMm:1000,depthMm:2800}});return}
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
    if(f==='movel'){
      setPontoInserirMovel(null)
      abrir({tipo:'catalogo-moveis'})
      return
    }
    if(f==='parede'){
      setSel(null)
      setCaminhoParedes([])
      setRascunhoParede(null)
      setAguardando(aguardando==='parede'?null:'parede')
      setNotice(aguardando==='parede'?'':'Modo Parede: arraste ou toque para traçar as paredes. Feche no início.')
      return
    }
    if(f==='quadrado'||f==='retangulo'){abrir({tipo:'comodo-novo',forma:f,em:{x:cam.cx,y:cam.cy},tol:ENCAIXE_SOLTAR_PX*mmPorPx});return}
    if(f==='escada'){abrir({tipo:'comodo-novo',forma:'retangulo',em:{x:cam.cx,y:cam.cy},tol:ENCAIXE_SOLTAR_PX*mmPorPx,inicial:{name:'Escada',widthMm:1000,depthMm:2800}});return}
    const kind=f==='porta'?'door':'window'
    if(!rooms.length){setNotice('Coloque um cômodo antes d'+(kind==='door'?'a porta':'a janela')+'.');return}
    setSel(null);setAguardando(aguardando===kind?null:kind)
  }
  function menuDescer(e:RPE<HTMLButtonElement>,f:Ferramenta){
    ignorarClique.current=false
    if(ocupado||(e.pointerType==='mouse'&&e.button!==0)) return
    const el=e.currentTarget
    el.setPointerCapture(e.pointerId)
    menu.current={ferramenta:f,pointerId:e.pointerId,x0:e.clientX,y0:e.clientY,moveu:false}
  }
  function menuMover(e:RPE<HTMLButtonElement>){
    const m=menu.current
    if(!m||m.pointerId!==e.pointerId) return
    if(!m.moveu&&Math.hypot(e.clientX-m.x0,e.clientY-m.y0)>=FOLGA_PX) m.moveu=true
    if(!m.moveu) return
    const p=dentroDaPlanta(e.clientX,e.clientY)
    const achou=(m.ferramenta==='porta'||m.ferramenta==='janela')&&p?paredeProxima(rooms,p.x,p.y,PAREDE_PX*mmPorPx):null
    setArrasteMenu({ferramenta:m.ferramenta,x:e.clientX,y:e.clientY,parede:achou?.wall.id??null})
  }
  function menuSoltar(e:RPE<HTMLButtonElement>,cancelar=false){
    const m=menu.current
    if(!m||m.pointerId!==e.pointerId) return
    if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    const moveu=m.moveu,f=m.ferramenta
    menu.current=null;setArrasteMenu(null)
    if(!moveu) return
    ignorarClique.current=true
    if(cancelar) return
    const p=dentroDaPlanta(e.clientX,e.clientY)
    if(p) soltar(f,p)
  }

  function aoDescer(e:RPE<SVGSVGElement>){
    if(ocupado||(e.pointerType==='mouse'&&e.button!==0)) return
    if(aguardando==='parede'){
      svg.current?.setPointerCapture(e.pointerId)
      ponteiros.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
      const p=aoPlano(e.clientX,e.clientY)
      if(!p) return
      let pSnap: Ponto
      if(caminhoParedes.length > 0){
        pSnap = caminhoParedes[caminhoParedes.length - 1]
      }else{
        let sx=Math.round(p.x/50)*50, sy=Math.round(p.y/50)*50
        const allW = [...walls, ...(andarAtivo===1 ? geometriaParedes(roomsTerreo) : [])]
        for(const w of allW){
          if(w.axis==='x'&&Math.abs(sy-w.fixed)<=150) sy=w.fixed
          if(w.axis==='y'&&Math.abs(sx-w.fixed)<=150) sx=w.fixed
        }
        pSnap={x:sx,y:sy}
      }
      gesto.current={tipo:'desenho-parede',pointerId:e.pointerId,p0:pSnap,pAtual:pSnap}
      setRascunhoParede({p0:pSnap,p1:pSnap,clientX:e.clientX,clientY:e.clientY,lenMm:0})
      return
    }
    svg.current?.setPointerCapture(e.pointerId)
    ponteiros.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    if(ponteiros.current.size===2){comecarPinca();return}
    if(ponteiros.current.size>2) return
    const p=aoPlano(e.clientX,e.clientY)
    if(!p) return
    const el=document.elementFromPoint(e.clientX,e.clientY)
    const idMovel=el?.closest?.('[data-movel]')?.getAttribute('data-movel')
    const idComodo=el?.closest?.('[data-comodo]')?.getAttribute('data-comodo')
    const idAbertura=el?.closest?.('[data-abertura]')?.getAttribute('data-abertura')
    const idParede=el?.closest?.('[data-parede]')?.getAttribute('data-parede')
    const alvo:Alvo=idMovel?{tipo:'movel',id:idMovel}:idAbertura?{tipo:'abertura',id:idAbertura}:idComodo?{tipo:'comodo',id:idComodo}:idParede?{tipo:'parede',id:idParede}:null
    if(idMovel) setSel({tipo:'movel',id:idMovel})
    else if(idAbertura) setSel({tipo:'abertura',id:idAbertura})
    const timer=window.setTimeout(()=>toqueLongo(),TOQUE_LONGO)
    gesto.current={tipo:'pressao',pointerId:e.pointerId,x0:e.clientX,y0:e.clientY,alvo,p0:p,timer}
  }
  function toqueLongo(){
    const g=gesto.current
    if(g.tipo!=='pressao') return
    gesto.current={tipo:'nada'}
    const a=g.alvo
    if(aberta||aguardando||!a||a.tipo==='parede') return
    navigator.vibrate?.(12)
    if(selecao?.tipo===a.tipo&&selecao.id===a.id){
      if(a.tipo==='abertura') focarAbertura(a.id)
      else if(a.tipo==='comodo') editar(a)
    }else{
      setSel(a)
      setNotice(a.tipo==='abertura'?'Abertura selecionada. Use as setinhas ou arraste na parede.':a.tipo==='movel'?'Móvel selecionado. Arraste ou use o giro 90°.':'Selecionado. Mantenha pressionado de novo para editar.')
    }
  }
  function aoMover(e:RPE<SVGSVGElement>){
    if(!ponteiros.current.has(e.pointerId)) return
    ponteiros.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    const g=gesto.current
    if(g.tipo==='desenho-parede'&&g.pointerId===e.pointerId){
      const p=aoPlano(e.clientX,e.clientY)
      if(!p) return
      const dx=p.x-g.p0.x, dy=p.y-g.p0.y
      let sx:number, sy:number
      if(Math.abs(dx)>=Math.abs(dy)){
        sx=Math.round(p.x/50)*50
        sy=g.p0.y
      }else{
        sx=g.p0.x
        sy=Math.round(p.y/50)*50
      }
      const allW=[...walls, ...(andarAtivo===1 ? geometriaParedes(roomsTerreo) : [])]
      for(const w of allW){
        if(w.axis==='x'&&Math.abs(sy-w.fixed)<=150) sy=w.fixed
        if(w.axis==='y'&&Math.abs(sx-w.fixed)<=150) sx=w.fixed
      }
      let fecharAgora=false
      if(caminhoParedes.length>=3){
        const pInicio=caminhoParedes[0]
        if(Math.hypot(sx-pInicio.x,sy-pInicio.y)<=250){
          sx=pInicio.x
          sy=pInicio.y
          fecharAgora=true
        }
      }
      setFecharSugerido(fecharAgora)
      const pSnap={x:sx,y:sy}
      const lenMm=Math.round(Math.hypot(pSnap.x-g.p0.x,pSnap.y-g.p0.y))
      g.pAtual=pSnap
      setRascunhoParede({p0:g.p0,p1:pSnap,clientX:e.clientX,clientY:e.clientY,lenMm})

      if(lenMm>=500){
        const perpDist=Math.abs(dx)>=Math.abs(dy)?Math.abs(dy):Math.abs(dx)
        if(perpDist>=300){
          setCaminhoParedes(prev=>{
            const base=prev.length?prev:[g.p0]
            return [...base,pSnap]
          })
          g.p0=pSnap
        }
      }
      return
    }
    if(g.tipo==='pinca'){moverPinca(g);return}
    if(g.tipo==='pan'){
      if(g.pointerId===e.pointerId) moverPan(g, e)
      return
    }
    if(g.tipo==='pressao'&&g.pointerId===e.pointerId){
      if(Math.hypot(e.clientX-g.x0,e.clientY-g.y0)<FOLGA_PX) return
      clearTimeout(g.timer)
      const room=g.alvo?.tipo==='comodo'&&!aberta&&!aguardando?rooms.find(r=>r.id===g.alvo!.id):undefined
      const opening=g.alvo?.tipo==='abertura'&&!aberta&&!aguardando?s!.present.openings.find(o=>o.id===g.alvo!.id):undefined
      const movel=g.alvo?.tipo==='movel'&&!aberta&&!aguardando?(s!.present.furniture??[]).find(f=>f.id===g.alvo!.id):undefined
      if(movel){
        setSel({tipo:'movel',id:movel.id})
        gesto.current={tipo:'arraste-movel',pointerId:e.pointerId,movel,p0:g.p0,pos0:{xMm:movel.xMm,yMm:movel.yMm},posAtual:{xMm:movel.xMm,yMm:movel.yMm}}
        setPreviewMovel({id:movel.id,xMm:movel.xMm,yMm:movel.yMm})
      }else if(room){
        setSel({tipo:'comodo',id:room.id})
        gesto.current={tipo:'arraste',pointerId:e.pointerId,room,p0:g.p0,pos:{xMm:room.xMm,yMm:room.yMm}}
      }else if(opening){
        const w=walls.find(w=>w.id===opening.wallId)
        if(w){
          setSel({tipo:'abertura',id:opening.id})
          gesto.current={tipo:'arraste-abertura',pointerId:e.pointerId,opening,wall:w,p0:g.p0,offset0:opening.offsetMm,offsetAtual:opening.offsetMm}
          setPreviewAbertura({id:opening.id,offsetMm:opening.offsetMm,wallId:w.id})
          setBadgeAbertura({clientX:e.clientX,clientY:e.clientY,offsetMm:opening.offsetMm,widthMm:opening.widthMm})
        }
      }else{
        gesto.current={tipo:'pan',pointerId:e.pointerId,cam0:cam,x0:g.x0,y0:g.y0}
        moverPan(gesto.current, e)
      }
      return
    }
    if(g.tipo==='arraste-movel'&&g.pointerId===e.pointerId){
      const p=aoPlano(e.clientX,e.clientY)
      if(!p) return
      const dx=p.x-g.p0.x, dy=p.y-g.p0.y
      const rawX=g.pos0.xMm+dx, rawY=g.pos0.yMm+dy
      const snapX=Math.round(rawX/50)*50, snapY=Math.round(rawY/50)*50
      g.posAtual={xMm:snapX,yMm:snapY}
      setPreviewMovel({id:g.movel.id,xMm:snapX,yMm:snapY})
      return
    }
    if(g.tipo==='arraste-abertura'&&g.pointerId===e.pointerId){
      const p=aoPlano(e.clientX,e.clientY)
      if(!p) return
      const w=g.wall
      const deltaAlongWall=w.axis==='x'?(p.x-g.p0.x):(p.y-g.p0.y)
      const rawOffset=g.offset0+deltaAlongWall
      const snappedOffset=Math.round(rawOffset/50)*50
      const maxOffset=Math.max(0,(w.end-w.start)-g.opening.widthMm)
      const boundedOffset=Math.max(0,Math.min(maxOffset,snappedOffset))
      g.offsetAtual=boundedOffset
      setPreviewAbertura({id:g.opening.id,offsetMm:boundedOffset,wallId:w.id})
      setBadgeAbertura({clientX:e.clientX,clientY:e.clientY,offsetMm:boundedOffset,widthMm:g.opening.widthMm})
      return
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
  function moverPan(g:Extract<Gesto,{tipo:'pan'}>, e:RPE<SVGSVGElement>){
    const r=plano.current?.getBoundingClientRect()
    if(!r) return
    setCamera(zoomEm(g.cam0, r, {x:g.x0, y:g.y0}, {x:e.clientX, y:e.clientY}, g.cam0.w))
  }
  function aoSubir(e:RPE<SVGSVGElement>,cancelar=false){
    if(!ponteiros.current.delete(e.pointerId)) return
    if(svg.current?.hasPointerCapture(e.pointerId)) svg.current.releasePointerCapture(e.pointerId)
    const g=gesto.current
    if(g.tipo==='arraste-movel'&&g.pointerId===e.pointerId){
      gesto.current={tipo:'nada'}
      setPreviewMovel(null)
      if(!cancelar&&(g.posAtual.xMm!==g.movel.xMm||g.posAtual.yMm!==g.movel.yMm)){
        try{
          const next=aplicar(s!,{
            type:'furniture-move',
            id:g.movel.id,
            xMm:g.posAtual.xMm,
            yMm:g.posAtual.yMm
          })
          setSession(next)
          navigator.vibrate?.(10)
          setNotice(`${g.movel.nome} posicionado em (${metros(g.posAtual.xMm)}, ${metros(g.posAtual.yMm)}) m.`)
        }catch(err){
          setNotice((err as Error).message)
        }
      }
      return
    }
    if(g.tipo==='arraste-abertura'&&g.pointerId===e.pointerId){
      gesto.current={tipo:'nada'}
      setPreviewAbertura(null)
      setBadgeAbertura(null)
      if(!cancelar&&g.offsetAtual!==g.opening.offsetMm){
        try{
          const next=aplicar(s!,{
            type:'opening-edit',
            id:g.opening.id,
            kind:g.opening.kind,
            wallId:g.opening.wallId,
            offsetMm:g.offsetAtual,
            widthMm:g.opening.widthMm,
            heightMm:g.opening.heightMm,
            sillMm:g.opening.sillMm
          })
          setSession(next)
          navigator.vibrate?.(10)
          setNotice(`${g.opening.kind==='door'?'Porta':'Janela'} posicionada a ${metros(g.offsetAtual)} m do canto.`)
        }catch(err){
          setNotice((err as Error).message)
        }
      }
      return
    }
    if(g.tipo==='desenho-parede'&&g.pointerId===e.pointerId){
      gesto.current={tipo:'nada'}
      setRascunhoParede(null)
      setFecharSugerido(false)
      if(!cancelar){
        const len=Math.round(Math.hypot(g.pAtual.x-g.p0.x,g.pAtual.y-g.p0.y))
        const pInicio=caminhoParedes[0]
        const ehFechamento=caminhoParedes.length>=3&&pInicio&&(
          (g.pAtual.x===pInicio.x&&g.pAtual.y===pInicio.y)||
          Math.hypot(g.pAtual.x-pInicio.x,g.pAtual.y-pInicio.y)<=250
        )
        if(ehFechamento){
          concluirPoligono([...caminhoParedes])
          return
        }
        if(len>=250){
          setCaminhoParedes(prev=>{
            const base=prev.length?prev:[g.p0]
            const novo=[...base,g.pAtual]
            setNotice(`Parede de ${metros(len)} m traçada (${novo.length - 1} parede${novo.length > 2 ? 's' : ''}). Continue ou feche no início.`)
            return novo
          })
        }else if(!caminhoParedes.length){
          setNotice('Arraste o dedo para traçar a parede.')
        }
      }
      return
    }
    if(g.tipo==='pinca'){
      if(ponteiros.current.size===1){
        const [pId, p]=[...ponteiros.current.entries()][0]
        gesto.current={tipo:'pan',pointerId:pId,cam0:cam,x0:p.x,y0:p.y}
      }else if(!ponteiros.current.size){
        gesto.current={tipo:'nada'}
      }
      return
    }
    if(g.tipo==='pan'&&g.pointerId===e.pointerId){
      gesto.current={tipo:'nada'}
      return
    }
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
      if(aguardando==='parede') return
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
  function nudgeAbertura(id:string,deltaMm:number){
    const o=s!.present.openings.find(x=>x.id===id)
    if(!o) return
    const w=walls.find(w=>w.id===o.wallId)
    if(!w) return
    const maxOffset=Math.max(0,(w.end-w.start)-o.widthMm)
    const novoOffset=Math.max(0,Math.min(maxOffset,o.offsetMm+deltaMm))
    if(novoOffset===o.offsetMm){
      setNotice('Limite da parede atingido.')
      return
    }
    try{
      const next=aplicar(s!,{
        type:'opening-edit',
        id:o.id,
        kind:o.kind,
        wallId:o.wallId,
        offsetMm:novoOffset,
        widthMm:o.widthMm,
        heightMm:o.heightMm,
        sillMm:o.sillMm
      })
      setSession(next)
      navigator.vibrate?.(10)
      setNotice(`Cota: ${metros(novoOffset)} m do canto (${deltaMm>0?'+':''}${deltaMm/10} cm).`)
    }catch(err){
      setNotice((err as Error).message)
    }
  }
  function ajustarLarguraAbertura(id:string,deltaMm:number){
    const o=s!.present.openings.find(x=>x.id===id)
    if(!o) return
    const w=walls.find(w=>w.id===o.wallId)
    if(!w) return
    const maxLargura=(w.end-w.start)-o.offsetMm
    const novaLargura=Math.max(400,Math.min(maxLargura,o.widthMm+deltaMm))
    if(novaLargura===o.widthMm){
      setNotice(deltaMm<0?'Largura mínima atingida (0,40 m).':'Largura máxima para este trecho da parede atingida.')
      return
    }
    try{
      const next=aplicar(s!,{
        type:'opening-edit',
        id:o.id,
        kind:o.kind,
        wallId:o.wallId,
        offsetMm:o.offsetMm,
        widthMm:novaLargura,
        heightMm:o.heightMm,
        sillMm:o.sillMm
      })
      setSession(next)
      navigator.vibrate?.(10)
      setNotice(`Largura ajustada para ${metros(novaLargura)} m.`)
    }catch(err){
      setNotice((err as Error).message)
    }
  }
  function alternarTipoAbertura(id:string){
    const o=s!.present.openings.find(x=>x.id===id)
    if(!o) return
    const novoKind:'door'|'window'=o.kind==='door'?'window':'door'
    const novoHeight=novoKind==='door'?2100:1000
    const novoSill=novoKind==='door'?0:1100
    try{
      const next=aplicar(s!,{
        type:'opening-edit',
        id:o.id,
        kind:novoKind,
        wallId:o.wallId,
        offsetMm:o.offsetMm,
        widthMm:o.widthMm,
        heightMm:novoHeight,
        sillMm:novoSill
      })
      setSession(next)
      navigator.vibrate?.(10)
      setNotice(`Alterado para ${novoKind==='door'?'Porta':'Janela'}.`)
    }catch(err){
      setNotice((err as Error).message)
    }
  }
  function excluirAbertura(id:string){
    try{
      const next=aplicar(s!,{type:'opening-delete',id})
      setSession(next)
      setSel(null)
      setNotice('Abertura excluída. Desfazer reverte a ação.')
    }catch(err){
      setNotice((err as Error).message)
    }
  }
  function focarAbertura(id:string){
    const o=s!.present.openings.find(x=>x.id===id)
    if(!o) return
    const w=walls.find(w=>w.id===o.wallId)
    if(!w) return
    const meio=w.start+o.offsetMm+o.widthMm/2
    const cx=w.axis==='x'?meio:w.fixed
    const cy=w.axis==='x'?w.fixed:meio
    setCamera({cx,cy,w:2600})
    setNotice('Focado na abertura. Use as setinhas ou arraste na parede.')
  }
  function historia(redo=false){
    setSession(redo?refazer(s!):desfazer(s!));setSel(null);setNotice(redo?'Ação refeita.':'Ação desfeita.')
  }
  function download(pavimento = andarAtivo){
    const sess = sessoesPavimento[pavimento]
    if(!sess) return
    const j = problemas(sess.present).length ? '' : exportar(sess)
    if(!j||ocupado) return
    const multi = (sessoesPavimento[0]?.present.rooms.length > 0 && sessoesPavimento[1]?.present.rooms.length > 0)
    const nome = multi ? (pavimento === 0 ? 'leitura-terreo.json' : 'leitura-superior.json') : 'leitura.json'
    const url=URL.createObjectURL(new Blob([j],{type:'application/json'}))
    const a=document.createElement('a');a.href=url;a.download=nome;a.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Download de '+nome+' iniciado.')
  }
  function baixarProjeto(){
    if(ocupado) return
    try{
      const j=exportarEditor(sessoesPavimento,andarAtivo)
      const url=URL.createObjectURL(new Blob([j],{type:'application/json'}))
      const a=document.createElement('a');a.href=url;a.download='projeto-planta.json';a.click()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
      setNotice('Projeto completo baixado: pavimentos, móveis e andar ativo.')
    }catch(e){setSaveError((e as Error).message)}
  }
  async function abrirProjeto(file?:File){
    if(!file||ocupado) return
    setSaveError('');setOpeningProject(true)
    try{
      if(file.size>1024*1024) throw new Error('Use um projeto de até 1 MiB.')
      const loaded=carregarEditorState(JSON.parse(await file.text()))
      setSessoesPavimento(loaded.sessions);setAndarAtivo(loaded.activeFloor)
      setSel(null);setAberta(null);setCamera(null);setAguardando(null)
      setHtmlMaquete('');setModal3DAberto(false)
      setNotice('Projeto aberto com seus pavimentos e móveis. A edição anterior foi substituída.')
    }catch(e){setSaveError((e as Error).message)}
    finally{setOpeningProject(false);if(arquivoProjeto.current) arquivoProjeto.current.value=''}
  }
  async function save(){
    if(!json||ocupado||!onSave) return
    setSaving(true);setSaveError('')
    try{await onSave(json,exportarEditor(sessoesPavimento,andarAtivo));setNotice('Versão salva com pavimentos e móveis. A leitura de produção corresponde ao andar ativo.')}
    catch(e){setSaveError((e as Error).message)}finally{setSaving(false)}
  }

  async function abrirMaquete3D(){
    if(!json||ocupado||gerando3D) return
    const pendentesBloqueantes=issues.filter(p=>p.code!=='EMPTY'&&p.code!=='HEIGHT_REQUIRED')
    if(pendentesBloqueantes.length>0){
      abrir({tipo:'status'})
      setNotice('Corrija os avisos da planta antes de gerar a maquete 3D.')
      return
    }
    setGerando3D(true)
    setNotice('Gerando prévia ilustrativa do andar ativo…')
    try{
      let html=''
      const moveisStr=exportarMoveis(s)
      if(onGerar3D){
        const res=await onGerar3D(json,moveisStr,andarAtivo)
        html=typeof res==='string'?res:res.html
      }else{
        const endpoint=process.env.NEXT_PUBLIC_READINGS_API_URL||''
        const res=await requisitarMaquete3D(endpoint,json,undefined,{moveisJson:moveisStr,demo:true})
        html=res.html
      }
      setHtmlMaquete(html)
      setFloorMaquete(andarAtivo)
      setModal3DAberto(true)
      setNotice('Prévia ilustrativa gerada com os móveis do andar ativo.')
    }catch(err){
      setNotice('Falha na geração 3D: '+((err as Error).message||'Verifique o servidor.'))
    }finally{
      setGerando3D(false)
    }
  }


  function concluirPoligono(vertices: Ponto[]){
    if(vertices.length < 4){
      setNotice('O cômodo precisa de pelo menos 4 paredes para fechar.')
      return
    }
    const retangulos = decomporPoligonoOrtogonal(vertices)
    if(!retangulos.length){
      setNotice('Não foi possível fechar: paredes precisam ser ortogonais e sem cruzamentos.')
      return
    }
    let areaMm2 = 0
    for(const r of retangulos) areaMm2 += r.widthMm * r.depthMm
    let perimetroMm = 0
    for(let i=0; i<vertices.length; i++){
      const next = vertices[(i+1)%vertices.length]
      perimetroMm += Math.round(Math.hypot(next.x - vertices[i].x, next.y - vertices[i].y))
    }
    setCaminhoParedes([])
    setAguardando(null)
    setRascunhoParede(null)
    abrir({
      tipo: 'comodo-poligono',
      retangulos,
      perimetroMm,
      areaMm2,
      inicial: { name: '' }
    })
  }

  function fecharContorno(){
    if(caminhoParedes.length < 3) return
    const pInicio = caminhoParedes[0]
    const pFim = caminhoParedes[caminhoParedes.length - 1]
    const vertices = [...caminhoParedes]
    if(pFim.x !== pInicio.x && pFim.y !== pInicio.y){
      vertices.push({ x: pFim.x, y: pInicio.y })
    }
    concluirPoligono(vertices)
  }

  function desfazerTrecho(){
    setCaminhoParedes(prev => {
      const next = prev.slice(0, -1)
      if(next.length <= 1){
        setNotice('Primeiro trecho desfeito. Inicie a primeira parede.')
        return []
      }
      setNotice(`Último trecho desfeito (${next.length - 1} parede(s) restante(s)).`)
      return next
    })
  }

  function cancelarParede(){
    setCaminhoParedes([])
    setAguardando(null)
    setRascunhoParede(null)
    setNotice('Desenho de parede cancelado.')
  }

  function conteudoDaFolha():{titulo:string;corpo:ReactNode}|null{
    if(!aberta) return null
    if(aberta.tipo==='status'){
      const multi=(sessoesPavimento[0]?.present.rooms.length>0 && sessoesPavimento[1]?.present.rooms.length>0)
      return {titulo:'Projeto e leitura',corpo:<div className={styles.form}>
        <div className={styles.acoes}>
          <button type="button" disabled={ocupado} onClick={()=>arquivoProjeto.current?.click()}>Abrir projeto</button>
          <button type="button" disabled={ocupado} className={styles.primario} onClick={baixarProjeto}>Baixar projeto completo</button>
        </div>
        <p className={styles.dica}>O projeto completo preserva pavimentos, móveis e andar ativo. Abrir outro projeto substitui a edição atual.</p>
        {issues.length?<ul className={styles.alerta}>{issues.map((p,i)=><li key={i}>{p.message}</li>)}</ul>
          :<p>Planta do {andarAtivo===0?'Térreo':'Superior'} sem bloqueios locais.</p>}
        {multi&&<div className={styles.acoes} style={{margin:'6px 0'}}>
          <button type="button" onClick={()=>download(0)}>Baixar leitura do térreo</button>
          <button type="button" onClick={()=>download(1)}>Baixar leitura do superior</button>
        </div>}
        {!multi&&<button type="button" disabled={!json} onClick={()=>download()}>Baixar leitura do andar</button>}
        <p className={styles.dica}>A leitura contém somente a arquitetura de um andar, sem os móveis. A prévia 3D também mostra um andar por vez.</p>
        <p className={styles.dica}>Medidas entre eixos das paredes. {onSave?'As alterações ficam nesta aba até você salvar a versão.'
          :'Somente nesta aba: baixe o projeto completo antes de sair; recarregar apaga o trabalho.'}</p>
        <details><summary>Ver JSON ({andarAtivo===0?'Térreo':'Superior'})</summary>{json?<textarea aria-label="JSON da planta" readOnly value={json} rows={10}/>
          :<p className={styles.dica}>Corrija os avisos para gerar o arquivo.</p>}</details>
      </div>}
    }
    if(aberta.tipo==='comodo-poligono'){
      const areaM2 = aberta.areaMm2 / 1000000
      const perimetroM = aberta.perimetroMm / 1000
      return {
        titulo: 'Novo cômodo personalizado',
        corpo: <FormComodo
          forma="poligono"
          inicial={{ name: aberta.inicial?.name ?? '', widthMm: 0, depthMm: 0 }}
          poligonoInfo={{ paredes: aberta.retangulos.length * 2 + 2, areaM2, perimetroM }}
          peDireito={s!.present.ceilingHeightMm}
          pedirPeDireito={s!.present.ceilingHeightMm === null}
          onRascunho={() => {}}
          onConfirmar={m => {
            try {
              const next = aplicar(s!, {
                type: 'add-poligono',
                name: m.name,
                ceilingHeightMm: m.ceilingHeightMm,
                retangulos: aberta.retangulos
              })
              fechar()
              setSession(next)
              setNotice(avisoDoPar(next) || `Cômodo personalizado criado: ${m.name.trim()} (${areaM2.toFixed(1).replace('.', ',')} m²).`)
            } catch(e) {
              setNotice((e as Error).message)
            }
          }}
          onCancelar={fechar}
        />
      }
    }
    if(aberta.tipo==='comodo-novo'){
      const confirmar=(m:MedidasComodo)=>{
        const pos=posicaoSolta(aberta.em,m.widthMm,m.depthMm,aberta.tol)
        const next=aplicar(s!,{type:'add',...m,...pos})
        fechar();setSession(next);setSel({tipo:'comodo',id:'c'+s!.nextId})
        setNotice(avisoDoPar(next)||'Cômodo adicionado: '+m.name.trim()+'.')
      }
      const ini=aberta.inicial?{
        name:aberta.inicial.name??'',
        widthMm:aberta.inicial.widthMm??3000,
        depthMm:aberta.inicial.depthMm??(aberta.forma==='quadrado'?aberta.inicial.widthMm??3000:3000)
      }:undefined
      const tit=aberta.inicial?.name?('Novo: '+aberta.inicial.name):aberta.forma==='quadrado'?'Novo cômodo quadrado':'Novo cômodo'
      return {titulo:tit,corpo:<FormComodo forma={aberta.forma} inicial={ini}
        peDireito={s!.present.ceilingHeightMm} pedirPeDireito={s!.present.ceilingHeightMm===null}
        onRascunho={setRascComodo} onConfirmar={confirmar} onCancelar={fechar}/>}
    }
    if(aberta.tipo==='comodo'){
      const room=rooms.find(r=>r.id===aberta.id)
      if(!room) return null

      const rels = relacoes(rooms, s!.present.mergedGroups)
      const grupoIds = grupoDoComodo(s!.present.mergedGroups, room.id).concat(room.id)
      const wallsDoGrupo = new Set(grupoIds.flatMap(id => Object.values(paredes(id))))
      const vizinhosAdjacentes = rels
        .filter(r => (wallsDoGrupo.has(r.wallA) || wallsDoGrupo.has(r.wallB)) && r.kind === 'adjacent')
        .map(r => {
          const otherWall = wallsDoGrupo.has(r.wallA) ? r.wallB : r.wallA
          const otherRoomId = walls.find(w => w.id === otherWall)!.roomId
          const otherRoom = rooms.find(rm => rm.id === otherRoomId)!
          return { id: otherRoom.id, name: otherRoom.name }
        })
        .filter(v => !grupoIds.includes(v.id))
      const vizinhosMesclaveis = Array.from(new Map(vizinhosAdjacentes.map(v => [v.id, v])).values())
      const partesMescladas = grupoDoComodo(s!.present.mergedGroups, room.id)
        .map(id => rooms.find(r => r.id === id)!)
        .filter(Boolean)
        .map(r => ({ id: r.id, name: r.name }))

      return {titulo:'Editar '+room.name,corpo:<FormComodo forma="retangulo" inicial={room}
        peDireito={s!.present.ceilingHeightMm} pedirPeDireito onRascunho={setRascComodo}
        vizinhosMesclaveis={vizinhosMesclaveis} partesMescladas={partesMescladas}
        onMesclar={vizinhoId => {
          try {
            const next = aplicar(s!, { type: 'merge', roomAId: room.id, roomBId: vizinhoId })
            fechar()
            setSession(next)
            setNotice(avisoDoPar(next) || `Cômodos mesclados em um só: ${room.name}. Parede divisória removida.`)
          } catch(e) {
            setNotice((e as Error).message)
          }
        }}
        onSeparar={() => {
          try {
            const next = aplicar(s!, { type: 'unmerge', roomId: room.id })
            fechar()
            setSession(next)
            setNotice(avisoDoPar(next) || `Cômodo ${room.name} separado.`)
          } catch(e) {
            setNotice((e as Error).message)
          }
        }}
        onConfirmar={m=>{const next=aplicar(s!,{type:'edit',id:room.id,...m});fechar();setSession(next)
          setNotice(avisoDoPar(next)||'Medidas aplicadas.')}}
        onExcluir={()=>{const next=aplicar(s!,{type:'delete',id:room.id});fechar();setSession(next);setSel(null)
          setNotice(avisoDoPar(next)||'Cômodo excluído. Você pode desfazer.')}} onCancelar={fechar}>
        <div className={styles.posicao}><span>Posição: x {metros(room.xMm)} • y {metros(room.yMm)} m</span>
          <div role="group" aria-label="Mover em passos de 10 cm">
            <button type="button" aria-label="Mover à esquerda 10 cm" onClick={()=>step(room,-100,0)}>←</button>
            <button type="button" aria-label="Mover acima 10 cm" onClick={()=>step(room,0,100)}>↑</button>
            <button type="button" aria-label="Mover abaixo 10 cm" onClick={()=>step(room,0,-100)}>↓</button>
            <button type="button" aria-label="Mover à direita 10 cm" onClick={()=>step(room,100,0)}>→</button>
          </div></div>
      </FormComodo>}
    }
    if(aberta.tipo==='catalogo-moveis'){
      return {
        titulo:'Móveis 2D Humanizados',
        corpo:<PainelMoveis onAdicionar={adicionarMovel} onFechar={fechar}/>
      }
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
  const dimNovo=rascComodo??(aberta?.tipo==='comodo-novo'&&aberta.inicial?{widthMm:aberta.inicial.widthMm??3000,depthMm:aberta.inicial.depthMm??3000}:null)
  const novo=aberta?.tipo==='comodo-novo'&&dimNovo?{...posicaoSolta(aberta.em,dimNovo.widthMm,dimNovo.depthMm,aberta.tol),...dimNovo}:null
  const redimensionado=aberta?.tipo==='comodo'&&rascComodo?rooms.find(r=>r.id===aberta.id):undefined
  const paredeDestaque=arrasteMenu?.parede??rascAbertura?.wallId??null
  const nomeSel=!selecao?'':selecao.tipo==='comodo'?(()=>{const r=rooms.find(r=>r.id===selecao.id)!
    return r.name+' • '+metros(r.widthMm)+' × '+metros(r.depthMm)+' m'})()
    :selecao.tipo==='abertura'?(()=>{const o=s.present.openings.find(o=>o.id===selecao.id)!
      return (o.kind==='door'?'Porta ':'Janela ')+metros(o.widthMm)+' m • '+(walls.find(w=>w.id===o.wallId)?.label??'')})()
    :(()=>{const f=(s.present.furniture??[]).find(f=>f.id===selecao.id)!
      return (f?.nome??'Móvel')+' • '+metros(f?.widthMm??0)+' × '+metros(f?.depthMm??0)+' m • '+(f?.rotDegrees??0)+'°'})()

  const pendentes=issues.filter(p=>p.code!=='EMPTY'&&p.code!=='HEIGHT_REQUIRED').length

  const gruposContornos = new Map<string, { pontos: [number, number][]; areaM2: number; centro: Ponto; rooms: Room[] }>()
  const idsEmGrupos = new Set<string>()

  if (s.present.mergedGroups) {
    for (const grupo of s.present.mergedGroups) {
      const rGroup = shown.filter(r => grupo.includes(r.id))
      if (rGroup.length >= 2) {
        const c = contornoPoligono(rGroup)
        if (c && c.length >= 4) {
          let area = 0
          for (const r of rGroup) area += (r.widthMm * r.depthMm) / 1000000
          const minX = Math.min(...c.map(p => p[0])), maxX = Math.max(...c.map(p => p[0]))
          const minY = Math.min(...c.map(p => p[1])), maxY = Math.max(...c.map(p => p[1]))
          const key = grupo[0]
          gruposContornos.set(key, {
            pontos: c,
            areaM2: area,
            centro: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
            rooms: rGroup
          })
          for (const r of rGroup) idsEmGrupos.add(r.id)
        }
      }
    }
  }

  return <div className={styles.app} aria-busy={saving||openingProject||gerando3D}>
    <input ref={arquivoProjeto} type="file" accept="application/json,.json" hidden
      aria-label="Arquivo do projeto de planta" onChange={e=>void abrirProjeto(e.target.files?.[0])}/>
    <div className={styles.barra} inert={saving||openingProject||gerando3D||modal3DAberto}>
      <button aria-label="Desfazer" title="Desfazer" disabled={!s.past.length||ocupado} onClick={()=>historia()}>
        {icone(<><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/></>)}</button>
      <button aria-label="Refazer" title="Refazer" disabled={!s.future.length||ocupado} onClick={()=>historia(true)}>
        {icone(<><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h4"/></>)}</button>
      <div className={styles.seletorPavimento} role="tablist" aria-label="Seletor de pavimento">
        <button type="button" role="tab" aria-selected={andarAtivo===0}
          className={andarAtivo===0?styles.tabPavimentoAtiva:styles.tabPavimento}
          onClick={()=>trocarPavimento(0)}>Térreo</button>
        <button type="button" role="tab" aria-selected={andarAtivo===1}
          className={andarAtivo===1?styles.tabPavimentoAtiva:styles.tabPavimento}
          onClick={()=>trocarPavimento(1)}>Superior</button>
      </div>
      <button className={rooms.length&&pendentes?styles.avisos:rooms.length?styles.pronta:styles.neutro}
        disabled={ocupado} onClick={()=>abrir({tipo:'status'})}>
        {!rooms.length?'Planta vazia':pendentes?pendentes+(pendentes===1?' aviso':' avisos'):'Pronta'}</button>
      <span className={styles.espaco}/>
      <button aria-label="Enquadrar a planta" title="Enquadrar a planta" disabled={ocupado} onClick={()=>setCamera(null)}>
        {icone(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>)}</button>
      <button type="button" className={styles.botao3D}
        aria-label="Gerar prévia 3D do andar ativo"
        title="Prévia ilustrativa da planta e móveis; não é um anúncio publicado"
        disabled={!json||ocupado||gerando3D}
        onClick={abrirMaquete3D}>
        {icone(<><path d="m21 16-9 5-9-5V8l9-5 9 5v8z"/><path d="m3.2 8.2 8.8 5.3 8.8-5.3M12 21V10.5"/></>)}
        <span>{gerando3D ? 'Gerando 3D…' : 'Prévia 3D'}</span>
      </button>
      {onSave&&<button className={styles.primario} disabled={!json||ocupado||gerando3D} onClick={save}>Salvar</button>}
      <button className={styles.primario} aria-label="Baixar projeto completo" title="Baixar projeto-planta.json com pavimentos e móveis"
        disabled={!json||ocupado||gerando3D} onClick={baixarProjeto}>{icone(<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>)}<span>Baixar</span></button>
    </div>
    <nav className={styles.menu} aria-label="Ferramentas da planta" inert={saving||openingProject||gerando3D||modal3DAberto} onContextMenu={e=>e.preventDefault()}>
      {FERRAMENTAS.map(f=><button key={f.id} type="button"
        aria-pressed={f.id==='porta'?aguardando==='door':f.id==='janela'?aguardando==='window':f.id==='parede'?aguardando==='parede':undefined}
        aria-label={f.rotulo+': arraste até a planta ou toque'} onPointerDown={e=>menuDescer(e,f.id)}
        onPointerMove={menuMover} onPointerUp={e=>menuSoltar(e)} onPointerCancel={e=>menuSoltar(e,true)}
        onClick={()=>tocarFerramenta(f.id)}>{f.desenho}<span>{f.rotulo}</span></button>)}
      <button type="button" disabled={ocupado} aria-label="Projeto: abrir ou baixar" onClick={()=>abrir({tipo:'status'})}>
        {icone(<><path d="M3 7V5h7l2 2h9v13H3z"/></>)}<span>Projeto</span></button>
    </nav>
    <div ref={plano} className={styles.plano} inert={saving||openingProject||gerando3D||modal3DAberto}>
      <svg ref={svg} className={styles.canvas} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        aria-label="Planta em escala: toque para selecionar, mantenha pressionado para editar, arraste para mover"
        onPointerDown={aoDescer} onPointerMove={aoMover} onPointerUp={e=>aoSubir(e)}
        onPointerCancel={e=>aoSubir(e,true)} onContextMenu={e=>e.preventDefault()}>
        <defs><pattern id="grade-planta" width="1000" height="1000" patternUnits="userSpaceOnUse">
          <path d="M 1000 0 L 0 0 0 1000" fill="none" stroke="#dbe2e8" strokeWidth="12"/>
        </pattern></defs>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grade-planta)"/>
        {andarAtivo === 1 && roomsTerreo.map(rTerreo => {
          const ehEscada = rTerreo.name.toLowerCase().includes('escada')
          if (ehEscada) {
            return (
              <g key={'vao-' + rTerreo.id} pointerEvents="none">
                <rect x={rTerreo.xMm} y={-rTerreo.yMm - rTerreo.depthMm} width={rTerreo.widthMm} height={rTerreo.depthMm}
                  fill="rgba(254, 243, 199, 0.45)" stroke="#d97706" strokeWidth="2.5" strokeDasharray="8 4" vectorEffect="non-scaling-stroke"/>
                <line x1={rTerreo.xMm} y1={-rTerreo.yMm} x2={rTerreo.xMm + rTerreo.widthMm} y2={-rTerreo.yMm - rTerreo.depthMm}
                  stroke="#d97706" strokeWidth="1.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>
                <line x1={rTerreo.xMm} y1={-rTerreo.yMm - rTerreo.depthMm} x2={rTerreo.xMm + rTerreo.widthMm} y2={-rTerreo.yMm}
                  stroke="#d97706" strokeWidth="1.5" strokeDasharray="6 4" vectorEffect="non-scaling-stroke"/>
                <rect x={rTerreo.xMm + rTerreo.widthMm / 2 - 800} y={-rTerreo.yMm - rTerreo.depthMm / 2 - 120}
                  width={1600} height={240} rx={120} fill="white" stroke="#d97706" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
                <text x={rTerreo.xMm + rTerreo.widthMm / 2} y={-rTerreo.yMm - rTerreo.depthMm / 2 + 45}
                  textAnchor="middle" fontSize="130" fill="#b45309" fontWeight="700">
                  VÃO DA ESCADA
                </text>
              </g>
            )
          }
          return (
            <g key={'ghost-' + rTerreo.id} pointerEvents="none" opacity="0.45">
              <rect x={rTerreo.xMm} y={-rTerreo.yMm - rTerreo.depthMm} width={rTerreo.widthMm} height={rTerreo.depthMm}
                fill="#f1f5f9" stroke="#64748b" strokeWidth="2" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>
              <text x={rTerreo.xMm + rTerreo.widthMm / 2} y={-rTerreo.yMm - rTerreo.depthMm / 2} textAnchor="middle"
                fontSize={Math.min(220, rTerreo.widthMm / Math.max(rTerreo.name.length, 12))} fill="#475569">
                {rTerreo.name} (Térreo)
              </text>
            </g>
          )
        })}
        {Array.from(gruposContornos.entries()).map(([key, data]) => {
          const primeiro = data.rooms[0]
          const ehFoco = selecao?.tipo === 'comodo' && data.rooms.some(r => r.id === selecao.id)
          const marcado = ehFoco
          return (
            <g key={'merged-group-' + key} role="button" tabIndex={0} aria-pressed={marcado}
              aria-label={primeiro.name + ', cômodo com ' + data.areaM2.toFixed(1) + ' m²'}
              onClick={() => setSel({ tipo: 'comodo', id: primeiro.id })}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (marcado) editar(selecao)
                  else setSel({ tipo: 'comodo', id: primeiro.id })
                }
              }}>
              <polygon
                points={data.pontos.map(p => `${p[0]},${-p[1]}`).join(' ')}
                fill={marcado ? '#d5eee9' : '#edf3f7'}
                stroke={ehFoco ? '#0f766e' : marcado ? '#14b8a6' : '#64748b'}
                strokeWidth={ehFoco ? 4 : marcado ? 3 : 2}
                vectorEffect="non-scaling-stroke"
              />
              <text x={data.centro.x} y={-data.centro.y} textAnchor="middle" fontSize="220" fill="#0f172a" pointerEvents="none">
                {primeiro.name.slice(0, 24)}
                <tspan x={data.centro.x} dy="1.4em" fontSize="0.85em">{data.areaM2.toFixed(1).replace('.', ',')} m²</tspan>
              </text>
            </g>
          )
        })}
        {shown.filter(r => !idsEmGrupos.has(r.id)).map(room=>{
          const ehFoco=selecao?.tipo==='comodo'&&selecao.id===room.id
          const ehMescladoComSel=selecao?.tipo==='comodo'&&mesmoGrupoMesclado(s.present.mergedGroups,selecao.id,room.id)
          const marcado=ehFoco||ehMescladoComSel
          const ehEscada=room.name.toLowerCase().includes('escada')
          return <g key={room.id} data-comodo={room.id} role="button" tabIndex={0} aria-pressed={marcado}
            aria-label={room.name+', '+metros(room.widthMm)+' por '+metros(room.depthMm)+' m'}
            onKeyDown={e=>{
              const delta:Record<string,[number,number]>={ArrowLeft:[-100,0],ArrowRight:[100,0],ArrowUp:[0,100],ArrowDown:[0,-100]}
              if(delta[e.key]&&ehFoco&&!ocupado){e.preventDefault();step(room,...delta[e.key])}
              if(e.key==='Enter'||e.key===' '){e.preventDefault();if(marcado) editar(selecao);else setSel({tipo:'comodo',id:room.id})}
            }}>
            <rect x={room.xMm} y={-room.yMm-room.depthMm} width={room.widthMm} height={room.depthMm}
              fill={invalidIds.has(room.id)?'#fff1f2':marcado?'#d5eee9':'#edf3f7'}
              stroke={invalidIds.has(room.id)?'#be123c':ehFoco?'#0f766e':marcado?'#14b8a6':'#64748b'}
              strokeWidth={ehFoco?4:marcado?3:2} vectorEffect="non-scaling-stroke"/>
            <text x={room.xMm+room.widthMm/2} y={-room.yMm-room.depthMm/2} textAnchor="middle"
              fontSize={Math.min(280,room.widthMm/Math.max(room.name.length,12))} fill="#0f172a" pointerEvents="none">
              {room.name.slice(0,24)}
              <tspan x={room.xMm+room.widthMm/2} dy="1.5em" fontSize="0.85em">{metros(room.widthMm)} × {metros(room.depthMm)} m</tspan>
            </text>
            {ehEscada && (
              <g pointerEvents="none">
                {Array.from({ length: Math.max(3, Math.min(16, Math.floor(room.depthMm / 220))) }).map((_, i, arr) => {
                  const stepY = -room.yMm - (i + 1) * (room.depthMm / (arr.length + 1))
                  return <line key={i} x1={room.xMm + 40} y1={stepY} x2={room.xMm + room.widthMm - 40} y2={stepY}
                    stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 3" vectorEffect="non-scaling-stroke"/>
                })}
                <line x1={room.xMm + room.widthMm / 2} y1={-room.yMm - 180}
                  x2={room.xMm + room.widthMm / 2} y2={-room.yMm - room.depthMm + 240}
                  stroke="#0f766e" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
                <path d={`M ${room.xMm + room.widthMm / 2 - 60} ${-room.yMm - room.depthMm + 320} L ${room.xMm + room.widthMm / 2} ${-room.yMm - room.depthMm + 200} L ${room.xMm + room.widthMm / 2 + 60} ${-room.yMm - room.depthMm + 320}`}
                  fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
                <text x={room.xMm + room.widthMm / 2} y={-room.yMm - room.depthMm + 440} textAnchor="middle"
                  fontSize={Math.min(160, room.widthMm / 6)} fill="#0f766e" fontWeight="700">
                  SOBE ↑
                </text>
              </g>
            )}
          </g>})}
        {redimensionado&&rascComodo&&<rect pointerEvents="none" x={redimensionado.xMm}
          y={-redimensionado.yMm-rascComodo.depthMm} width={rascComodo.widthMm} height={rascComodo.depthMm}
          fill="none" stroke="#0f766e" strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>}
        {novo&&<rect pointerEvents="none" x={novo.xMm} y={-novo.yMm-novo.depthMm} width={novo.widthMm} height={novo.depthMm}
          fill="rgba(15,118,110,.12)" stroke="#0f766e" strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>}

        {/* Paredes desenhadas confirmadas no traçado ativo */}
        {caminhoParedes.length >= 2 && (
          <g pointerEvents="none">
            {caminhoParedes.map((p, i) => {
              if (i === 0) return null
              const prev = caminhoParedes[i - 1]
              const len = Math.round(Math.hypot(p.x - prev.x, p.y - prev.y))
              return (
                <g key={'parede-feita-' + i}>
                  <line x1={prev.x} y1={-prev.y} x2={p.x} y2={-p.y} stroke="#0f766e" strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  <rect x={(prev.x + p.x)/2 - 350} y={-(prev.y + p.y)/2 - 80} width={700} height={160} rx={80} fill="#0f766e" opacity="0.9" />
                  <text x={(prev.x + p.x)/2} y={-(prev.y + p.y)/2 + 35} textAnchor="middle" fontSize="90" fill="white" fontWeight="700">
                    {metros(len)} m
                  </text>
                </g>
              )
            })}
          </g>
        )}
        {/* Vértices das paredes */}
        {caminhoParedes.map((p, i) => (
          <g key={'vertice-' + i} pointerEvents="none">
            <circle cx={p.x} cy={-p.y} r={7 * mmPorPx} fill={i === 0 ? '#10b981' : '#0f766e'} stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {/* Ponto inicial com indicador de fechamento */}
        {caminhoParedes.length >= 3 && (
          <g pointerEvents="none">
            <circle cx={caminhoParedes[0].x} cy={-caminhoParedes[0].y} r={(fecharSugerido ? 18 : 12) * mmPorPx}
              fill="rgba(16,185,129,0.3)" stroke="#10b981" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            {fecharSugerido && (
              <text x={caminhoParedes[0].x} y={-caminhoParedes[0].y - 20 * mmPorPx} textAnchor="middle" fontSize={14 * mmPorPx} fill="#059669" fontWeight="700">
                Toque para fechar
              </text>
            )}
          </g>
        )}
        {/* Segmento sendo arrastado no momento */}
        {rascunhoParede && rascunhoParede.lenMm > 0 && (
          <g pointerEvents="none">
            <line x1={rascunhoParede.p0.x} y1={-rascunhoParede.p0.y} x2={rascunhoParede.p1.x} y2={-rascunhoParede.p1.y}
              stroke="#0f766e" strokeWidth="6" strokeDasharray="8 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={rascunhoParede.p1.x} cy={-rascunhoParede.p1.y} r={6 * mmPorPx} fill="#0f766e" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </g>
        )}

        {/* Móveis 2D Humanizados na Planta */}
        {(s.present.furniture ?? []).map(f => {
          const ehSel = selecao?.tipo === 'movel' && selecao.id === f.id
          const posX = previewMovel?.id === f.id ? previewMovel.xMm : f.xMm
          const posY = previewMovel?.id === f.id ? previewMovel.yMm : f.yMm
          return (
            <Movel2D
              key={f.id}
              id={f.id}
              tipoCatalogo={f.tipoCatalogo}
              nome={f.nome}
              widthMm={f.widthMm}
              depthMm={f.depthMm}
              xMm={posX}
              yMm={posY}
              rotDegrees={f.rotDegrees}
              selecionado={ehSel}
              onClick={e => {
                e.stopPropagation()
                setSel({ tipo: 'movel', id: f.id })
              }}
            />
          )
        })}

        <ParedesEAberturas rooms={shown} openings={openingsExibidas} mergedGroups={s.present.mergedGroups}
          paredesAtivas={!!aguardando} paredeDestaque={paredeDestaque} selecionada={selecao?.tipo==='abertura'?selecao.id:null}
          invalidIds={invalidIds} rascunho={rascAbertura?{o:rascAbertura,ok:!verificar(rascAbertura,editando??undefined).mensagens.length}:null}
          ignorar={editando} mmPorPx={mmPorPx}
          onParedeTeclado={id=>{const w=walls.find(w=>w.id===id)!
            if(aguardando) abrir({tipo:'abertura-nova',kind:aguardando as 'door'|'window',wallId:id,t:(w.end-w.start)/2})}}
          onAberturaTeclado={id=>{if(selecao?.tipo==='abertura'&&selecao.id===id) focarAbertura(id);else setSel({tipo:'abertura',id})}}
          onNudgeAbertura={nudgeAbertura}/>
      </svg>
      {!rooms.length&&!aberta&&!arrasteMenu&&!rascunhoParede&&!caminhoParedes.length&&<div className={styles.vazio}>
        {andarAtivo === 1 && roomsTerreo.length ? (
          <><strong>Pavimento Superior:</strong> Use o gabarito do térreo no fundo para alinhar suas paredes e o vão da escada. Arraste Parede ou Retângulo.</>
        ) : (
          <><strong>Arraste Parede, Retângulo ou Escada para a planta</strong> ou toque na ferramenta para desenhar. Medidas entre eixos das paredes.</>
        )}
        {!onSave&&' Somente nesta aba: baixe o projeto completo antes de sair.'}</div>}
      {aguardando==='parede'&&<div className={styles.faixa} role="status">
        <span>{caminhoParedes.length===0?'Arraste o dedo na planta para traçar a 1ª parede':`${caminhoParedes.length} parede(s) traçada(s). Trace a próxima ou feche no início.`}</span>
        <div className={styles.botoesFaixa}>
          {caminhoParedes.length > 0 && <button type="button" className={styles.botaoSecundarioFaixa} onClick={desfazerTrecho}>Desfazer trecho</button>}
          {caminhoParedes.length >= 3 && <button type="button" className={styles.botaoDestaqueFaixa} onClick={fecharContorno}>Fechar Cômodo</button>}
          <button type="button" onClick={cancelarParede}>Cancelar</button>
        </div>
      </div>}
      {aguardando&&aguardando!=='parede'&&<div className={styles.faixa} role="status"><span>Toque na parede onde vai a {aguardando==='door'?'porta':'janela'}</span>
        <button onClick={()=>setAguardando(null)}>Cancelar</button></div>}
      {selecao&&selecao.tipo==='abertura'&&!aberta&&!aguardando&&(()=>{
        const o=s.present.openings.find(x=>x.id===selecao.id)
        if(!o) return null
        const w=walls.find(w=>w.id===o.wallId)
        const labelParede=w?w.label:''
        return (
          <div className={styles.faixaAbertura} role="toolbar" aria-label="Ajuste rápido da abertura">
            <div className={styles.linhaInfoAbertura}>
              <span className={styles.rotuloAbertura}>
                {o.kind==='door'?'🚪 Porta':'🪟 Janela'} • {labelParede}
              </span>
              <div className={styles.valoresAbertura}>
                <span className={styles.tagCota}>● Canto: <strong>{metros(o.offsetMm)} m</strong></span>
                <span className={styles.tagLargura}>Larg: <strong>{metros(o.widthMm)} m</strong></span>
              </div>
            </div>
            <div className={styles.controlesAbertura}>
              <div className={styles.grupoSetas}>
                <span className={styles.rotuloGrupo}>Posição:</span>
                <button type="button" className={styles.botaoNudge} title="Mover -10 cm para o canto" onClick={()=>nudgeAbertura(o.id,-100)}>◀ -10</button>
                <button type="button" className={styles.botaoNudge} title="Mover -5 cm para o canto" onClick={()=>nudgeAbertura(o.id,-50)}>◀ -5</button>
                <button type="button" className={styles.botaoNudge} title="Mover +5 cm para longe do canto" onClick={()=>nudgeAbertura(o.id,50)}>+5 ▶</button>
                <button type="button" className={styles.botaoNudge} title="Mover +10 cm para longe do canto" onClick={()=>nudgeAbertura(o.id,100)}>+10 ▶</button>
              </div>
              <div className={styles.grupoSetas}>
                <span className={styles.rotuloGrupo}>Largura:</span>
                <button type="button" className={styles.botaoNudge} title="Diminuir largura 10 cm" onClick={()=>ajustarLarguraAbertura(o.id,-100)}>-10</button>
                <button type="button" className={styles.botaoNudge} title="Aumentar largura 10 cm" onClick={()=>ajustarLarguraAbertura(o.id,100)}>+10</button>
              </div>
              <div className={styles.grupoAcoesAbertura}>
                <button type="button" className={styles.botaoFocarAbertura} title="Dar zoom e focar nesta abertura" onClick={()=>focarAbertura(o.id)}>🔍 Focar</button>
                <button type="button" className={styles.botaoTipoAbertura} title="Alternar Porta/Janela" onClick={()=>alternarTipoAbertura(o.id)}>
                  {o.kind==='door'?'Janela':'Porta'}
                </button>
                <button type="button" className={styles.botaoExcluirAbertura} title="Excluir abertura" onClick={()=>excluirAbertura(o.id)}>🗑️</button>
                <button type="button" className={styles.botaoMaisAbertura} title="Mais opções (peitoril, altura)" onClick={()=>editar(selecao)}>⚙️ Mais</button>
              </div>
            </div>
          </div>
        )
      })()}
      {selecao&&selecao.tipo==='movel'&&!aberta&&!aguardando&&(()=>{
        const m=(s.present.furniture??[]).find(x=>x.id===selecao.id)
        if(!m) return null
        return (
          <div className={styles.faixaMovel} role="toolbar" aria-label="Ajuste do móvel selecionado">
            <div className={styles.linhaInfoMovel}>
              <span className={styles.rotuloMovel}>
                🛋️ {m.nome}
              </span>
              <div className={styles.valoresMovel}>
                <span className={styles.tagMovelMedida}>{metros(m.widthMm)} × {metros(m.depthMm)} m</span>
                <span className={styles.tagMovelGiro}>{m.rotDegrees}°</span>
              </div>
            </div>
            <div className={styles.controlesMovel}>
              <div className={styles.grupoSetas}>
                <span className={styles.rotuloGrupo}>Ajuste fino:</span>
                <button type="button" className={styles.botaoNudge} title="Mover 10 cm para esquerda" onClick={()=>nudgeMovel(m.id,-100,0)}>◀ -10</button>
                <button type="button" className={styles.botaoNudge} title="Mover 10 cm para direita" onClick={()=>nudgeMovel(m.id,100,0)}>+10 ▶</button>
                <button type="button" className={styles.botaoNudge} title="Mover 10 cm para cima" onClick={()=>nudgeMovel(m.id,0,100)}>▲ +10</button>
                <button type="button" className={styles.botaoNudge} title="Mover 10 cm para baixo" onClick={()=>nudgeMovel(m.id,0,-100)}>▼ -10</button>
              </div>
              <div className={styles.grupoAcoesMovel}>
                <button type="button" className={styles.botaoGirarMovel} title="Girar 90 graus" onClick={()=>girarMovel(m.id)}>
                  🔄 Girar 90°
                </button>
                <button type="button" className={styles.botaoExcluirMovel} title="Excluir móvel" onClick={()=>excluirMovel(m.id)}>
                  🗑️
                </button>
              </div>
            </div>
          </div>
        )
      })()}
      {selecao&&selecao.tipo==='comodo'&&!aberta&&!aguardando&&!preview&&<div className={styles.faixa}>
        <span>{nomeSel}</span>
        {(()=>{
          const rels = relacoes(rooms, s.present.mergedGroups)
          const grupoIds = grupoDoComodo(s.present.mergedGroups, selecao.id).concat(selecao.id)
          const wallsDoGrupo = new Set(grupoIds.flatMap(id => Object.values(paredes(id))))
          const vizinhosAdjacentes = rels
            .filter(r => (wallsDoGrupo.has(r.wallA) || wallsDoGrupo.has(r.wallB)) && r.kind === 'adjacent')
            .map(r => {
              const otherWall = wallsDoGrupo.has(r.wallA) ? r.wallB : r.wallA
              return walls.find(w => w.id === otherWall)!.roomId
            })
            .filter(id => !grupoIds.includes(id))
          const vizinhosUnicos = Array.from(new Set(vizinhosAdjacentes))
          return vizinhosUnicos.map(vId => {
            const vRoom = rooms.find(r => r.id === vId)
            if (!vRoom) return null
            return <button key={'mesclar-' + vId} type="button" className={styles.botaoAcaoMesclar} onClick={()=>{
              try {
                const next = aplicar(s, {type:'merge', roomAId: selecao.id, roomBId: vId})
                setSession(next)
                setNotice(avisoDoPar(next) || `Cômodos mesclados em um só: ${rooms.find(r=>r.id===selecao.id)?.name}. Parede divisória removida.`)
              } catch(e) {
                setNotice((e as Error).message)
              }
            }}>Mesclar{vRoom ? ` com ${vRoom.name}` : ''}</button>
          })
        })()}
        <button className={styles.primario} onClick={()=>editar(selecao)}>Editar</button>
      </div>}
    </div>
    {rascunhoParede && (
      <div className={styles.badgeCota} style={{ left: rascunhoParede.clientX, top: rascunhoParede.clientY }}>
        {metros(Math.abs(rascunhoParede.p1.x - rascunhoParede.p0.x))} × {metros(Math.abs(rascunhoParede.p1.y - rascunhoParede.p0.y))} m
      </div>
    )}
    {badgeAbertura && (
      <div className={styles.badgeCota} style={{ left: badgeAbertura.clientX, top: badgeAbertura.clientY }}>
        ● Canto: {metros(badgeAbertura.offsetMm)} m | Larg: {metros(badgeAbertura.widthMm)} m
      </div>
    )}
    {arrasteMenu&&<div className={styles.fantasma} style={{left:arrasteMenu.x,top:arrasteMenu.y}} aria-hidden="true">
      {FERRAMENTAS.find(f=>f.id===arrasteMenu.ferramenta)!.desenho}</div>}
    {aberta&&folha&&<div inert={saving||openingProject||gerando3D||modal3DAberto}><Folha key={JSON.stringify(aberta)} titulo={folha.titulo} onFechar={fechar}
      onTopo={y=>setTopoFolha(t=>t!==null&&Math.abs(t-y)<1?t:y)}>{folha.corpo}</Folha></div>}
    {saveError&&<p role="alert" className={styles.toastErro}>{saveError}</p>}
    <p className={styles.toast} role="status" aria-live="polite">{saving?'Validando e salvando versão…':notice}</p>
    {modal3DAberto && (
      <div className={styles.overlay3D} role="dialog" aria-modal="true" aria-label="Prévia ilustrativa 3D da planta"
        onKeyDown={e=>{if(e.key==='Escape') setModal3DAberto(false)}}>
        <div className={styles.cabecalho3D}>
          <div className={styles.info3D}>
            <h2 className={styles.titulo3D}>Prévia 3D do {floorMaquete===0?'térreo':'superior'}</h2>
            <span className={styles.tagStatus3D}>Ilustrativa · sem dados comerciais</span>
          </div>
          <div className={styles.acoes3D}>
            {blobUrlMaquete && (
              <button
                type="button"
                className={styles.botaoAcao3D}
                onClick={() => window.open(blobUrlMaquete, '_blank')}>
                Abrir em Nova Aba ↗
              </button>
            )}
            <button
              ref={fecharMaquete}
              type="button"
              className={styles.botaoFechar3D}
              aria-label="Fechar maquete 3D"
              onClick={() => setModal3DAberto(false)}>
              ✕
            </button>
          </div>
        </div>
        <div className={styles.corpo3D}>
          <iframe
            title="Prévia ilustrativa da planta e móveis do andar ativo"
            src={blobUrlMaquete || undefined}
            srcDoc={!blobUrlMaquete ? htmlMaquete : undefined}
            className={styles.iframe3D}
            allow="fullscreen"
          />
        </div>
      </div>
    )}
  </div>
}
