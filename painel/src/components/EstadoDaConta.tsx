'use client'
import { useIdioma } from '@/components/Idioma'

import { useState } from 'react'
import { aceitarConvite } from '@/lib/convite'
import { db } from '@/lib/firebase'
import { sair, useSessao, type Sessao } from '@/lib/session'
import { ROTULO_PAPEL } from '@/lib/types'
import { enviarVerificacaoEmail } from '@/lib/verificacaoEmail'

// Telas de quem está logado mas ainda não pode usar o painel.
export function EstadoDaConta({ sessao }: { sessao: Exclude<Sessao, { tipo: 'ativo' | 'carregando' | 'fora' }> }) {
  const { t: tr, idioma } = useIdioma()

  const { reavaliar } = useSessao()
  const [aviso, setAviso] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const agir = async (f: () => Promise<unknown>, ok = '') => {
    setOcupado(true); setAviso('')
    try { await f(); setAviso(ok) } catch (e) { setAviso((e as Error).message) } finally { setOcupado(false) }
  }

  let titulo = '', texto = '', acoes = null
  switch (sessao.tipo) {
    case 'sem-verificacao':
      titulo = tr("Confirme seu e-mail")
      texto = idioma === 'en' ? `We sent a link to ${sessao.user.email}. Open it, then click "I have verified my email".` : `Enviamos um link para ${sessao.user.email}. Abra o link e depois clique em "Já confirmei".`
      acoes = <>
        <button disabled={ocupado} onClick={() => agir(reavaliar)} className="btn-primario">{tr("Já confirmei")}</button>
        <button disabled={ocupado} onClick={() => agir(() => enviarVerificacaoEmail(sessao.user, idioma), tr("Link reenviado."))}
          className="btn">{tr("Reenviar link")}</button>
      </>
      break
    case 'convite':
      titulo = tr("Você tem um convite")
      texto = `${tr(ROTULO_PAPEL[sessao.convite.role])}${sessao.convite.agencyName ? ` em ${sessao.convite.agencyName}` : ''}.`
      acoes = <button disabled={ocupado} className="btn-primario"
        onClick={() => agir(() => aceitarConvite(db, sessao.user.uid, sessao.convite))}>{tr("Aceitar convite")}</button>
      break
    case 'sem-acesso':
      titulo = tr("Sem acesso")
      texto = idioma === 'en' ? `No invitation was found for ${sessao.user.email}. Ask your agency manager or the dashboard administrator for an invitation.` : `Não há convite para ${sessao.user.email}. Peça um convite ao gerente da sua imobiliária ou ao administrador do painel.`
      break
    case 'inativo':
      titulo = tr("Acesso desativado")
      texto = tr("Sua conta foi desativada. Fale com o administrador do painel.")
      break
    case 'erro':
      titulo = tr("Não foi possível carregar sua conta")
      texto = sessao.mensagem
      break
  }

  return (
    <main className="mx-auto mt-24 max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-600">{texto}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {acoes}
        <button onClick={sair} className="btn">{tr("Sair")}</button>
      </div>
      {aviso && <p className="mt-4 text-sm text-slate-600">{aviso}</p>}
    </main>
  )
}
