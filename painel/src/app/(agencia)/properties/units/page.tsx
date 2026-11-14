'use client'
import { Portao } from '@/components/Portao'
import { UnidadesDoImovel } from '@/components/UnidadesDoImovel'

export default function Unidades() {
  return <Portao papeis={['agency_manager']}>{() => <UnidadesDoImovel base="/properties" />}</Portao>
}
