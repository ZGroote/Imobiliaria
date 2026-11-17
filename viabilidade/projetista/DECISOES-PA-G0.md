# Decisões do PA-G0 (usuário, 16/11/2026)

Respostas às 6 perguntas da seção 8.2 do `PA-G0.md`. O usuário aceitou as recomendações da central. Segunda opinião (ChatGPT) concordou com todas e trouxe os reforços marcados com ➕.

1. **Ordem B.** Núcleo canônico + **validador independente** + gerador esquemático de pavimento antes do editor manual.
   ➕ Encaixar retângulos não garante apartamento funcional: cada unidade precisa de acesso ao corredor, trecho mínimo de fachada e dimensões mínimas.
   ➕ O validador vem antes do gerador e é independente dele (o editor futuro passa pelo mesmo validador).
2. **Área privativa pela NBR 12721.**
   ➕ Privativa, útil e computável são três métricas separadas, nunca uma derivada da outra sem regra explícita.
3. **Eixo da parede** no modelo; espessura **0,15 m** interna e **0,20 m** entre unidades e com área comum.
   ➕ As faces reais saem do eixo e da espessura para medir área; atenção a parede compartilhada e cantos.
4. **Varanda computável por padrão** até um advogado confirmar (estado `nao_verificado`, não `conforme`).
5. **Casa térrea e sobrado fora** da 1ª etapa (domínio separado depois).
6. **JSON local versionado** com `schema_version`, IDs estáveis, SHA-256 e gravação atômica, até o PA-G5. Sem Firestore.

**Resultados do gerador (➕):** `gerado` (geometria válida; arquitetura ainda não verificada), `inviavel` (restrição conhecida impede) e `nao_encontrado` (a busca não achou, sem provar impossibilidade). Mantém a distinção que o motor já faz (`impossivel` × `busca_inconclusiva`).

**Algoritmo do gerador (➕, a confirmar no portão do gerador):** faixas paralelas ao eixo dominante + núcleo central ou lateral + busca com poda (branch-and-bound), determinística. Sem grade raster como geometria final; Shapely valida o vetor.
