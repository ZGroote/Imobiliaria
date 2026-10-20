'use client'
import { useState } from 'react'
import { doc } from 'firebase/firestore'
import { Aviso, Cartao, Estado, Selo, useAcao } from './ui'
import { db } from '@/lib/firebase'
import { centavos } from '@/lib/estoque-modelo'
import type { Property } from '@/lib/types'
import { useDoc } from '@/lib/useFirestore'
import { salvarVitrine, SITUACOES_VITRINE, vitrinePadrao, type SituacaoVitrine, type Vitrine } from '@/lib/vitrine'

const emReais = (c: number | null) => (c === null ? '' : (c / 100).toFixed(2).replace('.', ','))

// "No ar": o botão liga e desliga a página pública do imóvel na hora. Para imobiliária (comPreco),
// também preço e situação. Quem vê sem poder mudar (o corretor) só lê.
export function NoAr({ p, podeEditar, comPreco }: { p: Property; podeEditar: boolean; comPreco: boolean }) {
  const slug = p.pipelineUnitId
  const r = useDoc<Vitrine>(slug ? `vitrine:${slug}` : null, () => doc(db, 'vitrine', slug!))
  const { executar, ocupado, erro } = useAcao()
  const [preco, setPreco] = useState<string | null>(null)
  const [situacao, setSituacao] = useState<SituacaoVitrine | null>(null)
  if (!slug) return (
    <Cartao titulo="No ar">
      <p className="text-sm text-slate-500">Este imóvel ainda não tem endereço público: a equipe precisa ligá-lo ao pipeline.</p>
    </Cartao>
  )
  const atual: Vitrine = r.dado ? { ...vitrinePadrao(p.id), ...r.dado } : vitrinePadrao(p.id)
  // A mudança é calculada dentro do executar: preço mal digitado vira aviso na tela, não exceção solta.
  const salvar = (m: () => Partial<Vitrine>) => executar(async () => salvarVitrine(db, slug, { ...atual, ...m(), propertyId: p.id }))
  return (
    <Cartao titulo="No ar">
      <Estado r={r}>
        <div className="flex flex-wrap items-center gap-3">
          {atual.online ? <Selo tom="verde">No ar</Selo> : <Selo>Fora do ar</Selo>}
          {podeEditar && (
            <button className="btn" disabled={ocupado} onClick={() => salvar(() => ({ online: !atual.online }))}>
              {atual.online ? 'Tirar do ar' : 'Colocar no ar'}
            </button>
          )}
        </div>
        {!p.publishedBuild && <p className="mt-2 text-xs text-slate-500">Ainda não publicado: a escolha vale quando ele for ao ar.</p>}
        {comPreco && (
          <>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="text-sm">Situação
                <select className="campo mt-1" disabled={!podeEditar} value={situacao ?? atual.situacao}
                  onChange={(e) => setSituacao(e.target.value as SituacaoVitrine)}>
                  {Object.entries(SITUACOES_VITRINE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="text-sm">Preço (R$)
                <input className="campo mt-1 w-40" inputMode="decimal" placeholder="o do anúncio" disabled={!podeEditar}
                  value={preco ?? emReais(atual.precoCentavos)} onChange={(e) => setPreco(e.target.value)} />
              </label>
              {podeEditar && (
                <button className="btn" disabled={ocupado || (preco === null && situacao === null)}
                  onClick={async () => {
                    const ok = await salvar(() => ({
                      situacao: situacao ?? atual.situacao,
                      precoCentavos: preco === null ? atual.precoCentavos : centavos(preco),
                    }))
                    if (ok) { setPreco(null); setSituacao(null) }
                  }}>Salvar</button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Muda na página do imóvel na hora, sem publicar de novo. Preço vazio mostra o do anúncio; reservado, vendido e
              alugado aparecem no lugar do preço.
            </p>
          </>
        )}
        {erro && <Aviso>{erro}</Aviso>}
      </Estado>
    </Cartao>
  )
}
