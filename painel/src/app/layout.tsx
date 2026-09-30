import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SessaoDaRota } from '@/components/SessaoDaRota'
import './globals.css'

export const metadata: Metadata = { title: 'Painel' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessaoDaRota>{children}</SessaoDaRota>
      </body>
    </html>
  )
}
