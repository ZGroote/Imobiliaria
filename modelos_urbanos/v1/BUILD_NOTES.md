# Biblioteca urbana / primeira edição

Objetivo: 20 casas térreas, 20 sobrados e 20 prédios residenciais fictícios, destinados ao entorno ilustrativo do portal. Não são reconstruções de endereços reais.

Pipeline: text-to-blender → blender-skill-harmonizer → modeling/materials/cameras/lighting/rendering → inspeção visual → export. Blender separado da cena aberta; nenhuma alteração ao portal ou publicação.

Contrato: metros; Blender Z para cima e fachada principal para -Y; GLB Y para cima, fachada +Z. Origem no centro horizontal da caixa envolvente, base Z=0. Cada ativo traz dimensões externas reais no catálogo. Não esticar arbitrariamente para caber nos lotes.

Modelos sem interiores. Vidros opacos escuros para evitar transparência e mostrar apenas o envelope. Dois materiais compartilhados com cor por vértice. LOD0 possui esquadrias, sacadas, coberturas e detalhes; LOD1 simplifica as mesmas formas, não substitui por uma arquitetura diferente. LODs exportados separadamente, a aplicação deve escolher um deles.

As dimensões são de projetos conceituais: portas de entrada ~0,95 × 2,15 m, janelas residenciais próximas de 1,2 × 1,2 m, pavimentos de 3 m. Referência humana e de aberturas consultada em text-to-blender/references/common-object-dimensions.md. Não são projetos executivos nem atestam conformidade construtiva.

Validação: contagem por categoria, geometria finita, áreas não degeneradas, dimensões, origem, número de materiais, orçamento de triângulos, redução de LOD e geometria distinta. Renderização de cada ativo e inspeção das folhas de contato antes do aceite. Round-trip de GLB para conferir cores, dimensões e orientação.

Ruflo/ToolSearch não estavam disponíveis na lista de ferramentas desta sessão; execução local sequencial.
