'use client'
import {useEffect,useState,type FormEvent,type ReactNode} from 'react'
import {metros,metrosParaMm} from './modelo'
import styles from './capturador.module.css'

export type MedidasComodo={name:string;widthMm:number;depthMm:number;ceilingHeightMm:number}
type Props={forma:'quadrado'|'retangulo'|'poligono';inicial?:{name:string;widthMm:number;depthMm:number};
  poligonoInfo?:{paredes:number;areaM2:number;perimetroM:number};
  peDireito:number|null;pedirPeDireito:boolean;onRascunho:(d:{widthMm:number;depthMm:number}|null)=>void;
  vizinhosMesclaveis?:{id:string;name:string}[];partesMescladas?:{id:string;name:string}[];
  onMesclar?:(vizinhoId:string)=>void;onSeparar?:()=>void;
  onConfirmar:(m:MedidasComodo)=>void;onExcluir?:()=>void;onCancelar:()=>void;children?:ReactNode}
const mm=(t:string)=>{try{return metrosParaMm(t)}catch{return null}}
const seleciona=(e:{currentTarget:HTMLInputElement})=>e.currentTarget.select()

const SUGESTOES = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Corredor', 'Escada', 'Varanda', 'Garagem']

// Quadrado e polígono têm atalhos próprios de criação.
export default function FormComodo({forma,inicial,poligonoInfo,peDireito,pedirPeDireito,onRascunho,
  vizinhosMesclaveis,partesMescladas,onMesclar,onSeparar,
  onConfirmar,onExcluir,onCancelar,children}:Props){
  const [f,setF]=useState({name:inicial?.name??'',width:inicial?metros(inicial.widthMm):'',
    depth:inicial?metros(inicial.depthMm):'',height:peDireito?metros(peDireito):''})
  const [erro,setErro]=useState('')
  const largura=mm(f.width),profundidade=forma==='quadrado'?largura:mm(f.depth)
  const ehNovo = !inicial || !inicial.name
  // A planta desenha o rascunho a cada tecla; o modelo só recebe ao confirmar.
  useEffect(()=>{
    if(forma==='poligono') return
    onRascunho(largura&&profundidade?{widthMm:largura,depthMm:profundidade}:null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[largura,profundidade])
  function confirmar(e:FormEvent){
    e.preventDefault()
    try{
      if(forma==='poligono'){
        onConfirmar({name:f.name,widthMm:0,depthMm:0,ceilingHeightMm:metrosParaMm(f.height)})
        return
      }
      const widthMm=metrosParaMm(f.width)
      onConfirmar({name:f.name,widthMm,depthMm:forma==='quadrado'?widthMm:metrosParaMm(f.depth),
        ceilingHeightMm:metrosParaMm(f.height)})
    }catch(e){setErro((e as Error).message)}
  }
  const campo=(rotulo:string,chave:keyof typeof f,exemplo:string,foco=false)=><label>{rotulo}
    <input value={f[chave]} onChange={e=>{setF({...f,[chave]:e.target.value});setErro('')}} onFocus={seleciona}
      inputMode={chave==='name'?'text':'decimal'} placeholder={exemplo} required autoFocus={foco}
      maxLength={chave==='name'?100:16} autoComplete="off" enterKeyHint={chave==='name'?'next':'done'}/></label>
  return <form className={styles.form} onSubmit={confirmar}>
    {campo('Nome do cômodo','name','Ex.: Sala',ehNovo)}
    <div className={styles.sugestoesNomes} role="group" aria-label="Nomes sugeridos">
      {SUGESTOES.map(sug => (
        <button key={sug} type="button" className={styles.chipNome} onClick={() => {
          setF(prev => ({ ...prev, name: sug }))
          setErro('')
        }}>
          {sug}
        </button>
      ))}
    </div>
    {forma==='poligono' ? (
      <div className={styles.infoPoligono}>
        <div className={styles.itemInfoPoligono}>
          <span className={styles.rotuloInfoPoligono}>Paredes</span>
          <strong>{poligonoInfo?.paredes ?? 0} trechos</strong>
        </div>
        <div className={styles.itemInfoPoligono}>
          <span className={styles.rotuloInfoPoligono}>Área Total</span>
          <strong>{poligonoInfo ? poligonoInfo.areaM2.toFixed(1).replace('.', ',') : '0,0'} m²</strong>
        </div>
        <div className={styles.itemInfoPoligono}>
          <span className={styles.rotuloInfoPoligono}>Perímetro</span>
          <strong>{poligonoInfo ? poligonoInfo.perimetroM.toFixed(2).replace('.', ',') : '0,00'} m</strong>
        </div>
      </div>
    ) : forma==='quadrado'?campo('Lado (m)','width','Ex.: 3,40')
      :<div className={styles.par}>{campo('Largura (m)','width','Ex.: 4,20')}{campo('Profundidade (m)','depth','Ex.: 3,00')}</div>}
    {pedirPeDireito&&campo('Pé-direito da planta (m)','height','Ex.: 2,70')}
    <p className={styles.dica}>Medidas entre eixos das paredes, até três casas decimais.
      {pedirPeDireito&&' O pé-direito vale para a planta inteira.'}</p>
    {children}
    {partesMescladas && partesMescladas.length > 0 && (
      <div className={styles.blocoMesclado}>
        <p className={styles.dica}>Cômodo composto (mesclado com {partesMescladas.map(p => p.name).join(', ')}).</p>
        <button type="button" className={styles.botaoSeparar} onClick={onSeparar}>
          Separar deste cômodo
        </button>
      </div>
    )}
    {vizinhosMesclaveis && vizinhosMesclaveis.length > 0 && (
      <div className={styles.blocoMesclado}>
        <span className={styles.rotuloMesclar}>Mesclar com cômodo encostado:</span>
        <div className={styles.listaMesclar}>
          {vizinhosMesclaveis.map(v => (
            <button key={v.id} type="button" className={styles.botaoMesclar} onClick={() => onMesclar?.(v.id)}>
              Mesclar com {v.name}
            </button>
          ))}
        </div>
      </div>
    )}
    {erro&&<p role="alert" className={styles.erro}>{erro}</p>}
    <div className={styles.acoes}>
      <button type="submit" className={styles.primario}>{ehNovo?'Adicionar':'Aplicar'}</button>
      {onExcluir&&<button type="button" onClick={onExcluir}>Excluir</button>}
      <button type="button" onClick={onCancelar}>Cancelar</button>
    </div>
  </form>
}