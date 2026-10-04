# Refinamento de paredes — 04/10/2026

[Mesmo preview atualizado](https://imobilaria-deccb-miniaturas--qualidade-piloto-20261004-tj49koea.web.app).
Após esta atualização, a expiração é **11/10/2026 às 14:37:09 BRT**.
O registro da primeira publicação permanece em [ENTREGA](ENTREGA.md).

O pedido foi acrescentar textura às paredes, com opção de comparação e download.
A pintura própria combina pigmento quase branco, granulação de rolo e relevo
suave. A diferença aparece melhor de perto em Visita 3D. Foram mantidos a cor
do cadastro, o bake, as dimensões, o índice da geometria e a UV de iluminação.
O acabamento abrange o lote de paredes/rodapés do gerador; o forro e as
esquadrias preservam seus materiais.

## Uso e custo

Na barra abaixo da maquete, **Paredes → Lisa / Texturizada** compara apenas
essas superfícies dentro de Acabamentos, sem mover a câmera ou mudar pisos e
móveis. Base restaura todos os materiais originais. Selecionar Texturizada em
Base ativa Acabamentos e reflete o estado nos dois controles.

**Baixar textura (relevo)** salva `pintura-rolo-relevo.png`, mapa de altura em
cinza, 256 × 256, 68.039 bytes. É o mesmo relevo usado na pintura; não é uma
fotografia ou textura de cor. O arquivo é servido como anexo, com link HTTP
comum para funcionar também no navegador do aplicativo. O PNG não é baixado
durante o carregamento da maquete.

Os três mapas da pintura são CanvasTexture de 256² compartilhados, gerados
localmente: cor em sRGB, relevo e rugosidade sem conversão de cor. O padrão
determinístico usa ladrilho de 40 cm com granulação média de aproximadamente
6,25 mm e grão fino; `bumpScale=0.0055`, sem deslocar vértices. A granulação é
visual e não representa medição de um revestimento comercial.

Não houve novos triângulos ou downloads de mapas para o renderer. Os nove WebP
anteriores continuam somando 1.168.122 bytes. O novo pacote tem **15 arquivos
enviados, 3.099.886 bytes sem compressão HTTP**; o PNG adicional só é transferido
quando solicitado. O Hosting acrescenta dois arquivos reservados de inicialização,
separados do conteúdo enviado.

## Verificação

- 27/27 testes passaram: materiais, UV/bake, pintura determinística, paredes
  giradas, alternância independente, fallback de Canvas, PNG e métricas por estado.
- O PNG foi decodificado por Pillow e por decoder independente na revisão;
  pixels RGBA idênticos aos de `PilotoVisual.paintPixels().bump`.
- Comparação no browser local e público preservou câmera e alvo. Lisa mantém
  Acabamentos ativo; Texturizada em Base ativa e reflete Acabamentos.
- Download local e público confirmado por evento real de download. SHA-256
  do arquivo recebido coincide com o pacote:
  `c4f25bedeaca1ef13d52ed6b751f5bc1e256478f58e8d89bc0640b4bad97b4d9`.
- Pintura carregada com três texturas procedurais, nove mapas importados e nenhuma
  falha registrada; console público sem erros/avisos observados.
- Layout de 390 × 844 sem overflow horizontal. A validação física continua 0/5;
  os 43 arquivos M1.1-A da baseline `4586e7c` passaram na conferência de integridade.

Release local `739b9275f86cf6d7`, versão Hosting `eb8b48a438441312`.
Expiração API `2026-10-11T17:37:09.148494317Z`. A verificação HTTP, metadata e estado dos oito
canais antigos está em
`publicacao/piloto-qualidade-visual-2026-10-04/verificacao-paredes.json`.
Capturas e observações ficam em `evidencias-paredes/` na mesma saída ignorada.
Os arquivos de entrada e o HTML E2E original não foram alterados.

## Reprodução

`PilotoVisual.paintPixels()` é uma função pura compartilhada pelo runtime e pelo
montador. A build executa a mesma fonte em VM, sem Three/DOM, e `png.mjs` codifica
o relevo usando zlib/CRC nativos do Node 24, sem dependências novas. O arquivo
gerado entra na lista permitida e no hash da release. A maquete continua gerando
os mapas no navegador; não consulta o PNG durante a renderização.

```powershell
node experimentos/piloto-qualidade-visual-2026-10-04/montar.mjs --assets publicacao/piloto-qualidade-visual-2026-10-04/assets --destino publicacao/piloto-qualidade-visual-2026-10-04/site --atualizar
node --test tests/test_piloto_visual_build.mjs tests/test_piloto_visual_runtime.mjs tests/test_piloto_visual_metricas.mjs tests/test_piloto_visual_png.mjs
```

O [procedimento de publicação](PUBLICACAO.md) continua restrito ao mesmo canal
temporário. Não foram reativados produção, API de rastreabilidade ou canais antigos.
