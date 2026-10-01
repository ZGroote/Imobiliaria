'use client'
import {useEffect,useRef,useState,type ReactNode} from 'react'
import styles from './capturador.module.css'

// O pop-up de baixo. Acompanha o teclado virtual pela visualViewport (Android e iOS, sem
// depender de `interactive-widget`) e avisa o próprio topo, para a planta enquadrar o que
// está sendo editado na área que sobra acima dele.
export default function Folha({titulo,onFechar,onTopo,children}:{titulo:string;onFechar:()=>void;
  onTopo?:(y:number)=>void;children:ReactNode}){
  const ref=useRef<HTMLElement>(null)
  const avisar=useRef(onTopo)
  avisar.current=onTopo
  const [baixo,setBaixo]=useState(0)
  useEffect(()=>{
    const vv=window.visualViewport
    if(!vv) return
    const ajusta=()=>setBaixo(Math.max(0,window.innerHeight-vv.height-vv.offsetTop))
    ajusta();vv.addEventListener('resize',ajusta);vv.addEventListener('scroll',ajusta)
    return ()=>{vv.removeEventListener('resize',ajusta);vv.removeEventListener('scroll',ajusta)}
  },[])
  useEffect(()=>{
    const el=ref.current
    if(!el) return
    const mede=()=>avisar.current?.(el.getBoundingClientRect().top)
    mede()
    const ro=new ResizeObserver(mede);ro.observe(el)
    return ()=>ro.disconnect()
  },[baixo])
  return <section ref={ref} className={styles.folha} role="dialog" aria-label={titulo} style={{bottom:baixo}}
    onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onFechar()}}}>
    <div className={styles.folhaTopo}><h2>{titulo}</h2>
      <button type="button" aria-label="Fechar" onClick={onFechar}>✕</button></div>
    {children}
  </section>
}
