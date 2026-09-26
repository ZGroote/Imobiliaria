# Verificação da base 1.0.0-dev.1

> **Registro histórico.** Verificação da base 1.0.0-dev.1, feita na data dela e não refeita. Estado atual: [DOCUMENTACAO.md](../../DOCUMENTACAO.md).

## Entrega

Gerada em `releases/1.0.0-dev.1/`, sem modificar o destino configurado no Firebase.
Contém índice de três imóveis, três páginas de tour, mapa completo de retorno,
239 tiles de quintal e instruções. O manifesto registra 245 arquivos com tamanho
e SHA-256, além dos hashes das entradas; todos os hashes de saída foram conferidos.
O manifesto não inclui seu próprio hash.

Os cadastros originais dos três imóveis continuam com preço nulo e localização
não confirmada. A apresentação agora diz **Sob consulta** e
**Localização aproximada, ainda não confirmada**, inclusive no texto OG.

## Executado

- `npm test`: 111 testes aprovados, zero falhas.
- `python -m unittest discover -s tests -p 'test_*.py'`: 36 aprovados.
  Há um ResourceWarning anterior de arquivo não fechado em `pipeline/build/html.py`.
- `python pipeline/preparar_piloto.py`: montagem concluída.
- Segunda execução no mesmo destino: recusada com código 1, como previsto, sem sobrescrever.
- `git diff --check`: sem erros de whitespace.
- `node tests/browser_piloto.mjs http://127.0.0.1:8871/ tasks/v1.0/evidencias`:
  três fichas abriram por link em Chrome headless isolado, em qualidade baixa.
- Título conferido com o cadastro, preço Sob consulta, aviso visível, zero exceções,
  zero avisos de console e zero respostas HTTP de erro relevantes nos três tours.
- Tiles presentes no cache ao final da espera: Castanheiras 42, Colinas 45, Cedros 47;
  `tileErrors=0` nos três. Isso confirma carregamento, não a qualidade visual de cada lote.
- Índice em viewport de 390 × 844: sem rolagem horizontal; captura inspecionada.

Evidências geradas em `tasks/v1.0/evidencias/`: `browser.json`, capturas dos três
imóveis e do índice desktop/mobile. São saídas locais ignoradas pelo Git.

## Limites deste aceite

Este teste mede abertura da ficha, textos e caminhos de assets. Não valida entrada
no interior, quatro modos, precisão de localização, fidelidade das plantas,
qualidade de toda a cena, desempenho em celular nem preview real do WhatsApp.
A captura de Colinas mostra a ficha sobre a área do empreendimento ainda sem uma
torre visível naquele quadro; investigar representação/prontidão na etapa dos modos,
sem interpretar a ausência como localização ou geometria confirmada.

O índice foi conferido em viewport emulada; nenhum aparelho físico foi testado.
O Chrome usou SwiftShader, portanto seu desempenho não representa o celular do cliente.
QA completo, segurança Firebase, quatro modos finais, offline e OG com imagem seguem
pendentes. Não houve deploy, envio a terceiros ou criação de tag de release estável.

## Regras aplicadas

A skill de planejamento orientou tarefas pequenas, dependências e critérios de aceite;
a de versionamento orientou a identificação `dev`, manifesto e preservação da saída
existente. A integração de navegador não respondeu; a verificação usou Chrome isolado
via protocolo DevTools, com inspeção somente de leitura e navegação pelas URLs locais.
