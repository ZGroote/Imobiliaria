import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SessaoDaRota } from '@/components/SessaoDaRota'
import { EnderecoDoPainel } from '@/components/EnderecoDoPainel'
import { IdiomaProvider } from '@/components/Idioma'
import './globals.css'

export const metadata: Metadata = { title: 'Conecta Imóveis 3D | Painel', icons: { icon: '/brand/marca.svg' } }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <EnderecoDoPainel />
        <IdiomaProvider><SessaoDaRota>{children}</SessaoDaRota></IdiomaProvider>
      </body>
    </html>
  )
}
