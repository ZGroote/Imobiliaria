// O pacote de teste da casa (tasks/painel/maquete-geral.md, MG-3): uma casa térrea de uma unidade, de
// 10 × 8 m, em duas edições do exterior, as duas do mesmo modelo:
//   - leve: sem luz pré-calculada; o sol da cena e a sombra dele são calculados no navegador;
//   - premium: com a luz pré-calculada de 64 × 64.
// Os arquivos de leve/ e premium/ saem de gerar_pacote_teste.mjs; a ficha e a planta estão aqui. O
// qa_casa.py serve esta pasta no lugar de dados/, como o build fará com a pasta de um imóvel de verdade.
export default {
  schema:'maquete-dados-v1',
  // casa ou apartamento: uma unidade, sem lista nem pavimentos (maquete.html). predio: o modo do LIV.
  tipo:'casa',
  // O slug do imóvel: o documento vitrine/<imovel> que o vitrine_ao_vivo.js lê (preço, situação, no ar).
  imovel:'casa-de-teste',
  nome:'Casa de teste',
  arquivo:'casa-de-teste',
  paginaPreservada:null,
  mapa:{pagina:'tour.html',titulo:'O que tem por perto da casa de teste'},

  edicoes:{
    leve:{assets:'dados/leve/',units:null,glb:null,nome:'Casa de teste — sem luz pré-calculada'},
    premium:{assets:'dados/premium/',units:null,glb:null,nome:'Casa de teste — com luz pré-calculada'},
  },
  edicaoPadrao:'leve',

  vistasDaCena:{perspectiva:'Perspectiva',aerea:'Aérea'},
  vistasExtras:{},
  acabamentos:null,

  // A ficha como o imóvel foi montado. O vitrine_ao_vivo.js troca o preço pelo do painel, ou pela situação.
  ficha:{
    tag:'À venda',
    titulo:'Casa de teste',
    subtitulo:'2 dormitórios · 73 m²',
    endereco:'Rua de Teste, 10 · Centro',
    preco:'R$ 450.000',
    linhas:[['Área útil','73,0 m²'],['Dormitórios','2'],['Banheiros','1'],['Vagas','2'],['Pé-direito','2,70 m']],
  },

  // A planta do cadastro, em metros, no referencial dela. A Planta 2D é desenhada daqui pelo floor-plan.js do
  // v16. A ordem dos cômodos importa: cada célula da grade fica com o primeiro cômodo que a contém.
  planta:{
    pe_direito:2.7,
    comodos:[
      {nome:'Quarto 1',piso:'quente',poly:[[0,0],[3.5,0],[3.5,3.4],[0,3.4]]},
      {nome:'Banho',piso:'frio',poly:[[3.5,0],[5.5,0],[5.5,2.4],[3.5,2.4]]},
      {nome:'Cozinha',piso:'frio',poly:[[5.5,0],[9.6,0],[9.6,3],[5.5,3]]},
      {nome:'Quarto 2',piso:'quente',poly:[[0,4.6],[3.5,4.6],[3.5,7.6],[0,7.6]]},
      {nome:'Circulação',piso:'quente',poly:[[3.5,2.4],[5.5,2.4],[5.5,4.6],[0,4.6],[0,3.4],[3.5,3.4]]},
      {nome:'Sala',piso:'quente',poly:[[5.5,3],[9.6,3],[9.6,7.6],[3.5,7.6],[3.5,4.6],[5.5,4.6]]},
    ],
    portas:[
      {p:[2.6,3.4],largura:.8},{p:[2.6,4.6],largura:.8},{p:[4.5,2.4],largura:.7},
      {p:[4.5,4.6],largura:1.6},{p:[7.5,3],largura:1.6},{p:[7,7.6],largura:.9},
    ],
    janelas:[
      {p:[0,1.7],largura:1.4},{p:[0,6.1],largura:1.4},{p:[4.5,0],largura:.6},{p:[7.5,0],largura:1.4},{p:[9.6,5.3],largura:2},
    ],
  },
};
