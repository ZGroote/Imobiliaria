# Topos das paredes — Canto e Meio

As manchas pretas/cinzentas das quinas eram reproduzíveis também na primeira abertura da v10. A comparação de pixels antes/depois de seis trocas em WebGPU e WebGL foi idêntica: não houve mistura entre as cenas retidas. A fonte possui superfícies coplanares nos encontros dos segmentos, além de valores RGBM diferentes nesses topos coincidentes.

`gerar_topos_paredes.py` extrai a união do contorno horizontal das faces superiores, a partir dos snapshots imutáveis e dos seus hashes. Área repetida encontrada: Canto **0,346450 m²**, Meio **0,339950 m²**. A união preserva buracos e quinas côncavas; a simplificação elimina subdivisões colineares dentro da precisão float32.

`interior-wall-tops.js` retira as faces superiores antigas da lista de desenho e as substitui por uma única malha triangulada, na mesma altura, com o material PBR nativo da parede. Não há decal, deslocamento, polygon offset ou segunda superfície acima das originais. O topo exposto recebe iluminação normal, em vez de usar os valores conflitantes do bake. As demais faces mantêm atributos, UV1, texturas e RGBM. Tanto a geometria com bake quanto a variante de edição dos móveis recebem a mesma correção. Fontes, arquivos de iluminação, atlas e cadastro permanecem imutáveis.

Os topos unidos acompanham o corte em Planta 3D e permanecem no Tour, sem serem classificados como forro. A reutilização das duas cenas continua limitada, com as inativas suspensas também em Maquete/2D/mapa e descarte ao encerrar a página/visualizador.

Validação:

- `test_interior_wall_tops.mjs`: 11.786 raios independentes comparam a cobertura da união com a fonte, encontram 70 amostras antes sobrepostas e conferem uma única superfície após a correção; verifica área, normais e preservação dos atributos restantes.
- `qa_estabilidade_visual_plantas.py`: compara pixels e identidade de materiais/geometria em seis alternâncias, em WebGPU, WebGL e toque emulado.
- `qa_corte_interiores.py`: paredes completas/baixas, RGBM, forro/Tour, preferências e descarte nos três perfis.
- `qa_troca_plantas.py`: reuso rápido, câmera/móveis, cena suspensa, seleção rápida, isolamento de perda do dispositivo e descarte.

Prévia local; toque é emulado. Não representa qualificação de um celular físico.
