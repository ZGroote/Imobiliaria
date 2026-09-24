'use client'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'
import { Portao } from '@/components/Portao'
import { PAPEIS_DA_AREA } from '@/lib/acesso'

export default function AreaDaImobiliaria({ children }: { children: ReactNode }) {
  return <Portao papeis={PAPEIS_DA_AREA.agencia}>{(perfil) => <AppShell perfil={perfil}>{children}</AppShell>}</Portao>
}
