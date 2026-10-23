# Experiência de compra em teste — 23/10/2026

Implementação autorizada pelo usuário com pedido de marcar as mudanças para remoção.
Marcador em todas as integrações: `EXPERIMENTO-COMPRA-20261023`.

- Um toque na fachada ou lista seleciona e mostra a ficha. Dois toques seguidos no
  mesmo apartamento da fachada abrem a planta 2D; o botão “Ver planta” também abre.
  O par exige até 500 ms e até 24 px entre os toques. Arrastar, pinçar, cancelar ou
  tocar no fundo interrompe o par. Aguarda associação válida; não oferece uma
  planta genérica quando a associação falta. Marcador: `DUPLO-TOQUE-20261023` em
  `picking.js`; `renderer.js` comunica a confirmação e `viewer.js` decide a abertura.
- As ações do visitante abrem a planta. Restauração dos links, seleção pela API e
  retorno ao prédio continuam sob controle explícito, sem reabrir a planta em loop.
- Contato monta mensagem com apartamento, andar, área e endereço público. Em links
  individuais usa somente o telefone público e o responsável revalidados pela API.
  Sem telefone cadastrado, permite copiar a mensagem ou selecioná-la manualmente.
  Não configura telefone, não envia mensagem sozinho e não adiciona um atendente IA.
- A base neutra sob o terreno foi retirada em 23/10 a pedido do usuário, que
  identificou a mancha verde no fundo. Depois de confirmar que a navegação voltou
  ao normal ao reabrir o site, ele cancelou a alteração de movimento; os controles
  ficaram como estavam. O mapa existente mostra a região real.
- Ações internas em uma linha; painel lateral também no celular deitado. Mantém
  o limite da página à tela e a rolagem interna das informações.

## Comparar e desligar

A faixa “Experiência em teste” oferece **Usar versão anterior**. O endereço recebe
`experiencia=original`; **Voltar ao teste** usa `experiencia=nova`. Links individuais
preservam essa opção, o apartamento e o token ao comparar e compartilhar.

O padrão fica na primeira constante de `experiencia-compra.js`: mudar
`EXPERIENCE_DEFAULT` para `false` desativa para endereços sem opção explícita.
Reempacotar/publicar é necessário, pois o site usa bundles. Não apagar esse módulo
isoladamente: `viewer.js` e `renderer.js` o importam.

Para remoção completa, procurar o marcador, retirar as integrações, os elementos
`experience*`/`buyer*` do HTML, o bloco final do CSS e o módulo. A restauração de
unidade/modo pelo endereço também atende mensagens de interesse e links antigos.
O contato público da API já existia e não precisa ser removido do servidor.

O ajuste posterior de fundo 3D, solicitado separadamente, tem o marcador
`FUNDO-3D-20261023` em `interior.html` e `interior-renderer.js`. Usa o mesmo gradiente
CSS da maquete e canvas transparente, mantendo o ambiente de iluminação. Esse
ajuste visual vale também ao comparar a navegação anterior. Sua cópia está em
`publicacao/liv-duplo-20261017/backup-antes-fundo3d-20261023/`.

`FUNDO-2D-20261023` marca o recorte visual da margem das plantas. O JPEG original
não muda; `tipologias.js` indica a máscara SVG e a posição do indicador de entrada,
e `planta2d.js` conserva seu alinhamento ao ampliar e redimensionar. O indicador
tem contraste no fundo escuro. Cópia anterior em
`publicacao/liv-duplo-20261017/backup-antes-fundos2d-base-20261023/`.

## Recuperação da versão publicada anterior

O ajuste de toque duplo conserva o pacote imediatamente anterior em
`publicacao/liv-duplo-20261017/backup-antes-duplo-toque-20261023/`, com hashes,
manifestos e referência da função. Para desfazer só esse ajuste, recuperar
`picking.js`, `renderer.js` e `viewer.js` dessa referência, recompor os bundles e
preparar a publicação; conservar as correções de fundo e os builds antigos.

`publicacao/liv-duplo-20261017/backup-antes-experiencia-compra-20261023/` conserva os
arquivos alterados do pacote, manifestos, entrada de acesso e configuração da função.
`files-before.json` registra hashes de todos os arquivos anteriores. O preparador de
experiência não sobrescreve essa cópia. Builds e assets anteriores são preservados.
LIV Novo, Analytics, estoque, modelos e TRACKING_SECRET não fazem parte do experimento.

Preparação: `preparar-experiencia-compra-20261023.py`, otimizador existente,
`atualizar-experiencia-compra-20261023.py`, `python conecta/preparar.py`, preparador
de rastreabilidade com a origem `https://conectaimoveis3d.com.br`. Quando gerar outro
build, publicar Hosting antes da função que passa a apontar para ele.
