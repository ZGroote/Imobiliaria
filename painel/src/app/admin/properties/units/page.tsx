'use client'
import { Portao } from '@/components/Portao'
import { UnidadesDoImovel } from '@/components/UnidadesDoImovel'

export default function Unidades() {
  return <Portao papeis={['platform_admin']}>{() => <UnidadesDoImovel base="/admin/properties" />}</Portao>
}
