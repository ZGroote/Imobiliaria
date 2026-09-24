import type { NextConfig } from 'next'

const emulador = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === '1'

// D1: site estático no Firebase Hosting. Sem servidor, sem rota dinâmica: detalhe é ?id=.
const config: NextConfig = {
  output: 'export',
  turbopack: {
    // A raiz do repositório é do pipeline, e o node_modules dela é uma junção (worktree).
    // O painel resolve tudo dentro de painel/.
    root: process.cwd(),
    // Fora do emulador, os atalhos de login do seed nem entram na build: o ramo morto de um
    // import dinâmico ainda gera o chunk, então a troca é feita na resolução do módulo.
    resolveAlias: emulador ? {} : { '@/components/AtalhosDev': './src/components/Nada.tsx' },
  },
}

export default config
