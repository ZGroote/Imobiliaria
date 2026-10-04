# Do anúncio ao Blender

O comando coleta as fotos do imóvel, pede uma análise visual ao Codex já autenticado e constrói geometria editável no Blender. Não usa serviços de geração de malhas, modelos de marketplace, texturas externas, servidor próprio ou API paga adicional. A análise usa normalmente a conta do Codex e exige internet; extração das fotos também. A construção, exportação e reconstrução a partir da receita salva funcionam localmente.

```powershell
python modelos_cadastrados/processar_anuncio.py "https://roca.com.br/imovel/locacao/casas/sao-carlos/madre-cabrini/57881"
```

O resultado fica em `modelos_cadastrados/processados/<hash-da-url>/`:

- `anuncio.json` e `fotos/`: dados, fotos, origens, dimensões e hashes.
- `receita.json`: geometria por peças, cores, referências e estimativas. Pode ser editada à mão ou nesta conversa.
- `receita.origem.json`: vínculo com a URL e as fotos efetivamente analisadas.
- `projeto.blend`: projeto editável.
- `exterior.glb`: modelo para o visualizador 3D.
- `frente.png` e `perspectiva.png`: renders para comparação com as fotos.
- `revisao.html`: página local com renders, galeria de fotos e referências por peça; sem CDN ou JavaScript.
- `processo.json`, `analise.log` e `blender.log`: situação e diagnóstico de cada etapa.

## Trabalho local e sem nova análise por IA

```powershell
# Somente coletar referências, sem IA nem Blender
python modelos_cadastrados/processar_anuncio.py "URL" --preparar

# Refazer o Blender com uma receita editada e as fotos já coletadas: sem rede
python modelos_cadastrados/processar_anuncio.py "URL" --receita "caminho/receita.json"

# Reexecutar o mesmo comando reutiliza as fotos e a receita existentes
python modelos_cadastrados/processar_anuncio.py "URL"

# Buscar fotos atualizadas e gerar nova proposta
python modelos_cadastrados/processar_anuncio.py "URL" --atualizar-fotos --reanalisar
```

Use a mesma URL e o mesmo `--destino` ao continuar um processo. `--destino` permite escolher a pasta. `--blender` ou a variável `BLENDER_EXE` localizam outra instalação; `--codex` seleciona o executável do Codex. `--sem-render` dispensa imagens de revisão durante ajustes intermediários.

Requisitos locais: Python com Pillow, Blender e, para análise automática, Codex CLI autenticado. A receita é JSON limitado e validado; o texto do anúncio e a resposta da IA não são executados como Python. O construtor usa primitivas próprias de parede, porta, janela, telhado, grade, cilindro, escada e malhas para formas específicas. Detalhes repetidos são construídos localmente pelo Blender.

## Qualidade e limites

Todas as fotos coletadas entram na análise. Cada peça registra suas referências e se contém estimativas. A proposta procura reproduzir volumes, vãos, telhados, recuos, esquadrias, muros e acabamentos visíveis. Partes sem fotografias ou medidas continuam sendo estimativas; detalhes ocultos e a planta interna completa não podem ser recuperados com garantia a partir de um anúncio.

O término do comando significa **aguardando revisão**, não reconstrução aprovada. Compare os renders com as fotos, ajuste `receita.json` e reconstrua. O programa não publica nem troca o imóvel no mapa automaticamente. Os dados de orientação e implantação no lote precisam de confirmação antes dessa integração.

Roca tem um extrator específico da galeria do imóvel; outros sites usam dados estruturados e galeria principal quando identificáveis. Anúncios indisponíveis, bloqueados ou sem fachada suficiente retornam uma limitação, em vez de gerar uma casa genérica e chamá-la de réplica.

## Verificação do código

```powershell
python -m unittest discover -s modelos_cadastrados/pipeline -p "test_*.py"
```

## Teste real realizado em 13/09/2026

Anúncio Roca 57881: 16 fotos originais de 1024 × 768, receita automática de 51 peças, 121 objetos de geometria. O comando produziu projeto Blender, GLB e duas imagens renderizadas. A execução seguinte reconstruiu os mesmos arquivos a partir do cache, com o executável Codex deliberadamente indisponível; não houve nova análise por IA.

A amostra fica em `modelos_cadastrados/processados/teste-pipeline-57881/`. É um estudo de exterior: o anúncio não oferece planta completa nem vistas suficientes para confirmar a implantação do corredor, os fundos e toda a cobertura. Essas limitações estão registradas na receita e na página de revisão.

32 testes automatizados do pipeline passaram. O construtor foi ainda testado no Blender 5.2.1 com as nove famílias de geometria, referências empacotadas, exportação e orientação do GLB. A correção da forma arquitetônica de novos anúncios sempre exige a comparação visual do resultado com as fotos.
