# Relatório da Frente Relatório (`viabilidade/relatorio/`)

## O que foi entregue

1. **`viabilidade/relatorio/relatorio.py`**
   - Uso via linha de comando:
     ```bash
     python -I -X utf8 viabilidade/relatorio/relatorio.py --estudo X.json --saida Y.html
     ```
   - Utiliza exclusivamente a biblioteca padrão do Python (`argparse`, `html`, `json`, `math`, `pathlib`, `typing`), sem dependências externas e sem acesso à internet (CSS e gráficos SVG 100% embutidos no HTML).
   - **Layout A4 para impressão (`@page { size: A4 portrait; margin: 8mm; }`)**:
     - **Capa (Página de Comparação Lado a Lado)**:
       - Cabeçalho com identificação do lote (`id`, `lid`, `loteamento`, `quadra`, `area_m2`), zona (`id`, `nome`), versão do motor e datas das fontes legais.
       - **Painel de conferência separado em duas caixas**:
         1. **Números da zona conferidos na lei (`zona.conferido`)** com as fontes oficiais (`zona.fontes`).
         2. **O terreno está nessa zona? (`lote.zona_conferida` e `lote.zona_origem`)**, avisando explicitamente que *"números da zona conferidos" ≠ "o terreno está nessa zona"* e destacando zonas ambíguas (`anotacao_zoneamento.zona_ambigua`).
       - Resumo dos parâmetros da zona, caixa máxima e relevo do lote.
       - Tabela comparativa lado a lado com todas as opções, miniaturas da planta 2D e vista 3D axonométrica em SVG, os 4 números grandes (unidades, área privativa vendável, vagas, VGV estimado / `"informe o preço"`), CA usado, TO usada, pavimentos, altura no topo, quadro de áreas e alertas por opção.
       - Destaque para `lote.areas_especiais` e `estudo.incertezas`.
     - **Uma página A4 por opção (`opcoes`)**, seguindo a ordem da seção 7 de `viabilidade/produto/ESTUDO-REAL.md`:
       1. **Cabeçalho** (lote, opção, versão do motor e leis + painel compacto `zona.conferido` × `lote.zona_conferida`).
       2. **Imagens em SVG** desenhadas a partir das coordenadas UTM do JSON:
          - **Planta de implantação 2D** (polígono do lote/área permeável, projeção da caixa máxima/recuos, parede cega se houver, projeção de cada volume por uso com hachura no subsolo, destaque da frente/acesso, indicação de norte e barra de escala métrica).
          - **Vista 3D axonométrica** com os volumes extrudados dentro da **caixa máxima transparente**.
       3. **Os 4 números grandes**: Unidades estimadas, Área privativa vendável (m²), Vagas e VGV estimado (`"informe o preço"` quando `null`).
       4. **Uso da lei**: tabela com Usado × Permitido × Folga/Outorga e semáforo (CA, TO, Permeabilidade, Altura/Pavimentos e Recuos).
       5. **Quadro de áreas resumido** (no espírito do Quadro I da NBR 12721): volumes/blocos com cota `z0_m`, `altura_m`, `pavimentos`, projeção e recuos, além dos totais (`area_construida_m2`, `area_computavel_m2`, `area_nao_computavel_m2`, `area_garagem_m2`, `area_privativa_m2`, `area_acima_ca_basico_m2`, `area_permeavel_m2`) e eficiência.
       6. **Premissas usadas**: todas as premissas do estudo, marcando com selo `"padrão"` cada item presente em `premissas.padrao`.
       7. **Alertas da opção e incertezas do estudo** em caixas de destaque.
       8. **Rodapé fixo**: *"Estudo preliminar automático. Não substitui o arquiteto responsável nem garante aprovação na prefeitura."*

2. **`viabilidade/relatorio/test_relatorio.py`**
   - Gera via CLI o relatório HTML do estudo de exemplo (`viabilidade/motor/exemplos/estudo-exemplo.json`) e dos 7 estudos pilotos (`viabilidade/motor/exemplos/pilotos/*.json`):
     - `SC-completo-22421.json`
     - `SC-completo-22426.json`
     - `SC-completo-25297.json`
     - `SC-completo-30516.json`
     - `SC-completo-37607.json`
     - `SC-completo-q1382-11984-11988.json`
     - `SC-completo-remembramento-75352-75354.json`
   - Faz o parse do HTML e confere todos os números visíveis no texto e nos atributos contra o JSON original (sem arredondar casas significativas), além de verificar a presença de todos os campos obrigatórios, marcações `"padrão"` de `premissas.padrao`, separação `zona.conferido` × `lote.zona_conferida`, alertas, incertezas, ausência de links externos e plantas SVG.
   - Inclui teste negativo comprovando que qualquer divergência numérica no HTML faz o teste falhar imediatamente.

## Resultado dos testes

- Comando executado: `python -I -X utf8 viabilidade/relatorio/test_relatorio.py`
- Status: **OK (4 testes, 8 estudos validados com 100% dos números batendo com o JSON)**.
