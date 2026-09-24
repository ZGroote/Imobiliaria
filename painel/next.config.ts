import type { NextConfig } from 'next'

// D1: site estático no Firebase Hosting. Sem servidor, sem rota dinâmica: detalhe é ?id=.
const config: NextConfig = {
  output: 'export',
  // A raiz do repositório é do pipeline, e o node_modules dela é uma junção (worktree).
  // O painel resolve tudo dentro de painel/.
  turbopack: { root: process.cwd() },
}

export default config
