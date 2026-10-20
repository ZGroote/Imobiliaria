// Pedidos que chegaram desde o último retrato da lista. O primeiro retrato (antes = null) não avisa:
// abrir o painel não é "chegou pedido".
export function chegaram<T extends { id: string }>(antes: Set<string> | null, agora: T[]): T[] {
  return antes ? agora.filter((p) => !antes.has(p.id)) : []
}
