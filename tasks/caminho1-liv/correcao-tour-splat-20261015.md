# Execução: correção do Tour com splats

Pedido: fazer a parte local; o treino será em GPU alugada.
Detalhes e reprodução: [CORRECAO-SPLAT.md](../../experimentos/liv-experimental-2026-10-14/CORRECAO-SPLAT.md).

- [x] Reproduzir defeitos no Tour publicado e localizar seleção de cômodo/render/captura.
- [x] Corrigir sincronização de câmera, erros e encerramento; testar cache e respostas atrasadas.
- [x] Testar percurso dos seis ambientes no navegador com os SOG atuais.
- [x] Planejar piso/teto/portas para piloto e apartamento completo, reservando posições de avaliação por cômodo.
- [x] Renderizar e conferir uma amostra local de 12 imagens.
- [x] Preparar pacote com fonte empacotada, plano, comandos e verificação antes do treino.
- [x] Renderizar as 678 imagens do piloto de 2h na GPU alugada; plano de 1.355 preservado para expansão.
- [x] Treinar e avaliar o piloto contínuo na GPU alugada.
- [x] Comparar percursos com referências, converter PLY para SOG e integrar em prévia.
- [ ] Validar qualidade/desempenho em tela estreita, larga e aparelho físico com o splat novo.
- [x] Treinar, avaliar e preservar uma experiência contínua do apartamento completo com as capturas disponíveis.
- [ ] Completar o cenário externo e recapturar piso/teto de quartos e banhos com o perfil novo.
- [ ] Aprovar a qualidade visual e publicar.

Dependências: o treino depende do render completo; a integração depende da inspeção do resultado.
Critério visual: sem buracos pretos ou grandes deformações no percurso sala → varanda → sala,
incluindo portas, piso e teto. Não aprovar só pelas métricas médias.

Execução de 15/10: duas A100 40 GB, Blender 5.2.2, Nerfstudio 1.1.5,
Torch 2.4.1/CUDA 12.4 e gsplat 1.4.0. O plano de 678 vistas mantém as 57 posições,
1280×720, 128 amostras e três inclinações; usa quatro rumos exatos sem jitter.
585 vistas de treino e 93 de avaliação, em posições separadas.
Fim do aluguel informado pelo usuário: 19:12:50 Brasília. Capturas são copiadas em lotes;
checkpoints nos marcos de 10k/20k/final. Exportação de segurança às 19:02 na GPU 1.
Compatibilidade CUDA, treino curto, exportação PLY e leitura SOG no navegador verificadas.
Esses testes curtos não aprovam a qualidade do modelo final.

Piloto final de 30 mil etapas preservado localmente: checkpoint, PLY, SOG de 16,5 MB,
93 pares de avaliação e métricas. PSNR 29,94 dB; SSIM 0,9691; LPIPS 0,0904.
Há deformações em vidro/reflexos e contornos de móveis;
a aprovação visual segue pendente. Prévia: `prova-splat.html?piloto=1`.

Experimento adicional global: 678 vistas novas + 478 antigas dos outros quatro cômodos.
São 1.009 vistas de treino e 147 de avaliação, separadas por posição; intrínsecos por quadro.
Duas vistas antigas foram repetidas na fonte atual: SSIM 0,999999 e 0,999891.
O treino global de 30 mil etapas terminou; PLY, 147 avaliações, checkpoint e SOG estão preservados localmente.
SOG: 661.301 gaussianas, 11,3 MB. Percurso real dos seis cômodos passou com arquivo único e aproximadamente
60 fps no desktop GTX 1650. PSNR agregado 30,97 dB; SSIM 0,9737; LPIPS 0,0943.
As médias agregadas não são comparáveis diretamente ao piloto (147 contra 93 vistas).
Nas mesmas 93 vistas, PSNR do piloto/global: 29,92/28,79 dB; a varanda continua limitante.
As capturas dos quartos e banhos mantêm a cobertura angular antiga. Isso não equivale
a renderizar o plano novo completo de 2.809 imagens.

**Qualidade visual reprovada para publicar**: o teto da suíte está borrado; há deformações de vidro/reflexos.
A área preta ao lado do sofá foi reproduzida no Cycles com a câmera exata do navegador.
Dois raios atravessando essa área não atingiram geometria: é o fundo externo da própria cena,
e não apenas falha de troca de splats. Preservar `evidencias/referencia-sala.png` e
`evidencias/global-teto-suite-reprovado.png` ao planejar a próxima captura.

## Preparação corrigida de 16/10

Pedido atual: deixar a fonte e as referências locais conferidas antes de outra GPU.
Pasta de trabalho: `experimentos/liv-experimental-2026-10-14/piloto-render/correcao-20261016`.

- [x] Conferir a abertura preta contra o cadastro: corresponde à entrada `a5`, sem folha.
- [x] Adicionar porta fechada de 0,80 × 2,10 m na fonte copiada e verificar os dois raios da falha.
- [x] Corrigir o material da folha sem depender do UV/atlas da malha original.
- [x] Preparar variante de vidro fino com transmissão reta e reflexão Fresnel; original preservado.
- [x] Gerar plano novo: 2.590 vistas, 109 posições, todos os cômodos com piso/horizonte/teto em treino e avaliação.
- [x] Ajustar o empacotamento para preservar todos os parâmetros e somente referências da fonte correta; testes passaram.
- [x] Concluir e inspecionar 18 referências locais a 1280×720 e 128 amostras na fonte final.
- [x] Comparar vidro original/fino nas mesmas câmeras, validar e fechar o ZIP.

Scripts: `corrigir_fonte_captura.py`, `amostrar_correcao.py`, `validar_preparo.py`.
As primeiras 18 referências revelaram outro preto na janela da varanda: céu Nishita sem terreno
abaixo do horizonte. A fonte anterior e as referências estão em `correcao-20261016-antes-fundo`.
A fonte final acrescenta um fundo neutro, sem representar a vista real. A região testada passou de
luminância média 0,54 para 175,07 na mesma câmera (escala 0–255). As referências finais são
renderizadas novamente, sem misturar as versões. Execução: `amostras-finais.log`;
comparação dos vidros, validação e ZIP ficam encadeados após esse render.
Retomada manual e comandos em `correcao-20261016/README.md`.
O primeiro ensaio da porta, escuro por usar atlas sem UV, está em `correcao-20261016-tentativa1`.
Ainda não há treino novo nem aprovação de qualidade do splat.

Preparação local concluída: `validacao-local.json` confirma 18 imagens finais, cobertura
de piso/horizonte/teto nos seis cômodos, posições separadas de treino/avaliação e fonte única.
Entrada: luminância média da região antes/depois 0,08/175,15. Fundo da varanda: 0,54/175,07.
As duas comparações de vidro preservam porta, geometria, mundo e câmeras; só muda o material.
As diferenças estáticas são discretas. A melhora da reconstrução neural ainda precisa ser testada.

`pacote-apartamento-corrigido.zip`: 25.322.678 bytes. Manifesto com 33 arquivos conferido.
SHA-256: `b87a49bf1ec2a96898417088f788333040d1749117dcd725cee90d50b1d8bb49`.
Extraído e testado: `bash -n executar.sh`, validador e reprodução do plano no Blender 5.2.2 passaram.
A validação final foi repetida após normalizar separadores de caminhos Windows no relatório.
O erro anterior do encadeamento foi resolvido; o pacote acima é o resultado da execução validada.

Próxima etapa em GPU: renderizar as 2.572 imagens restantes, treinar e avaliar o modelo novo.
Não misturar com as capturas anteriores. A fonte inclui fundo externo neutro, sem afirmar vista real.
