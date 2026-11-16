# Adendo à TAREFA-1 (16/11), decisões do usuário

1. **Não duplicar o motor 3D:** o projetista gera um modelo arquitetônico traduzido para o renderizador atual.
2. **Geometria separada de legislação:** o usuário explora configurações mesmo com regra não verificada; o sistema distingue "geometria válida" de "proposta legalmente conforme". Isso entra no esquema canônico (item 4 da tarefa).
3. **Gerador automático sem IA generativa:** algoritmo de geometria/otimização reproduzível; IA só depois, como interface assistiva.

**Fluxo-alvo:** selecionar terreno → calcular viabilidade → pedir 6 apartamentos por pavimento → gerar distribuições → organizar torres → ver o empreendimento inteiro em 3D → modificar o projeto. Use-o como caso de uso principal e para decidir a ordem dos portões.

**PA-G0 direcionado à implementação, não documento genérico.** O inventário de código exato (arquivo:função, matriz existe/reusa/falta) está sendo feito pelo Codex em `viabilidade/projetista/MATRIZ-REUSO.md`. No seu `PA-G0.md`, mantenha o inventário curto e diga "detalhe na MATRIZ-REUSO.md"; não invente referência que não conferiu.
