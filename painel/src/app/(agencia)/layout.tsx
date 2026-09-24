'use client'
import type { ReactNode } from 'react'
import { Portao } from '@/components/Portao'
import { PAPEIS_DA_AREA } from '@/lib/acesso'

export default function AreaDaImobiliaria({ children }: { children: ReactNode }) {
  return <Portao papeis={PAPEIS_DA_AREA.agencia}>{() => children}</Portao>
}
