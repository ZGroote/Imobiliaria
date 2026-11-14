'use client'
import { useEffect, useRef, useState } from 'react'
import { collection, query, where } from 'firebase/firestore'
import { db, storage } from '@/lib/firebase'
import { usePerfil } from '@/lib/session'
import { usePaginada } from '@/lib/useFirestore'
import { baixarMaterial, EXTENSOES_MATERIAIS, nomeMaterial, prepararMaterial, type Material } from '@/lib/materiais'
import { useIdioma } from './Idioma'
import { Aviso, CarregarMais, Cartao, Estado } from './ui'

type Envio = ReturnType<typeof prepararMaterial> & { estado: 'pendente' | 'enviando' | 'enviado' | 'erro'; progresso: number }

export function MateriaisDoPedido({ pedido }: { pedido: { id: string; agencyId: string } }) {
  const perfil = usePerfil()
  return <Materiais key={`${perfil.id}:${pedido.id}:${pedido.agencyId}`} pedido={pedido} />
}
function Materiais({ pedido }: { pedido: { id: string; agencyId: string } }) {
  const { t } = useIdioma(), perfil = usePerfil()
  const [fila, setFila] = useState<Envio[]>([]), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(''), [baixando, setBaixando] = useState('')
  const ativo = useRef(true), enviando = useRef(false), atual = useRef<Envio | null>(null)
  const arquivos = usePaginada<Material>(`materiais:${perfil.id}:${pedido.id}`, () => query(collection(db, 'requestAssets'), where('agencyId', '==', pedido.agencyId), where('requestId', '==', pedido.id)))
  useEffect(() => {
    ativo.current = true
    return () => { ativo.current = false; atual.current?.cancelar() }
  }, [])
  useEffect(() => {
    if (!ocupado) return
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [ocupado])
  function escolher(files: FileList | null) {
    setErro('')
    if (!files?.length) return
    if (files.length > 20) { setErro(t('Selecione até 20 arquivos por vez.')); return }
    try {
      const novos = Array.from(files).map(file => ({ ...prepararMaterial(db, storage, pedido, perfil.id, file), estado: 'pendente' as const, progresso: 0 }))
      setFila(antes => [...antes.filter(f => f.estado !== 'enviado'), ...novos])
    } catch (e) { setErro(t((e as Error).message)) }
  }
  async function enviar() {
    if (enviando.current) return
    enviando.current = true; setOcupado(true); setErro('')
    let falhou = false
    try {
      for (const item of fila.filter(f => f.estado !== 'enviado')) {
        if (!ativo.current) break
        atual.current = item
        setFila(antes => antes.map(f => f.id === item.id ? { ...f, estado: 'enviando' } : f))
        try {
          await item.enviar(progresso => { if (ativo.current) setFila(antes => antes.map(f => f.id === item.id ? { ...f, progresso } : f)) })
          if (ativo.current) setFila(antes => antes.map(f => f.id === item.id ? { ...f, estado: 'enviado', progresso: 100 } : f))
        } catch {
          falhou = true
          if (ativo.current) setFila(antes => antes.map(f => f.id === item.id ? { ...f, estado: 'erro' } : f))
        }
      }
      if (falhou && ativo.current) setErro(t('Alguns arquivos não foram concluídos. Clique em enviar novamente para tentar os pendentes.'))
    } finally {
      atual.current = null; enviando.current = false
      if (ativo.current) setOcupado(false)
    }
  }
  async function baixar(material: Material) {
    setBaixando(material.id); setErro('')
    try {
      const blob = await baixarMaterial(storage, material)
      if (!ativo.current) return
      const url = URL.createObjectURL(blob), a = document.createElement('a')
      a.href = url; a.download = nomeMaterial(material.filename); document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { if (ativo.current) setErro(t('Não foi possível baixar o arquivo. Confira seu acesso e tente novamente.')) }
    finally { if (ativo.current) setBaixando('') }
  }
  const pendentes = fila.some(f => f.estado !== 'enviado')
  return <Cartao titulo={t('Materiais da solicitação')}>
    <p className="mb-3 text-sm text-slate-600">{t('Envie plantas, fotos, medidas e documentos por aqui. Nossa equipe recebe os arquivos vinculados a esta solicitação.')}</p>
    <p className="mb-4 text-xs text-slate-500">{t('PDF, imagens, vídeos, arquivos CAD/BIM, documentos ou ZIP. Até 5 GB por arquivo. Acesso restrito à imobiliária e à equipe responsável.')}</p>
    <label className="block text-sm">{t('Selecionar arquivos')}<input type="file" multiple accept={EXTENSOES_MATERIAIS} disabled={ocupado} className="campo mt-2 max-w-full" onChange={e => { escolher(e.target.files); e.target.value = '' }} /></label>
    {!!fila.length && <ul className="mt-4 space-y-3" aria-live="polite">{fila.map(f => <li key={f.id} className="rounded border border-slate-200 p-3 text-sm">
      <div className="flex items-center justify-between gap-3"><span className="min-w-0 break-all">{f.nome}</span>{!ocupado && f.estado !== 'enviado' && <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setFila(antes => antes.filter(x => x.id !== f.id))}>{t('Retirar da fila')}</button>}</div>
      <p className="mt-1 text-xs text-slate-500">{t(f.estado === 'enviado' ? 'Recebido pela equipe' : f.estado === 'erro' ? 'Envio não concluído' : f.estado === 'enviando' ? 'Enviando arquivo…' : 'Pronto para enviar')}{f.estado === 'enviando' ? ` ${f.progresso}%` : ''}</p>
      {f.estado === 'enviando' && <progress className="mt-2 w-full accent-[var(--brand)]" value={f.progresso} max={100} aria-label={f.nome} />}
    </li>)}</ul>}
    {pendentes && <button type="button" className="btn-primario mt-4" disabled={ocupado} onClick={enviar}>{t(ocupado ? 'Enviando materiais…' : 'Enviar arquivos selecionados')}</button>}
    {erro && <div className="mt-3"><Aviso>{erro}</Aviso></div>}
    <h3 className="mb-2 mt-6 text-sm font-semibold">{t('Arquivos recebidos')}</h3>
    <Estado r={arquivos}>{!arquivos.dados?.length ? <p className="text-sm text-slate-500">{t('Nenhum arquivo recebido ainda.')}</p> : <ul className="divide-y divide-slate-200">{arquivos.dados.map(m => <li key={m.id} className="flex items-center justify-between gap-3 py-3">
      <span className="min-w-0 break-all text-sm">{nomeMaterial(m.filename)}</span><button className="btn shrink-0" type="button" disabled={!!baixando} onClick={() => baixar(m)}>{t(baixando === m.id ? 'Baixando…' : 'Baixar')}</button>
    </li>)}</ul>}</Estado><CarregarMais r={arquivos} />
  </Cartao>
}
