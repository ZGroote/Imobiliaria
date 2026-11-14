# Materiais reais — correção de 04/10/2026

[Preview atualizado](https://imobilaria-deccb-miniaturas--qualidade-piloto-20261004-tj49koea.web.app/).
Expira em **11/10/2026 às 15:19:19 BRT**.

O usuário comparou Lisa/Texturizada e informou que não havia diferença visual
suficiente. A parede Base já tinha pintura procedural; acrescentar grão fino de
baixo contraste repetia essa aparência. Esta rodada substitui o procedimento
por mapas reais baixados, como os do piso, e corrige os acabamentos dos móveis.
[PAREDES](PAREDES.md) preserva o histórico da versão rejeitada.

## Materiais e aplicação

| Uso | Fonte real CC0 | Patch físico | Bytes dos três mapas |
|---|---|---:|---:|
| Parede | [Patterned Clay Plaster](https://polyhaven.com/a/patterned_clay_plaster) | 2 × 2 m | 508.856 |
| Marcenaria | [Natural Walnut Veneer](https://polyhaven.com/a/natural_walnut_veneer) | 1 × 1 m | 384.634 |
| Tecido | [Wool Boucle](https://polyhaven.com/a/wool_boucle) | 0,315 × 0,3901 m | 780.268 |
| Piso de madeira, preservado | [Wood Floor](https://polyhaven.com/a/wood_floor) | 1,7 × 1,7 m | 415.050 |
| Piso frio, preservado | [Floor Tiles 08](https://polyhaven.com/a/floor_tiles_08) | 1,5 × 1,5 m | 374.914 |

A parede tem marcas de desempenadeira e tom quente de argila. Um ganho neutro
1,7 no clone do material clareia o albedo nesta cena, sem emissão, luz adicional
ou alteração do bake. Normal OpenGL dá o relevo sem deslocar a geometria. A UV1,
índices, posições e callbacks de iluminação originais são preservados.
Lisa restaura o material original das paredes/rodapés, mantendo pisos e móveis
em Acabamentos. O forro e as esquadrias continuam com os materiais originais.

Marcenaria usa veios contínuos próprios, sem juntas de tábuas do piso. Os grupos
com madeira/tecido usam a cor do albedo, sem a multiplicação pelo tint do cadastro
que escurecia a textura. Máscaras da biblioteca real identificam faces herdadas,
inclusive quando corpo e ferragem coincidem em cor. Nichos de madeira fixa dos
aéreos e todas as faces do tapete passam a receber acabamento; ferragens, tampos,
cubas, eletros e cerâmicas preservam seus materiais. A imagem de tecido é
retangular, e U/V respeitam largura e altura físicas independentes.

Na casa gerada, **16 das 21 peças** recebem tecido/marcenaria. Cinco peças de
eletros/cerâmica não recebem esses materiais. O sofá mantém posição, identidade
e dimensões nominais, com 720 triângulos na versão própria. Base restaura todas
as geometrias e materiais originais; ambas as comparações preservam a câmera.

**Baixar textura (cor)** entrega `parede-reboco.webp`, 1024², 94.374 bytes,
byte a byte igual ao albedo usado na cena. SHA-256:
`8c8e3d92a07b07095063227f36be18ebe0e51c2b2ce170587c5d407c7ca41cad`.
É servido como anexo, sem cache, e baixado somente mediante solicitação. Não é
mais o PNG procedural de altura. As cinco amostras laterais usam os albedos reais.

## Custo e verificação

Os **15 WebP somam 2.463.722 bytes**. O teto foi revisado conscientemente de
1,5 para 3 MB para incluir parede/marcenaria próprias e tecido mais evidente.
Os originais somam 36.671.717 bytes e ficam somente no PC. Cor usa sRGB até
1024²; normal/rugosidade usam dados sem espaço de cor até 512², WebP sem perda.
As texturas são compartilhadas. O pacote possui 21 arquivos enviados, total
4.424.354 bytes sem compressão HTTP. Hosting registra dois arquivos reservados
adicionais, separados do inventário enviado.

- 22/22 testes focados passaram, incluindo máscaras da biblioteca/fábrica real,
  colisões de cor, orçamento, falha de parede e restauração independente.
- Reprodução dos quinze mapas e manifesto foi byte a byte idêntica. Adulterações
  de mapa/proporção, destino ocupado e saída externa foram recusadas.
- Comparações locais e públicas Lisa/Texturizada preservaram câmera e alvo.
  A comparação dos móveis também preservou a câmera; capturas foram revisadas.
- Browser público carregou cinco materiais/quinze mapas, 18 meshes alterados,
  zero falhas e zero máscaras incompatíveis; console sem erros/avisos observados.
- Download real local confirmado por evento do browser, com SHA igual ao albedo;
  arquivo público também foi conferido por hash, pixels Pillow e cabeçalhos.
- Layout em 390 × 844 sem overflow horizontal. Planta 2D, Planta 3D e Visita 3D
  continuam funcionando. Isso não substitui as cinco sessões em celulares reais.

Na planta pública, foram observados 44 draw calls, 63.814 triângulos e 24 texturas
na GPU. A amostra do desktop visível teve p50 de aproximadamente 16,7 ms e p95
16,8 ms. O primeiro frame observado pelo diagnóstico foi 1.444,4 ms. Esses valores
são desta máquina/aba; o diagnóstico começa após iniciar o renderer e não mede
o primeiro pixel com rede controlada. Não constituem garantia de FPS ou celular
homologado. As sessões físicas M1.1-A permanecem 0/5; suas fontes não foram editadas.

## Registro e reprodução

Release local `f3aab36655b0c021`, versão Hosting `55eb39d190fa43de`.
ReleaseTime `2026-10-04T18:19:23.501Z`;
expireTime `2026-10-11T18:19:19.772100439Z`.

Saída atual em `publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/`:
`validacao-assets.json`, `verificacao-materiais-reais.json` e `evidencias/`.
Os 21 hashes públicos conferem. Os oito canais anteriores conservam as releases
SITE_DISABLE e seus oito URLs, além dos quatro aliases firebaseapp.com, estão
em 404. Não foram ativadas APIs de rastreabilidade ou publicações de produção.

Entrada, contexto e HTML E2E são byte a byte iguais à rodada original. SHA do
HTML base: `3b3a4c2aefb53cb198fd271a276491d861ed285bacbb90fac6e2259571f638c0`.
Os assets anteriores e seu pacote foram preservados. O inventário atual fica em
[assets.json](assets.json); a regra local eol=lf estabiliza seus bytes no Windows.
A [licença oficial CC0](https://polyhaven.com/license) permite usar e redistribuir
estes mapas. Não foram copiados renders de preview ou logotipos do fornecedor.

Para verificar a rodada preparada e atualizar apenas a derivação com os mesmos
assets, sem fazer deploy:

```powershell
python experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py --verificar publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/assets
node experimentos/piloto-qualidade-visual-2026-10-04/montar.mjs --assets publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/assets --destino publicacao/piloto-qualidade-visual-2026-10-04/materiais-v2/site --atualizar
node --test tests/test_piloto_visual_build.mjs tests/test_piloto_visual_runtime.mjs tests/test_piloto_visual_metricas.mjs
```

Para uma reprodução nova, seguir o [README](README.md). Uma alteração de mapas
exige outra pasta e outro hash. A publicação usa o [procedimento de preview](PUBLICACAO.md).
