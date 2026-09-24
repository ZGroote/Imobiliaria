import type { UserRole } from './types.ts'

export interface ItemDeMenu { href: string; rotulo: string; papeis: UserRole[] }

const EQUIPE: UserRole[] = ['platform_admin', 'operator']

// Proposta §12. O que não está aqui (métricas, builds, configurações) é de fase posterior.
export const MENU: ItemDeMenu[] = [
  { href: '/admin', rotulo: 'Kanban', papeis: EQUIPE },
  { href: '/admin/requests', rotulo: 'Solicitações', papeis: EQUIPE },
  { href: '/admin/properties', rotulo: 'Imóveis', papeis: EQUIPE },
  { href: '/admin/agencies', rotulo: 'Imobiliárias', papeis: EQUIPE },
  { href: '/admin/users', rotulo: 'Usuários e convites', papeis: ['platform_admin'] },
  { href: '/dashboard', rotulo: 'Início', papeis: ['agency_manager', 'agent'] },
  { href: '/properties', rotulo: 'Imóveis', papeis: ['agency_manager', 'agent'] },
  { href: '/requests', rotulo: 'Solicitações', papeis: ['agency_manager', 'agent'] },
  { href: '/team', rotulo: 'Equipe', papeis: ['agency_manager'] },
]

export const menuDoPapel = (r: UserRole) => MENU.filter((i) => i.papeis.includes(r))

// Item ativo: o de prefixo mais longo que casa com o caminho (/admin não acende em /admin/users).
export function itemAtivo(itens: ItemDeMenu[], caminho: string) {
  return itens.filter((i) => caminho === i.href || caminho.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}
