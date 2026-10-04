# Piloto de qualidade visual

Demonstração sintética de uma casa com dois dormitórios, gerada pelo pipeline
existente. Permite comparar Base e Acabamentos na mesma câmera e navegar por
Planta 2D, Planta 3D e Visita 3D. O acabamento usa madeira, algodão e cerâmica
CC0, separa superfícies de tecido/madeira/metal e acrescenta um sofá de geometria
própria leve. A implementação fica isolada nesta pasta.

O contrato está na [SPEC](SPEC.md). O procedimento de publicação temporária e
encerramento está em [PUBLICACAO](PUBLICACAO.md). URL, expiração, capturas e
medições da rodada pertencem ao registro de entrega; este README não substitui
essas evidências.

[Entrega, link temporário e verificações](ENTREGA.md).

## Reproduzir

Executar os comandos na raiz do repositório. Usar Node 24, dependências do
`package-lock.json` e Python com Pillow. A preparação registrada utilizou
Pillow 12.3.0 e libwebp 1.6.0; os hashes finais permitem conferir o resultado.
Não há instalação de Blender ou dependência nova neste piloto.

Para baixar e preparar os materiais pela primeira vez, o destino deve ser novo:

```powershell
python experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py --destino publicacao/piloto-qualidade-visual-2026-10-04/assets
```

Se os materiais já estiverem preparados, conferir sem baixar nem sobrescrever:

```powershell
python experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py --verificar publicacao/piloto-qualidade-visual-2026-10-04/assets
```

`--verificar` recebe o caminho do diretório de assets. Confere os nove mapas,
fontes locais, hashes, dimensões, espaços de cor, licença e orçamento. O
preparador recusa destino ocupado. Os originais ficam no diretório irmão
`originais/`, fora do pacote público.

Para gerar outra rodada, usar um agrupamento de saída novo. Este exemplo mantém
a rodada original e seus relatórios:

```powershell
node experimentos/piloto-qualidade-visual-2026-10-04/montar.mjs --assets publicacao/piloto-qualidade-visual-2026-10-04/assets --destino publicacao/piloto-qualidade-visual-2026-10-04/reproducao/site
```

O montador produz `entrada/` com leitura, contexto e mobiliário sintéticos;
`base/` com a maquete original e seu relatório E2E; e `site/` com apresentação,
maquete derivada, planta SVG, scripts e mapas permitidos. As referências aos
assets usam uma pasta identificada por hash. Uma mudança de mapas exige outra
versão; o montador verifica o inventário e a integridade da base antes de copiar.

Para abrir a reprodução localmente, servir apenas sua pasta `site/`:

```powershell
python -m http.server 8871 --bind 127.0.0.1 --directory publicacao/piloto-qualidade-visual-2026-10-04/reproducao/site
```

Abrir `http://127.0.0.1:8871/`. Preparação e montagem não fazem deploy. Todas as
saídas, downloads e evidências em `publicacao/` são ignorados pelo Git.

## Testes e qualidade

Os três arquivos abaixo contêm 17 testes focados:

```powershell
node --test tests/test_piloto_visual_build.mjs tests/test_piloto_visual_runtime.mjs tests/test_piloto_visual_metricas.mjs
```

Eles verificam manifesto e hashes, limite e lista de arquivos públicos,
preservação de entrada/base, recusa de destino ocupado ou adulterado, materiais
por demanda, espaços de cor, UV de iluminação, alternância A/B, identidade e
transformações dos móveis, recuperação de falhas e separação das amostras de
renderização entre modos/visibilidade.

Na preparação conferida, os **nove WebP somam 1.168.122 bytes**. Os originais
somam 18.866.098 bytes e permanecem no PC. A reconstrução reproduziu os nove
hashes finais; destino ocupado, hash adulterado e caminho fora da saída do
piloto foram recusados. O registro local é
`publicacao/piloto-qualidade-visual-2026-10-04/validacao-assets.json`.

| Material | Escala do patch | Cor | Normal/rugosidade |
|---|---:|---:|---:|
| Madeira | 1,7 m | 1024² | 512² |
| Algodão | 0,264 m | 512² | 512² |
| Cerâmica | 1,5 m | 1024² | 512² |

Cor usa sRGB; normal OpenGL e rugosidade usam dados sem conversão de cor. Normal
e rugosidade são WebP sem perda. A conversão das fontes de rugosidade PNG de
16 bits preserva a escala antes de gerar os mapas de 8 bits. Os mapas são
compartilhados e carregados quando o acabamento é solicitado. Uma falha restaura
o acabamento básico da superfície afetada.

Os limites desta etapa são 1,5 MB de mapas preparados e até 10 mil triângulos
adicionais. FPS, primeiro quadro e custo de renderização dependem da cena, do
navegador e do dispositivo; consultar as medições identificadas da rodada.
Largura móvel ou browser emulado não equivalem a teste em aparelho físico nem
concluem as sessões M1.1-A. O diagnóstico de `metricas.js` permanece em memória
e no DOM local, sem analytics, identidade de visitante, persistência ou envio.

## Fontes e licença

- [Wood Floor](https://polyhaven.com/a/wood_floor), de Dimitrios Savva.
- [Cotton Jersey](https://polyhaven.com/a/cotton_jersey), fotografia de colormass
  e processamento de Rico Cilliers.
- [Floor Tiles 08](https://polyhaven.com/a/floor_tiles_08), de Rob Tuytel.

A [licença CC0 da Poly Haven](https://polyhaven.com/license) permite modificar,
redistribuir e usar esses mapas comercialmente. [assets.json](assets.json)
registra URLs oficiais, autoria, escala, bytes e hashes das fontes e dos arquivos
preparados. A página funciona com cópias locais dos mapas; não consulta a API do
fornecedor no navegador. Não foram incluídos renders de preview ou logotipos.

CGAxis continua como possível fornecedor, condicionado à licença apropriada
para plataforma/catálogo. A indicação de uso comercial não concede, por si,
redistribuição de GLB/texturas extraíveis ou biblioteca selecionável em um site;
ver [TOS e licença](https://cgaxis.com/tos-license/). Este piloto usa somente CC0
e preserva uma estrutura que permite trocar o fornecedor depois.

## Janela de um mês para o primeiro cliente

Padronizar agora estilos, materiais, escala, móveis de referência e biblioteca.
O mês entre o primeiro cliente e a entrega deve validar o fluxo com os insumos
daquele cliente:

| Semana | Trabalho |
|---|---|
| 1 | Validar plantas, lote, medidas, fotos e demais inputs do cliente; resolver lacunas antes da produção. |
| 2 | Produzir casas de referência e revisar acabamento, fidelidade e padrão visual com o cliente. |
| 3 | Produzir o lote acordado e executar QA, incluindo celulares físicos e recuperação de falhas. |
| 4 | Fazer aceite, corrigir os problemas encontrados e conferir a entrega final. |

Essa janela orienta a organização. Capacidade e quantidade do lote dependem dos
inputs, da complexidade e dos resultados dos testes; o piloto não promete um
volume de casas nem um prazo universal para qualquer projeto.
