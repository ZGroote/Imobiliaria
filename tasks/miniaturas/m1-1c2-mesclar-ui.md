# M1.1-C2 — UI de cômodo composto: mesclar e separar no capturador

Continuação direta do M1.1-C1 (PR #84: contrato 1.1.0, validador, normalizador e prova 3D).
Implementa a interface (parte 2) no capturador mobile (M1.1-B) para que o operador possa
mesclar cômodos encostados parede com parede em um cômodo composto (ex.: sala em L, T ou U)
e separá-los quando desejado.

Base: eat/m1-1b-capturador-mobile integrada com eat/m1-1c-comodo-composto.

## Decisões de Interface (UX Mobile)

1. **Ação no formulário e na seleção**:
   - Quando um cômodo está selecionado e encostado em outro(s) cômodo(s):
     - Na barra inferior de seleção (aixa), se houver cômodo adjacente compatível, surge o botão **Mesclar**.
     - No formulário do cômodo (FormComodo), lista os cômodos adjacentes com botão **Mesclar com [Nome]**.
   - Quando um cômodo já faz parte de um grupo mesclado:
     - O formulário indica "Cômodo composto (mesclado com ...)" e exibe o botão **Separar deste cômodo**.
     - A barra inferior exibe o nome unificado e o status composto.

2. **Regras da ação Mesclar**:
   - Os dois cômodos precisam ser adjacentes (contato positivo entre paredes).
   - Se houver portas ou janelas na parede divisória comum, a mesclagem exige removê-las antes (pois no modelo 1.1.0 o trecho mesclado não tem parede física).
   - Ao mesclar, o nome do segundo cômodo é sincronizado com o do primeiro.
   - A relação entre as paredes de contato passa de djacent para merged.
   - O schemaVersion do documento exportado passa automaticamente para 1.1.0.

3. **Regras da ação Separar**:
   - O cômodo é retirado do grupo mesclado; as relações voltam para djacent.
   - Se o documento não possuir mais nenhum cômodo mesclado, o schemaVersion volta para 1.0.0.

4. **Visualização na planta (SVG)**:
   - Os retângulos mantêm suas cotas e medidas declaradas individuais.
   - O trecho de parede mesclado (divisória interna) é desenhado com traço pontilhado/vazado sutil, indicando ausência de parede física.
   - Cômodos mesclados compartilham o mesmo realce visual.

5. **Persistência e Round-trip (carregar)**:
   - O editor passa a aceitar tanto leituras 1.0.0 quanto 1.1.0.
   - Leituras 1.1.0 reconstroem os grupos mesclados a partir das relações kind: "merged".
   - A garantia de round-trip perfeito (JSON.parse(exportar(s)) === doc) é preservada tanto para 1.0.0 quanto para 1.1.0.