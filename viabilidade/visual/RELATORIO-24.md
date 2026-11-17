# Relatório 24 — ficha da vitrine

- A ficha mostra as duas frases de `numeros.limitante` ou `numeros_terreo.limitante` conforme a opção de térreo selecionada. Sem resumo/limitante, o bloco fica oculto.
- Para `vagas.valor` nulo, mostra a `nota` do próprio resumo; valores numéricos continuam com unidade. Nenhuma conta foi acrescentada.
- Print: `evidencias/tarefa24-ficha.png` (terreno 1, sem térreo, ladrilhos bloqueados).
- `VISUAL_T24_ONLY=1 node viabilidade/visual/testar.cjs`: passou em desktop e celular, verificando as frases, a nota de garagem, vagas numéricas com térreo, ausência de `null`/`NaN`, frase de altura máxima no terreno 6, bloco oculto sem resumo, console e largura móvel.
- A suíte completa também foi executada, mas para antes do teste da vitrine na verificação antiga de `index.html`: o resumo real agora tem `vagas.valor: null` e a validação existente do índice exige número finito. Não alterei `index.html`, fora do escopo desta tarefa.

Não publiquei nem commitei.
