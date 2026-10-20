'use client'
import React from 'react'

export interface MovelProps {
  id: string
  tipoCatalogo: string
  nome: string
  widthMm: number
  depthMm: number
  xMm: number
  yMm: number
  rotDegrees: number // 0, 90, 180, 270
  selecionado?: boolean
  onClick?: (e: React.MouseEvent) => void
  onPointerDown?: (e: React.PointerEvent) => void
}

/**
 * Renderizador SVG de Móveis 2D Humanizados em Escala Real (milímetros).
 * A origem do móvel é centralizada em (xMm, -yMm) na projeção do Canvas SVG,
 * com rotação arbitrária (passos de 90° normativos).
 */
export default function Movel2D({
  id,
  tipoCatalogo,
  nome,
  widthMm,
  depthMm,
  xMm,
  yMm,
  rotDegrees,
  selecionado = false,
  onClick,
  onPointerDown,
}: MovelProps) {
  const w = widthMm
  const d = depthMm
  const hw = w / 2
  const hd = d / 2

  // Renderização específica para cada tipo humanizado
  function renderHumanizado() {
    switch (tipoCatalogo) {
      case 'cama-casal':
      case 'cama-queen': {
        const pillowW = Math.min(500, w * 0.38)
        const pillowD = Math.min(350, d * 0.2)
        const pillowY = -hd + 80
        return (
          <g>
            {/* Cabeceira */}
            <rect x={-hw} y={-hd} width={w} height={80} rx={15} fill="#786551" stroke="#5c4d3d" strokeWidth={2} />
            {/* Colchão principal */}
            <rect x={-hw + 15} y={-hd + 80} width={w - 30} height={d - 95} rx={35} fill="#fdfbf7" stroke="#b0a89f" strokeWidth={2} />
            {/* Edredom / dobra */}
            <path
              d={`M ${-hw + 15} ${-hd + d * 0.42} Q 0 ${-hd + d * 0.38} ${hw - 15} ${-hd + d * 0.42} L ${hw - 15} ${hd - 15} Q 0 ${hd - 5} ${-hw + 15} ${hd - 15} Z`}
              fill="#f1ede6"
              stroke="#cfc7bc"
              strokeWidth={1.5}
            />
            {/* Travesseiro Esquerdo */}
            <rect x={-hw + 50} y={pillowY} width={pillowW} height={pillowD} rx={30} fill="#ffffff" stroke="#c4bead" strokeWidth={1.5} />
            {/* Travesseiro Direito */}
            <rect x={hw - 50 - pillowW} y={pillowY} width={pillowW} height={pillowD} rx={30} fill="#ffffff" stroke="#c4bead" strokeWidth={1.5} />
          </g>
        )
      }

      case 'cama-solteiro': {
        const pillowW = Math.min(550, w * 0.65)
        const pillowD = Math.min(340, d * 0.2)
        return (
          <g>
            {/* Cabeceira */}
            <rect x={-hw} y={-hd} width={w} height={70} rx={12} fill="#786551" stroke="#5c4d3d" strokeWidth={2} />
            {/* Colchão */}
            <rect x={-hw + 12} y={-hd + 70} width={w - 24} height={d - 82} rx={30} fill="#fdfbf7" stroke="#b0a89f" strokeWidth={2} />
            {/* Dobra do cobertor */}
            <path
              d={`M ${-hw + 12} ${-hd + d * 0.42} Q 0 ${-hd + d * 0.39} ${hw - 12} ${-hd + d * 0.42} L ${hw - 12} ${hd - 12} Q 0 ${hd - 5} ${-hw + 12} ${hd - 12} Z`}
              fill="#f1ede6"
              stroke="#cfc7bc"
              strokeWidth={1.5}
            />
            {/* Travesseiro único centralizado */}
            <rect x={-pillowW / 2} y={-hd + 80} width={pillowW} height={pillowD} rx={25} fill="#ffffff" stroke="#c4bead" strokeWidth={1.5} />
          </g>
        )
      }

      case 'guardaroupa': {
        const portas = 3
        const portaW = w / portas
        return (
          <g>
            <rect x={-hw} y={-hd} width={w} height={d} rx={8} fill="#e5dfd5" stroke="#796f63" strokeWidth={2.5} />
            {/* Divisórias internas / portas de correr */}
            {Array.from({ length: portas - 1 }).map((_, i) => (
              <line key={i} x1={-hw + (i + 1) * portaW} y1={-hd} x2={-hw + (i + 1) * portaW} y2={hd} stroke="#a89d8f" strokeWidth={2} />
            ))}
            {/* Puxadores finos */}
            {Array.from({ length: portas }).map((_, i) => (
              <rect key={'p-' + i} x={-hw + i * portaW + portaW / 2 - 25} y={hd - 40} width={50} height={12} rx={4} fill="#5c5449" />
            ))}
            {/* Linha de cabideiro decorativa */}
            <line x1={-hw + 30} y1={0} x2={hw - 30} y2={0} stroke="#b8ada0" strokeWidth={1.5} strokeDasharray="15 10" />
          </g>
        )
      }

      case 'criado': {
        return (
          <g>
            <rect x={-hw} y={-hd} width={w} height={d} rx={12} fill="#8A7660" stroke="#5e4f3f" strokeWidth={2} />
            <rect x={-hw + 30} y={-hd + 30} width={w - 60} height={d - 60} rx={8} fill="#9c8770" stroke="#73604c" strokeWidth={1} />
            <circle cx={0} cy={hd - 45} r={8} fill="#e2d9cd" />
          </g>
        )
      }

      case 'sofa-3':
      case 'sofa-2': {
        const bracoW = Math.min(180, w * 0.12)
        const encostoD = Math.min(220, d * 0.28)
        const assentos = tipoCatalogo === 'sofa-3' ? 3 : 2
        const assentoW = (w - 2 * bracoW) / assentos
        const assentoD = d - encostoD
        return (
          <g>
            {/* Base do sofá */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={25} fill="#4b5d6f" stroke="#334150" strokeWidth={2.5} />
            {/* Encosto posterior com almofadas */}
            <rect x={-hw + bracoW} y={-hd + 10} width={w - 2 * bracoW} height={encostoD - 10} rx={18} fill="#5a6e82" stroke="#374757" strokeWidth={1.5} />
            {/* Braço Esquerdo */}
            <rect x={-hw + 8} y={-hd + 10} width={bracoW - 12} height={d - 20} rx={16} fill="#5a6e82" stroke="#374757" strokeWidth={1.5} />
            {/* Braço Direito */}
            <rect x={hw - bracoW + 4} y={-hd + 10} width={bracoW - 12} height={d - 20} rx={16} fill="#5a6e82" stroke="#374757" strokeWidth={1.5} />
            {/* Almofadas de Assento */}
            {Array.from({ length: assentos }).map((_, i) => (
              <rect
                key={i}
                x={-hw + bracoW + i * assentoW + 6}
                y={-hd + encostoD + 6}
                width={assentoW - 12}
                height={assentoD - 16}
                rx={18}
                fill="#62778c"
                stroke="#3e5062"
                strokeWidth={1.5}
              />
            ))}
          </g>
        )
      }

      case 'poltrona': {
        const bracoW = w * 0.18
        return (
          <g>
            {/* Base com bordas bem arredondadas */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={35} fill="#786857" stroke="#4f4336" strokeWidth={2} />
            {/* Encosto curvado */}
            <path
              d={`M ${-hw + bracoW} ${-hd + 15} Q 0 ${-hd + 5} ${hw - bracoW} ${-hd + 15} L ${hw - bracoW} ${-hd + d * 0.3} Q 0 ${-hd + d * 0.25} ${-hw + bracoW} ${-hd + d * 0.3} Z`}
              fill="#8d7c6a"
              stroke="#54483a"
              strokeWidth={1.5}
            />
            {/* Braço Esquerdo */}
            <rect x={-hw + 10} y={-hd + 15} width={bracoW - 12} height={d - 30} rx={20} fill="#8d7c6a" stroke="#54483a" strokeWidth={1.5} />
            {/* Braço Direito */}
            <rect x={hw - bracoW + 2} y={-hd + 15} width={bracoW - 12} height={d - 30} rx={20} fill="#8d7c6a" stroke="#54483a" strokeWidth={1.5} />
            {/* Almofada central */}
            <rect x={-hw + bracoW + 6} y={-hd + d * 0.32} width={w - 2 * bracoW - 12} height={d * 0.62} rx={25} fill="#9e8d7a" stroke="#5e5142" strokeWidth={1.5} />
          </g>
        )
      }

      case 'rack-tv': {
        return (
          <g>
            {/* Tampo do rack */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={8} fill="#374151" stroke="#1f2937" strokeWidth={2} />
            {/* Painel de fundo / estante */}
            <rect x={-hw + 20} y={-hd + 15} width={w - 40} height={d - 30} rx={5} fill="#4b5563" stroke="#374151" strokeWidth={1} />
            {/* Televisor tela plana centrado */}
            <rect x={-w * 0.32} y={-18} width={w * 0.64} height={36} rx={4} fill="#111827" stroke="#000000" strokeWidth={2} />
            {/* Pedestal da TV */}
            <rect x={-w * 0.12} y={18} width={w * 0.24} height={12} rx={3} fill="#9ca3af" />
          </g>
        )
      }

      case 'mesa-jantar-4':
      case 'mesa-jantar-6': {
        const cadeirasLado = tipoCatalogo === 'mesa-jantar-6' ? 3 : 2
        const espacoX = w / (cadeirasLado + 1)
        const cadW = Math.min(420, espacoX * 0.85)
        const cadD = 380
        return (
          <g>
            {/* Cadeiras do lado norte (viradas para a mesa) */}
            {Array.from({ length: cadeirasLado }).map((_, i) => {
              const cx = -hw + (i + 1) * espacoX
              return (
                <g key={'cn-' + i}>
                  <rect x={cx - cadW / 2} y={-hd - cadD * 0.45} width={cadW} height={cadD} rx={10} fill="#8A7660" stroke="#5c4d3d" strokeWidth={1.5} />
                  <path d={`M ${cx - cadW / 2 + 5} ${-hd - cadD * 0.3} Q ${cx} ${-hd - cadD * 0.4} ${cx + cadW / 2 - 5} ${-hd - cadD * 0.3}`} fill="none" stroke="#4a3e30" strokeWidth={3} />
                </g>
              )
            })}
            {/* Cadeiras do lado sul (viradas para a mesa) */}
            {Array.from({ length: cadeirasLado }).map((_, i) => {
              const cx = -hw + (i + 1) * espacoX
              return (
                <g key={'cs-' + i}>
                  <rect x={cx - cadW / 2} y={hd - cadD * 0.55} width={cadW} height={cadD} rx={10} fill="#8A7660" stroke="#5c4d3d" strokeWidth={1.5} />
                  <path d={`M ${cx - cadW / 2 + 5} ${hd + cadD * 0.3} Q ${cx} ${hd + cadD * 0.4} ${cx + cadW / 2 - 5} ${hd + cadD * 0.3}`} fill="none" stroke="#4a3e30" strokeWidth={3} />
                </g>
              )
            })}
            {/* Tampo da Mesa */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={18} fill="#9A7A55" stroke="#685135" strokeWidth={2.5} />
            <rect x={-hw + 15} y={-hd + 15} width={w - 30} height={d - 30} rx={12} fill="#a88863" stroke="#876a47" strokeWidth={1} />
          </g>
        )
      }

      case 'tapete-sala': {
        return (
          <g>
            <rect x={-hw} y={-hd} width={w} height={d} rx={12} fill="#d5cbba" stroke="#b3a58e" strokeWidth={2} strokeDasharray="12 8" />
            <rect x={-hw + 50} y={-hd + 50} width={w - 100} height={d - 100} rx={8} fill="#ded6c8" stroke="#c2b6a0" strokeWidth={1} />
          </g>
        )
      }

      case 'pia-cozinha': {
        const cubaW = Math.min(600, w * 0.42)
        const cubaD = Math.min(420, d * 0.72)
        return (
          <g>
            {/* Bancada em granito escuro */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={6} fill="#475569" stroke="#1e293b" strokeWidth={2.5} />
            {/* Cuba em inox embutida */}
            <rect x={-cubaW / 2} y={-cubaD / 2 + 20} width={cubaW} height={cubaD} rx={25} fill="#cbd5e1" stroke="#64748b" strokeWidth={2} />
            {/* Ralo inox central */}
            <circle cx={0} cy={20} r={28} fill="#94a3b8" stroke="#475569" strokeWidth={1.5} />
            <circle cx={0} cy={20} r={12} fill="#334155" />
            {/* Torneira monocomando na parede posterior */}
            <rect x={-20} y={-cubaD / 2 - 20} width={40} height={30} rx={6} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5} />
            <line x1={0} y1={-cubaD / 2 - 5} x2={0} y2={-cubaD / 2 + 35} stroke="#94a3b8" strokeWidth={5} strokeLinecap="round" />
            <circle cx={0} cy={-cubaD / 2 + 35} r={6} fill="#0284c7" />
          </g>
        )
      }

      case 'fogao': {
        const raioBoca = Math.min(75, w * 0.12)
        return (
          <g>
            {/* Mesa do fogão */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={10} fill="#1e293b" stroke="#0f172a" strokeWidth={2.5} />
            <rect x={-hw + 25} y={-hd + 25} width={w - 50} height={d - 90} rx={8} fill="#334155" stroke="#475569" strokeWidth={1.5} />
            {/* 4 Bocas / Queimadores circulares com trempe em cruz */}
            {[
              { cx: -hw * 0.45, cy: -hd * 0.35, r: raioBoca * 1.15 },
              { cx: hw * 0.45, cy: -hd * 0.35, r: raioBoca * 0.9 },
              { cx: -hw * 0.45, cy: hd * 0.18, r: raioBoca * 0.95 },
              { cx: hw * 0.45, cy: hd * 0.18, r: raioBoca * 1.25 },
            ].map((b, i) => (
              <g key={i}>
                <circle cx={b.cx} cy={b.cy} r={b.r} fill="#1e293b" stroke="#94a3b8" strokeWidth={2} />
                <circle cx={b.cx} cy={b.cy} r={b.r * 0.4} fill="#0f172a" stroke="#f59e0b" strokeWidth={1.5} />
                <line x1={b.cx - b.r} y1={b.cy} x2={b.cx + b.r} y2={b.cy} stroke="#64748b" strokeWidth={2} />
                <line x1={b.cx} y1={b.cy - b.r} x2={b.cx} y2={b.cy + b.r} stroke="#64748b" strokeWidth={2} />
              </g>
            ))}
            {/* Botões frontais */}
            {[-0.6, -0.2, 0.2, 0.6].map((k, i) => (
              <circle key={'btn-' + i} cx={k * (hw - 40)} cy={hd - 32} r={12} fill="#94a3b8" stroke="#475569" strokeWidth={1.5} />
            ))}
          </g>
        )
      }

      case 'geladeira': {
        return (
          <g>
            {/* Corpo */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={12} fill="#cbd5e1" stroke="#64748b" strokeWidth={2.5} />
            {/* Divisão porta frontal */}
            <rect x={-hw + 15} y={-hd + 15} width={w - 30} height={d - 30} rx={8} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5} />
            {/* Puxador da porta em alumínio */}
            <rect x={-hw + 35} y={hd - 45} width={w - 70} height={16} rx={5} fill="#475569" stroke="#334155" strokeWidth={1} />
            {/* Linha discreta indicando abertura */}
            <line x1={-hw + 15} y1={0} x2={hw - 15} y2={0} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="8 6" />
          </g>
        )
      }

      case 'balcao-americano': {
        return (
          <g>
            <rect x={-hw} y={-hd} width={w} height={d} rx={10} fill="#64748b" stroke="#334155" strokeWidth={2.5} />
            <rect x={-hw + 15} y={-hd + 15} width={w - 30} height={d - 30} rx={6} fill="#78869a" stroke="#475569" strokeWidth={1} />
          </g>
        )
      }

      case 'vaso-sanitario': {
        const caixaD = 180
        const baciaW = w * 0.8
        const baciaD = d - caixaD - 40
        return (
          <g>
            {/* Caixa acoplada (fundo) */}
            <rect x={-hw + 10} y={-hd + 10} width={w - 20} height={caixaD} rx={10} fill="#f8fafc" stroke="#94a3b8" strokeWidth={2} />
            {/* Botão de descarga duplo */}
            <circle cx={0} cy={-hd + 10 + caixaD / 2} r={18} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5} />
            <line x1={0} y1={-hd + 10 + caixaD / 2 - 18} x2={0} y2={-hd + 10 + caixaD / 2 + 18} stroke="#64748b" strokeWidth={1.5} />
            {/* Bacia oval alongada */}
            <ellipse cx={0} cy={-hd + caixaD + baciaD * 0.55} rx={baciaW / 2} ry={baciaD / 2} fill="#ffffff" stroke="#94a3b8" strokeWidth={2} />
            {/* Abertura interna / tampa */}
            <ellipse cx={0} cy={-hd + caixaD + baciaD * 0.58} rx={baciaW * 0.35} ry={baciaD * 0.36} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={1.5} />
            {/* Água */}
            <circle cx={0} cy={-hd + caixaD + baciaD * 0.65} r={28} fill="#bae6fd" />
          </g>
        )
      }

      case 'gabinete-banheiro': {
        const cubaW = Math.min(480, w * 0.6)
        const cubaD = Math.min(340, d * 0.65)
        return (
          <g>
            {/* Gabinete / bancada */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={10} fill="#e2e8f0" stroke="#64748b" strokeWidth={2} />
            {/* Cuba oval de apoio ou embutida */}
            <ellipse cx={0} cy={10} rx={cubaW / 2} ry={cubaD / 2} fill="#ffffff" stroke="#94a3b8" strokeWidth={2} />
            {/* Ralo */}
            <circle cx={0} cy={10} r={16} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.5} />
            {/* Torneira de bancada */}
            <rect x={-14} y={-cubaD / 2 - 12} width={28} height={20} rx={4} fill="#64748b" />
            <circle cx={0} cy={-cubaD / 2 + 8} r={5} fill="#0284c7" />
          </g>
        )
      }

      case 'box-chuveiro': {
        return (
          <g>
            {/* Piso do box em tom ciano suave */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={6} fill="#e0f2fe" stroke="#38bdf8" strokeWidth={2.5} />
            {/* Linha diagonal de piso / desnível */}
            <line x1={-hw} y1={-hd} x2={hw} y2={hd} stroke="#bae6fd" strokeWidth={1.5} strokeDasharray="12 8" />
            <line x1={-hw} y1={hd} x2={hw} y2={-hd} stroke="#bae6fd" strokeWidth={1.5} strokeDasharray="12 8" />
            {/* Ralo no canto ou centro */}
            <rect x={hw - 180} y={hd - 180} width={100} height={100} rx={8} fill="#94a3b8" stroke="#475569" strokeWidth={1.5} />
            <circle cx={hw - 130} cy={hd - 130} r={22} fill="#334155" />
            {/* Chuveiro superior */}
            <circle cx={-hw + 140} cy={-hd + 140} r={45} fill="#ffffff" stroke="#0284c7" strokeWidth={2} />
            <circle cx={-hw + 140} cy={-hd + 140} r={20} fill="#38bdf8" />
          </g>
        )
      }

      case 'maquina-lavar': {
        return (
          <g>
            {/* Gabinete metálico branco */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={12} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={2.5} />
            {/* Tampa / Painel superior */}
            <rect x={-hw + 20} y={-hd + 15} width={w - 40} height={d - 30} rx={8} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.5} />
            {/* Visor de vidro circular / óculo */}
            <circle cx={0} cy={15} r={Math.min(180, w * 0.32)} fill="#e0f2fe" stroke="#0284c7" strokeWidth={2.5} />
            <circle cx={0} cy={15} r={Math.min(130, w * 0.23)} fill="#bae6fd" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="10 8" />
            {/* Painel de comandos */}
            <rect x={-hw + 40} y={-hd + 30} width={w - 80} height={35} rx={6} fill="#334155" />
            <circle cx={-hw + 70} cy={-hd + 47} r={8} fill="#38bdf8" />
            <circle cx={-hw + 110} cy={-hd + 47} r={8} fill="#10b981" />
          </g>
        )
      }

      case 'tanque-lavar': {
        const baciaW = w - 80
        const baciaD = d - 90
        return (
          <g>
            {/* Louça do tanque */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={12} fill="#f8fafc" stroke="#94a3b8" strokeWidth={2.5} />
            {/* Bacia do tanque com batedor */}
            <rect x={-baciaW / 2} y={-baciaD / 2 + 15} width={baciaW} height={baciaD} rx={18} fill="#ffffff" stroke="#cbd5e1" strokeWidth={2} />
            {/* Ondinhas / estrias do batedor de roupas */}
            {[-80, -40, 0, 40, 80].map((dy, i) => (
              <line key={i} x1={-baciaW / 2 + 35} y1={dy} x2={baciaW / 2 - 35} y2={dy} stroke="#cbd5e1" strokeWidth={2.5} strokeLinecap="round" />
            ))}
            {/* Ralo */}
            <circle cx={0} cy={baciaD / 2 - 25} r={18} fill="#94a3b8" stroke="#475569" strokeWidth={1.5} />
            {/* Torneira */}
            <rect x={-12} y={-hd + 10} width={24} height={20} rx={4} fill="#64748b" />
          </g>
        )
      }

      case 'escrivaninha': {
        return (
          <g>
            {/* Tampo da mesa */}
            <rect x={-hw} y={-hd} width={w} height={d} rx={10} fill="#8A7660" stroke="#5c4d3d" strokeWidth={2.5} />
            <rect x={-hw + 20} y={-hd + 20} width={w - 40} height={d - 40} rx={6} fill="#9c8770" stroke="#75624e" strokeWidth={1} />
            {/* Notebook / Laptop sobre a bancada */}
            <rect x={-160} y={-hd + 45} width={320} height={220} rx={8} fill="#334155" stroke="#0f172a" strokeWidth={1.5} />
            <rect x={-130} y={-hd + 60} width={260} height={120} rx={4} fill="#1e293b" />
            <rect x={-80} y={-hd + 195} width={160} height={55} rx={3} fill="#475569" />
            {/* Cadeira de escritório atrás da escrivaninha */}
            <circle cx={0} cy={hd + 140} r={180} fill="#334155" stroke="#0f172a" strokeWidth={2} />
            <path d={`M -120 ${hd + 220} Q 0 ${hd + 260} 120 ${hd + 220}`} fill="none" stroke="#1e293b" strokeWidth={6} strokeLinecap="round" />
          </g>
        )
      }

      default: {
        return (
          <g>
            <rect x={-hw} y={-hd} width={w} height={d} rx={10} fill="#94a3b8" stroke="#475569" strokeWidth={2} />
            <text x={0} y={15} textAnchor="middle" fontSize={Math.min(180, w / 6)} fill="#1e293b" fontWeight="600">
              {nome.slice(0, 14)}
            </text>
          </g>
        )
      }
    }
  }

  return (
    <g
      id={'movel-' + id}
      data-movel={id}
      transform={`translate(${xMm}, ${-yMm}) rotate(${rotDegrees})`}
      style={{ cursor: 'move', userSelect: 'none' }}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {/* Elemento gráfico do móvel humanizado */}
      {renderHumanizado()}

      {/* Caixa delimitadora de seleção com anel de destaque */}
      {selecionado && (
        <g pointerEvents="none">
          <rect
            x={-hw - 20}
            y={-hd - 20}
            width={w + 40}
            height={d + 40}
            rx={14}
            fill="none"
            stroke="#0f766e"
            strokeWidth={3.5}
            strokeDasharray="10 6"
            vectorEffect="non-scaling-stroke"
          />
          {/* Alças de vértice decorativas */}
          <circle cx={-hw - 20} cy={-hd - 20} r={60} fill="#0f766e" stroke="white" strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <circle cx={hw + 20} cy={-hd - 20} r={60} fill="#0f766e" stroke="white" strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <circle cx={-hw - 20} cy={hd + 20} r={60} fill="#0f766e" stroke="white" strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <circle cx={hw + 20} cy={hd + 20} r={60} fill="#0f766e" stroke="white" strokeWidth={3} vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </g>
  )
}
