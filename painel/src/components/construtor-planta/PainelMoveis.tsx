'use client'
import React, { useState } from 'react'
import {
  CATEGORIAS_MOVEIS,
  CATALOGO_MOVEIS,
  type CategoriaMovel,
  type DefinicaoMovel,
} from './catalogoMoveis'
import Movel2D from './Movel2D'
import styles from './capturador.module.css'

interface PainelMoveisProps {
  onAdicionar: (movel: DefinicaoMovel) => void
  onFechar: () => void
}

export default function PainelMoveis({ onAdicionar, onFechar }: PainelMoveisProps) {
  const [categoriaAtiva, setCategoriaAtiva] = useState<CategoriaMovel>('quarto')

  const moveisFiltrados = CATALOGO_MOVEIS.filter(m => m.categoria === categoriaAtiva)

  return (
    <div className={styles.containerCatalogoMoveis}>
      {/* Abas de Categorias */}
      <div className={styles.abasCategoriasMoveis} role="tablist" aria-label="Categorias de móveis">
        {CATEGORIAS_MOVEIS.map(cat => {
          const ativa = cat.id === categoriaAtiva
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              className={ativa ? styles.abaCategoriaAtiva : styles.abaCategoria}
              onClick={() => setCategoriaAtiva(cat.id)}
            >
              <span className={styles.iconeAba}>{cat.icone}</span>
              <span>{cat.rotulo}</span>
            </button>
          )
        })}
      </div>

      {/* Grade de Móveis da Categoria Selecionada */}
      <div className={styles.gradeMoveis} role="region" aria-label="Móveis disponíveis">
        {moveisFiltrados.map(m => {
          // Caixa de enquadramento para a miniatura SVG
          const maxDim = Math.max(m.widthMm, m.depthMm) * 1.3
          const vbX = -maxDim / 2
          const vbY = -maxDim / 2
          const largM = (m.widthMm / 1000).toFixed(2).replace('.', ',')
          const profM = (m.depthMm / 1000).toFixed(2).replace('.', ',')

          return (
            <div
              key={m.id}
              className={styles.cartaoMovel}
              role="button"
              tabIndex={0}
              aria-label={`Adicionar ${m.nome}, medindo ${largM} por ${profM} metros`}
              onClick={() => {
                onAdicionar(m)
                onFechar()
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onAdicionar(m)
                  onFechar()
                }
              }}
            >
              {/* Miniatura SVG Real Humanizada */}
              <div className={styles.miniaturaMovel}>
                <svg
                  viewBox={`${vbX} ${vbY} ${maxDim} ${maxDim}`}
                  className={styles.svgMiniatura}
                  aria-hidden="true"
                >
                  <Movel2D
                    id={'preview-' + m.id}
                    tipoCatalogo={m.id}
                    nome={m.nome}
                    widthMm={m.widthMm}
                    depthMm={m.depthMm}
                    xMm={0}
                    yMm={0}
                    rotDegrees={0}
                  />
                </svg>
              </div>

              {/* Informações e Medidas */}
              <div className={styles.infoMovel}>
                <span className={styles.nomeMovel}>{m.nome}</span>
                <span className={styles.medidaMovel}>
                  {largM} × {profM} m
                </span>
              </div>

              {/* Botão de Inserção */}
              <button
                type="button"
                className={styles.botaoInserirMovel}
                title={`Adicionar ${m.nome}`}
                onClick={e => {
                  e.stopPropagation()
                  onAdicionar(m)
                  onFechar()
                }}
              >
                + Adicionar
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
