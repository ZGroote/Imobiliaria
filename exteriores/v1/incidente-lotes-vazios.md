# Quintais em áreas sem construção

O gerador aplicava os 40 estilos a todos os polígonos cadastrais com área válida,
inclusive terrenos vazios. Isso criava pisos, piscinas e mobiliário em áreas abertas.

A geração agora exige uma construção residencial associada ao lote: centro dentro,
ao menos 97% da pegada contida e associação única. A pegada de uma casa substituída
é a do modelo efetivamente renderizado. Sem essa associação, nenhum piso ou objeto
de quintal é gerado; permanece o solo original do mapa. Nos lotes ocupados, o quintal
continua cobrindo a área livre real, descontadas construções e vias.

Regressões: `testar_ocupacao.py` cobre lote vazio, vizinho na divisa, construção
atravessando lotes e substituição de casa. `capturar_vazio.cjs` compara a quadra
reportada; `verificar_vazio.py` confirma a ausência de pisos em três pontos que
antes estavam decorados (lotes 65961, 65958 e 65956), mantendo os 40 estilos.

Resultado: de 105.810 para 64.769 quintais e de 395.466 para 236.331 objetos.
Os três pontos passaram de um piso sobreposto cada para zero. A captura posterior
mostra o solo original da quadra e os quintais preservados junto às casas.
Integração de exteriores passou em desktop e celular, inclusive vista aérea,
descarregamento, recuperação de falha de rede e retorno do interior. A regressão
da tela inteira passou em sete resoluções internas e rotação na mesma versão.
