# Piloto de qualidade visual

Demonstração sintética de 59,64 m² com dois dormitórios, gerada pelo pipeline
existente. Base/Acabamentos e Lisa/Texturizada comparam a mesma arquitetura sem
mover a câmera. Planta 2D, Planta 3D e Visita 3D continuam disponíveis.

A rodada atual usa cinco materiais reais da Poly Haven: reboco decorativo,
madeira do piso, madeira própria para marcenaria, tecido de trama e cerâmica.
Cada um possui albedo, normal OpenGL e rugosidade. A pintura procedural anterior
foi substituída após o usuário informar que a diferença visual era insuficiente.
As amostras da barra lateral mostram os albedos realmente usados na maquete.

O contrato está na [SPEC](SPEC.md). O resultado atual, fontes, medições,
verificações e expiração estão em [MATERIAIS-REAIS](MATERIAIS-REAIS.md).
[ENTREGA](ENTREGA.md) e [PAREDES](PAREDES.md) preservam as rodadas anteriores.
A publicação continua restrita ao [preview temporário](PUBLICACAO.md).
O [guia explicativo de acabamentos PBR](../../relatorios/guia-acabamentos-pbr-2026-10-04.md)
documenta as fontes, a preparação, a implementação e o caminho para padronizar o processo.

## Reprodução

Usar Node 24, dependências existentes e Python com Pillow. A preparação registra
as versões de Pillow/libwebp e verifica fontes e arquivos preparados por hash.
Não há dependência nova ou instalação de Blender.

O destino da preparação deve ser novo. Para reproduzir sem sobrescrever a rodada:

```powershell
python experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py --destino publicacao/piloto-qualidade-visual-2026-10-04/repro-materiais-v2/assets
python experimentos/piloto-qualidade-visual-2026-10-04/preparar_assets.py --verificar publicacao/piloto-qualidade-visual-2026-10-04/repro-materiais-v2/assets
node experimentos/piloto-qualidade-visual-2026-10-04/montar.mjs --assets publicacao/piloto-qualidade-visual-2026-10-04/repro-materiais-v2/assets --destino publicacao/piloto-qualidade-visual-2026-10-04/repro-materiais-v2/site
```

O preparador confere os quinze mapas, fontes locais, hashes, dimensões, licença,
espaços de cor e orçamento de 3 MB. Os originais ficam em `originais/`, fora do
site. Essa ampliação do orçamento substitui o limite inicial de 1,5 MB para
permitir parede e marcenaria próprias; não representa garantia de desempenho.
Cor vai até 1024²; normal/rugosidade até 512². Mapas de dados usam WebP sem perda.

O montador produz `entrada/` e `base/` pela fixture e pelo pipeline existentes;
`site/` recebe apenas a apresentação, maquete derivada, scripts, planta, mapas e
uma cópia do albedo da parede para download. Uma alteração nos assets gera nova
pasta de hash e exige uma saída nova. Downloads e saídas em `publicacao/` são
ignorados pelo Git. Para abrir localmente:

```powershell
python -m http.server 8871 --bind 127.0.0.1 --directory publicacao/piloto-qualidade-visual-2026-10-04/repro-materiais-v2/site
```

## Verificação e limites

```powershell
node --test tests/test_piloto_visual_build.mjs tests/test_piloto_visual_runtime.mjs tests/test_piloto_visual_metricas.mjs
```

Os testes verificam integridade, orçamento, saídas preservadas, materiais por
demanda, UVs, seleção das partes de móveis, fallback e alternância sem mudar a
câmera. A percepção exige comparação no browser real, especialmente depois da
falha visual da rodada procedural; contrato de código sozinho não dá esse aceite.

O renderer compartilha mapas e acrescenta apenas a geometria leve do sofá. Faces
com tecido/madeira usam a cor do albedo; ferragens e superfícies de outro material
mantêm sua aparência. O diagnóstico de `metricas.js` permanece em memória/DOM,
sem identidade de visitante, persistência ou transmissão. Valores de frames e
primeiro quadro dependem da máquina e da visibilidade da aba. Largura móvel no
browser não conclui as cinco sessões físicas M1.1-A, que continuam pendentes.

A [licença CC0](https://polyhaven.com/license) permite modificar e redistribuir
os mapas. [assets.json](assets.json) fixa fontes, autoria, escala, bytes e hashes.
A página usa cópias locais e não consulta a API do fornecedor. CGAxis pode ser
avaliada depois com licença apropriada para plataforma/catálogo.

## Primeiro cliente

O mês entre o primeiro cliente e a entrega orienta: semana 1 para validar insumos;
semana 2 para casas de referência e aceite visual; semana 3 para produzir o lote
acordado e testar em celulares físicos; semana 4 para correções e aceite final.
Quantidade e capacidade dependem dos insumos e da complexidade; este piloto não
promete um volume de casas ou prazo universal.
