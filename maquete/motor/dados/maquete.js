// O pacote de teste do motor (tasks/painel/maquete-geral.md, MG-2): um volume simples de 12 × 6 × 8 m
// sobre um chão, com dois apartamentos no pavimento piloto e uma luz pré-calculada de 64 × 64. Os
// arquivos de dados/exterior/ e dados/unidades.json saem de gerar_pacote_teste.mjs. Um imóvel de verdade
// troca esta pasta inteira; o motor não muda.
export default {
  schema:'maquete-dados-v1',
  nome:'Volume de teste',
  nomeCurto:'Teste',
  arquivo:'volume-de-teste',
  pagina:'maquete.html',
  paginaPreservada:null,
  mapa:{pagina:'tour.html',titulo:'Mapa do entorno do volume de teste',runtime:'tour.html',preparar:[]},

  edicoes:{
    base:{assets:'dados/exterior/',units:'dados/unidades.json',glb:null,nome:'Teste — volume simples'},
  },
  edicaoPadrao:'base',
  edicaoDaMaquete:'base',

  predio:{
    pavimentos:2,
    pavimentoPiloto:1,
    alturaPavimentoM:3,
    idUnidade:'teste/pavimento-{pavimento}/final-{final}',
    gardenNoTerreo:false,
    caixaDoClique:{min:[-6,0,-4],max:[6,6,4]},
    reconciliacao:{publishedUnits:4,publishedParkingSpaces:0,paginaDaFonte:1,limitations:['Pacote de teste, sem imóvel real.']},
  },
  unidades:{
    esquemas:['liv-pilot-units-v1'],esquemaComContorno:null,
    quantidade:2,final:'^0[1-2]$',idPiloto:'teste/pavimento-01/final-{final}',
    confianca:'inferido',faixaY:[3,6],meiaLarguraX:6,alturaDoClique:4.5,
    envelope:{minY:0,maxY:6,meiaLarguraX:6,meiaProfundidadeZ:4},
  },
  lados:{
    frente:{sinal:1,par:true,rotulo:'Lado da frente',interno:.1,externo:{base:4,contorno:4}},
    fundos:{sinal:-1,par:false,rotulo:'Lado dos fundos',interno:-.1,externo:{base:-4,contorno:-4}},
  },
  tipologias:{},

  vistasDaCena:{perspectiva:'Perspectiva',aerea:'Aérea'},
  vistasExtras:{},
  vistaDoPavimento:{meiaLargura:7,alturaMinima:3,profundidade:4},
  vistaDaFachada:{altura:6,meiaAlturaMinima:4,meiaLargura:7,profundidade:4},
  acabamentos:null,
};
