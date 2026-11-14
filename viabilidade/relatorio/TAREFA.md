# Tarefa da frente Relatório (experimento isolado, Gemini)

Você trabalha numa CÓPIA separada do projeto: `C:/Users/respawn/Desktop/imobiliaria-viabilidade-gemini` (galho `exp/viabilidade-gemini`). A central (Claude Code) traz pro projeto principal só o que prestar.

Leia: `viabilidade/README.md` (contrato do Estudo) e a seção 7 de `viabilidade/produto/ESTUDO-REAL.md` ("O NOSSO relatório: uma página por opção"). Nada mais.

## O que fazer
`viabilidade/relatorio/relatorio.py`: `python -I -X utf8 viabilidade/relatorio/relatorio.py --estudo X.json --saida Y.html`
- Um HTML que imprime bem (A4, uma página por opção + uma capa com a comparação lado a lado), só biblioteca padrão do Python, sem internet.
- Números do `estudo.json`, sem inventar nada. Premissa que veio do padrão (`premissas.padrao`) aparece marcada "padrão".
- Separar bem "números da zona conferidos" de "o terreno está nessa zona" (`zona.conferido` x `lote.zona_conferida`), e mostrar `alertas` e `incertezas` em destaque.
- Planta simples de cada opção em SVG (projeção dos volumes sobre o lote), desenhada a partir das coordenadas.
- `viabilidade/relatorio/test_relatorio.py`: gera o relatório dos 7 estudos de `viabilidade/motor/exemplos/pilotos/` e do exemplo, e falha se algum número do HTML não bater com o JSON.

## Regras
- Escreva SÓ em `viabilidade/relatorio/`. Não mexa em motor, lei, terreno, visual. Não commite. Nada vai pro ar.
- Português do Brasil simples.
- Ao terminar, UMA linha: `maestri ask "Claude Code" "Relatório concluído. Testes ok/falhou. Detalhes: viabilidade/relatorio/RELATORIO.md"`
