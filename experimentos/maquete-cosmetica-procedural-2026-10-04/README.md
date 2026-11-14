# Variação gráfica da maquete — patch preservado

Este arquivo guarda o diff local de `v1.5/miniaturas/pagina_maquete.py` anterior à
organização de 04/10/2026. Base: commit `f68f9a47ecaddb6b6ad6c033dd7503996b7e789a`.
O patch completo tem 27.378 bytes e SHA-256
`aa2bef3c4ceb655330a8db296622225735933d01de231f42004f250d012ee665`.

O ensaio mudava a detecção de hardware/conexão, sombras, exposição, mapas de ambiente,
texturas procedurais de móveis, UVs, materiais e duas luzes inferidas pelos nomes dos
cômodos. Também incluía altura de móveis, rotação fracionária e modo inicial pela URL.
Os efeitos visuais continuam inspecionáveis no [comparativo A/B](../comparativo-planos-3d/README.md).
Não há medição de FPS, memória GPU ou qualidade em aparelho físico que aceite estas
mudanças no gerador geral. A promessa de 60 FPS no comentário do patch não é um resultado.

Na fonte ativa foram mantidos apenas o modo pela URL e a altura nominal declarada.
A altura acompanha cada peça no `FloorPlan`, sem associação por índice; a rotação
continua no contrato de quartos de volta. O material compartilhado respeita as cores
de vértice já existentes, e os perfis de luz/sombra do gerador base foram restaurados.

O patch é evidência recuperável, não uma dependência do build. Nenhum script o aplica
automaticamente. Para estudá-lo, use um checkout separado na base indicada e faça
primeiro `git apply --check CAMINHO/pagina-maquete-original.patch`. Aplicá-lo na fonte
atual exige revisão, pois ela já mantém parte funcional do diff e o consumidor evoluiu.
