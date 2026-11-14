'use client'
import { useEffect } from 'react'
import { enderecoCanonico } from '@/lib/endereco'

export function EnderecoDoPainel() {
  useEffect(() => {
    const destino = enderecoCanonico(window.location.href)
    if (destino) window.location.replace(destino)
  }, [])
  return null
}
