// Presets de móveis 2D com dimensões ajustáveis para composição ilustrativa.
// e mapeamento 1:1 com os modelos 3D do renderizador Three.js e pipeline/mobiliar.py.

export type CategoriaMovel = 'quarto' | 'sala' | 'cozinha' | 'banheiro' | 'servico_office'

export interface DefinicaoMovel {
  id: string
  nome: string
  categoria: CategoriaMovel
  tipo3D: string // Mapeia para v1.5 MOVEIS (cama, sofa, mesa, pia, fogao, geladeira, vaso, etc.)
  widthMm: number
  depthMm: number
  alturaMm: number
  corPadrao: string
  descricao: string
}

export const CATEGORIAS_MOVEIS: { id: CategoriaMovel; rotulo: string; icone: string }[] = [
  { id: 'sala', rotulo: 'Sala', icone: '🛋️' },
  { id: 'quarto', rotulo: 'Quarto', icone: '🛏️' },
  { id: 'cozinha', rotulo: 'Cozinha', icone: '🍳' },
  { id: 'banheiro', rotulo: 'Banheiro', icone: '🚿' },
  { id: 'servico_office', rotulo: 'Serviço & Office', icone: '🧺' },
]

export const CATALOGO_MOVEIS: DefinicaoMovel[] = [
  // ---- QUARTO ----
  {
    id: 'cama-casal',
    nome: 'Cama Casal',
    categoria: 'quarto',
    tipo3D: 'cama',
    widthMm: 1450,
    depthMm: 2050,
    alturaMm: 950,
    corPadrao: '#8A7660',
    descricao: 'Cama de casal padrão com cabeceira e dois travesseiros',
  },
  {
    id: 'cama-queen',
    nome: 'Cama Queen',
    categoria: 'quarto',
    tipo3D: 'cama',
    widthMm: 1600,
    depthMm: 2050,
    alturaMm: 950,
    corPadrao: '#8A7660',
    descricao: 'Cama queen size confortável',
  },
  {
    id: 'cama-solteiro',
    nome: 'Cama Solteiro',
    categoria: 'quarto',
    tipo3D: 'cama',
    widthMm: 900,
    depthMm: 2050,
    alturaMm: 950,
    corPadrao: '#8A7660',
    descricao: 'Cama de solteiro',
  },
  {
    id: 'guardaroupa',
    nome: 'Guarda-Roupa',
    categoria: 'quarto',
    tipo3D: 'guardaroupa',
    widthMm: 1800,
    depthMm: 600,
    alturaMm: 2350,
    corPadrao: '#E8E4DC',
    descricao: 'Armário planejado com portas de correr',
  },
  {
    id: 'criado',
    nome: 'Criado-Mudo',
    categoria: 'quarto',
    tipo3D: 'criado',
    widthMm: 450,
    depthMm: 400,
    alturaMm: 550,
    corPadrao: '#8A7660',
    descricao: 'Mesa de cabeceira com gaveta',
  },

  // ---- SALA ----
  {
    id: 'sofa-3',
    nome: 'Sofá 3 Lugares',
    categoria: 'sala',
    tipo3D: 'sofa',
    widthMm: 1960,
    depthMm: 920,
    alturaMm: 800,
    corPadrao: '#4A5A6B',
    descricao: 'Sofá estofado com braços e 3 almofadas',
  },
  {
    id: 'sofa-2',
    nome: 'Sofá 2 Lugares',
    categoria: 'sala',
    tipo3D: 'sofa',
    widthMm: 1500,
    depthMm: 850,
    alturaMm: 800,
    corPadrao: '#4A5A6B',
    descricao: 'Sofá compacto de 2 lugares',
  },
  {
    id: 'poltrona',
    nome: 'Poltrona',
    categoria: 'sala',
    tipo3D: 'cadeira',
    widthMm: 800,
    depthMm: 800,
    alturaMm: 850,
    corPadrao: '#7C6A55',
    descricao: 'Poltrona de estar confortável',
  },
  {
    id: 'rack-tv',
    nome: 'Rack com TV',
    categoria: 'sala',
    tipo3D: 'rack',
    widthMm: 1800,
    depthMm: 400,
    alturaMm: 700,
    corPadrao: '#3A3F45',
    descricao: 'Móvel de TV com painel/console',
  },
  {
    id: 'mesa-jantar-4',
    nome: 'Mesa Jantar 4 Lug.',
    categoria: 'sala',
    tipo3D: 'mesa',
    widthMm: 1200,
    depthMm: 800,
    alturaMm: 760,
    corPadrao: '#9A7A55',
    descricao: 'Mesa retangular com 4 cadeiras',
  },
  {
    id: 'mesa-jantar-6',
    nome: 'Mesa Jantar 6 Lug.',
    categoria: 'sala',
    tipo3D: 'mesa',
    widthMm: 1600,
    depthMm: 900,
    alturaMm: 760,
    corPadrao: '#9A7A55',
    descricao: 'Mesa de jantar ampla com 6 cadeiras',
  },
  {
    id: 'tapete-sala',
    nome: 'Tapete',
    categoria: 'sala',
    tipo3D: 'tapete',
    widthMm: 2000,
    depthMm: 1500,
    alturaMm: 20,
    corPadrao: '#C2B8A3',
    descricao: 'Tapete para sala de estar',
  },

  // ---- COZINHA ----
  {
    id: 'pia-cozinha',
    nome: 'Bancada com Cuba',
    categoria: 'cozinha',
    tipo3D: 'pia',
    widthMm: 1500,
    depthMm: 600,
    alturaMm: 920,
    corPadrao: '#8E9299',
    descricao: 'Bancada de granito/inox com cuba e torneira',
  },
  {
    id: 'fogao',
    nome: 'Fogão 4 Bocas',
    categoria: 'cozinha',
    tipo3D: 'fogao',
    widthMm: 600,
    depthMm: 600,
    alturaMm: 920,
    corPadrao: '#334155',
    descricao: 'Fogão / Cooktop com 4 queimadores',
  },
  {
    id: 'geladeira',
    nome: 'Geladeira Duplex',
    categoria: 'cozinha',
    tipo3D: 'geladeira',
    widthMm: 700,
    depthMm: 700,
    alturaMm: 1780,
    corPadrao: '#CBD5E1',
    descricao: 'Refrigerador duplex frost free',
  },
  {
    id: 'balcao-americano',
    nome: 'Balcão / Ilha',
    categoria: 'cozinha',
    tipo3D: 'balcao',
    widthMm: 1200,
    depthMm: 500,
    alturaMm: 920,
    corPadrao: '#7C8466',
    descricao: 'Balcão passa-prato ou ilha com banquetas',
  },

  // ---- BANHEIRO ----
  {
    id: 'vaso-sanitario',
    nome: 'Vaso Sanitário',
    categoria: 'banheiro',
    tipo3D: 'vaso',
    widthMm: 450,
    depthMm: 650,
    alturaMm: 800,
    corPadrao: '#F8FAFC',
    descricao: 'Bacia sanitária com caixa acoplada',
  },
  {
    id: 'gabinete-banheiro',
    nome: 'Bancada Lavatório',
    categoria: 'banheiro',
    tipo3D: 'pia',
    widthMm: 750,
    depthMm: 500,
    alturaMm: 850,
    corPadrao: '#E2E8F0',
    descricao: 'Gabinete suspenso com cuba oval e espelho',
  },
  {
    id: 'box-chuveiro',
    nome: 'Box Chuveiro',
    categoria: 'banheiro',
    tipo3D: 'box',
    widthMm: 900,
    depthMm: 900,
    alturaMm: 2000,
    corPadrao: '#E0F2FE',
    descricao: 'Box de vidro temperado com ralo e chuveiro',
  },

  // ---- SERVIÇO & OFFICE ----
  {
    id: 'maquina-lavar',
    nome: 'Máquina de Lavar',
    categoria: 'servico_office',
    tipo3D: 'maquina',
    widthMm: 600,
    depthMm: 650,
    alturaMm: 850,
    corPadrao: '#E2E8F0',
    descricao: 'Lavadora automática com tampa e visor',
  },
  {
    id: 'tanque-lavar',
    nome: 'Tanque de Serviço',
    categoria: 'servico_office',
    tipo3D: 'pia',
    widthMm: 600,
    depthMm: 550,
    alturaMm: 850,
    corPadrao: '#F1F5F9',
    descricao: 'Tanque em louça com batedor canelado',
  },
  {
    id: 'escrivaninha',
    nome: 'Escrivaninha Office',
    categoria: 'servico_office',
    tipo3D: 'mesa',
    widthMm: 1200,
    depthMm: 600,
    alturaMm: 740,
    corPadrao: '#8A7660',
    descricao: 'Mesa de estudos ou trabalho com cadeira',
  },
]

export function obterDefinicaoMovel(idOuTipo: string): DefinicaoMovel {
  const achou = CATALOGO_MOVEIS.find(m => m.id === idOuTipo || m.tipo3D === idOuTipo)
  if (achou) return achou
  return {
    id: idOuTipo,
    nome: idOuTipo,
    categoria: 'sala',
    tipo3D: idOuTipo,
    widthMm: 1000,
    depthMm: 1000,
    alturaMm: 800,
    corPadrao: '#64748B',
    descricao: 'Móvel personalizado',
  }
}
