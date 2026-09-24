import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SessaoProvider } from '@/lib/session'
import './globals.css'

export const metadata: Metadata = { title: 'Painel' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SessaoProvider>{children}</SessaoProvider>
      </body>
    </html>
  )
}
