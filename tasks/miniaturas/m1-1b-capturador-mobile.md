# M1.1-B — capturador em tela cheia para o celular

Origem: piloto P0 do M1.1-A (01/10/2026, Android/Chrome). Ter que rolar a página para ir
da planta aos formulários e voltar "quebra completamente a sensação de fluidez". Escopo
aprovado pelo usuário no mesmo dia. As cinco sessões do baseline passam a ser feitas
**nesta** versão.

Base: `06bbcd6` (merge #81). Só interface: cômodo continua retângulo e abertura continua em
parede. O contrato M1-0, o arquivo exportado e a cadeia do M1-F não mudam. A tela autenticada
`/imoveis/planta` (M1-D) usa o mesmo componente e muda junto.

## Escopo aprovado

Pedido pelo usuário:

1. Menu lateral com quatro ícones: quadrado, retângulo, janela e porta.
2. Arrastar o ícone e soltar na planta abre um pop-up com os dados. O quadrado pede um lado,
   o retângulo pede largura e profundidade, e os dois pedem o nome.
3. Porta ou janela solta numa parede abre um pop-up com largura, altura, peitoril (janela) e
   distância até o canto. A abertura anda na parede enquanto as medidas são digitadas.
4. Um toque seleciona; manter pressionado o selecionado abre o pop-up já preenchido, com
   excluir.

Acrescentado para funcionar no celular:

5. Tela cheia, sem rolagem: a planta ocupa a tela, o menu fica na lateral e uma barra fina em
   cima guarda desfazer, refazer, enquadrar e baixar (e salvar versão em `/imoveis/planta`).
6. Zoom e mover a planta com dois dedos (pinça); roda do mouse no computador. Um dedo fica para
   arrastar ícones e cômodos.
7. Pop-up na parte de baixo, acima do teclado. A planta reenquadra o que está sendo editado na
   área visível acima dele, e uma linha de medida mostra a distância até o canto.
8. Pé-direito perguntado uma vez, no primeiro cômodo; editável na edição de qualquer cômodo
   ("vale para toda a planta").
9. Alternativas sem arrastar e sem toque longo: tocar no ícone também adiciona (o cômodo entra
   no centro da vista; porta ou janela pede um toque na parede), e o selecionado ganha um botão
   **Editar**. Mover cômodo também tem passos de 10 cm. Teclado: ícones e itens são botões.
10. O toque longo não abre o menu de contexto do navegador.

## Porta comum aos dois cômodos

Pedido do usuário em 01/10/2026, testando esta versão: com uma porta numa parede externa,
encostar depois outro cômodo nessa parede dava erro ("o par da parede mudou"). A porta deve
ser comum aos dois ambientes. Isso revê a regra do M1-C (o par ficava congelado até a pessoa
reaplicar a abertura) sem mexer no contrato: o M1-0 já registra a porta comum em
`pairedWallId`.

- Toda ação de cômodo (soltar, mover, editar, excluir) recalcula o par das aberturas que
  sobram (`modelo.ts: reparear`). A porta que passa a ficar entre dois cômodos fica comum aos
  dois; a que deixa de ficar entre eles dá para fora. A tela avisa a mudança.
- Medidas e posição nunca mudam sozinhas. Abertura que passa do fim da parede ou do
  pé-direito continua erro.
- Abertura que fica metade num trecho compartilhado e metade fora não tem par possível e
  continua erro, com a mensagem de limite de trecho.

## Decisões de implementação

- **Posição ao soltar:** o centro do cômodo fica onde o dedo soltou, com o mesmo encaixe de
  parede do arraste (12 px). Posição de gesto continua em mm inteiro, sem grade: o capturador
  não esconde o conflito com a grade de 5 cm do consumidor (M1.1-A).
- **Parede ao soltar porta/janela:** a mais próxima do ponto, até 24 px; em parede
  compartilhada, a do cômodo onde o dedo está. A distância sugerida centraliza a abertura no
  ponto solto, arredondada a 1 cm e contida na parede. Fora de qualquer parede, nada é criado.
- **Valores iniciais da abertura:** porta 0,80 × 2,10 m; janela 1,20 × 1,00 m com peitoril
  1,10 m. São sugestão editável, e o campo seleciona o texto ao receber foco. Risco de
  fidelidade (manter o padrão em vez da medida real) a observar nas sessões.
- **Distância** é medida a partir do canto marcado com um ponto: esquerdo nas paredes
  horizontais e de baixo nas verticais (a mesma origem do M1-0).
- **Toque longo:** 500 ms sem mover mais que 8 px. Mover antes disso é arraste.
- **Teclado virtual:** o pop-up acompanha a `visualViewport` (funciona em Android e iOS, sem
  depender de `interactive-widget`).
- Validação e mensagens continuam vindo do `modelo.ts`; o gate normativo segue sendo o M1-0
  em Python.

## Aceite

- Em 360 × 740, nenhuma rolagem de página do começo ao download.
- Arrastar e tocar adicionam cômodo e abertura; o pop-up abre preenchido onde cabe.
- A abertura (e o cômodo novo) aparece na planta e acompanha a digitação antes de confirmar.
- Toque longo e Editar abrem o item selecionado com os dados atuais; Excluir e desfazer
  funcionam.
- Pinça muda zoom e posição sem mover cômodo; Enquadrar volta a mostrar tudo.
- O export continua passando no M1-0 e no M1-A (testes existentes), e os testes novos do
  modelo cobrem posição ao soltar, parede mais próxima e distância sugerida.
