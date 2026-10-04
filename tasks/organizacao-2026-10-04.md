# Consolidação e organização — 04/10/2026

Resultado posterior à [avaliação inicial](../relatorios/avaliacao-atual-2026-10-04.md).
Trabalho local em `codex/organizacao-2026-10-04`, partindo de `f68f9a4` sobre a main
`d4a0307`. Esta consolidação não altera os sites publicados nem fecha a homologação M1.1.

## Organização

- Backup das alterações iniciais, manifesto e patch em `backups/organizacao-2026-10-04/`.
- 37 itens locais (pastas e arquivos): saídas v15/v17, ZIPs, páginas intermediárias e scripts manuais sem consumidor ativo
  arquivados em `_arquivo/organizacao-2026-10-04/`; `movimentacoes.json` registra origem/destino.
  Para recuperar um ensaio antigo, restaure os caminhos originais indicados no manifesto.
- Fontes ativas, cadastros e dados GIS consumidos por caminhos existentes foram preservados.
  O `.gitignore` agora separa intermediários, fontes brutas, capturas, bibliotecas editáveis
  e fontes externas locais do conjunto reprodutível.
- Arquivos úteis de captura/geração/testes passam a acompanhar suas dependências no Git.
  Testes novos usam fixtures versionados, sem depender do lote local `publicacao/`.
- Repositório GitHub restaurado para privado, conforme a política já registrada.
- [Documentação](../DOCUMENTACAO.md), [planos](README.md), [experimentos](../experimentos/README.md)
  e [relatórios](../relatorios/README.md) têm índices próprios; marcos integrados pelo #83
  e o M2 LEVE piloto deixam de aparecer como trabalhos futuros.

## Correções

| Problema anterior | Comportamento consolidado |
|---|---|
| Gerar sobre pasta ocupada apagava o conteúdo | Recusa antes de alterar arquivos; E2E monta em temporário e promove a pasta completa |
| Contexto recebido pela API era ignorado | Contexto é validado e transportado; geração real exige contexto declarado; demonstração é explicitamente local |
| Móveis e piso ativo se perdiam no salvamento | Companion versionado preserva dois pavimentos, geometrias e móveis; abrir/baixar projeto completo e snapshots têm roundtrip; leitura geométrica continua independente |
| Geração sem fronteira autenticada/CORS amplo | Origem exata, autenticação e autorização por imóvel/agência; exceção demonstrativa exige configuração explícita e loopback |
| Benchmark alterava HTML depois de emitir hash | O novo fluxo verifica a identidade do artefato final e exige destino novo; lote legado conserva relatórios originais e um sidecar local registra divergências |
| A/B apresentava estimativas como resultados | Tamanhos/hashes são medidos; FPS, VRAM, rede, abandono e custo aparecem como não medidos; banner ajustado à largura móvel |
| Scripts A/B duplicados e assets sem classificação | Geradores canônicos no experimento, wrappers de compatibilidade; imagens procedurais próprias classificadas, HTMLs com exceções de tamanho explícitas |
| Efeitos gráficos experimentais aplicados ao gerador geral | Patch completo recuperável em `experimentos/maquete-cosmetica-procedural-2026-10-04/`; variação visual permanece no A/B; fonte ativa mantém modo pela URL e altura declarada |
| Companion válido, mas impossível de reabrir no editor | API confere o roundtrip pelo mesmo modelo puro da UI antes de gravar; recusa 422 sem descarte |
| Pin incompleto aceito em BuildJob | Shape e snapshot referenciado conferidos; pin é copiado; worker/transação operacional continuam no M2 |
| Leitura de cadastros deixava arquivos abertos | Contextos de arquivo fecham as entradas após leitura |

Os dez HTMLs do lote legado diferem da identidade declarada nos relatórios antigos.
O sidecar `publicacao/m1-1a/lote-10-casas/identidade-artefatos-legados.json` é um inventário
dos bytes atuais, não um novo aceite. Para homologar, gere um lote novo com o fluxo corrigido.

## Validação

| Verificação | Resultado |
|---|---|
| Node | 209/209 no checkout só com fontes e dados do Git |
| Python | 316/316 no mesmo checkout; inventários de imagens/tamanho incluídos |
| Painel no emulador Auth/Firestore | 45/45, incluindo companion, imutabilidade, permissão e vínculo do pin |
| Regras Firestore/Storage | 40/40 |
| TypeScript | `tsc --noEmit` passou no checkout de verificação |
| Build estático e scan do bundle | Passou em cópia com `npm ci` próprio: 23 páginas estáticas, 13 padrões e nomes proibidos sem ocorrências |
| Smoke capturador | Chrome 390/1366: projeto com dois pisos/móveis abre e baixa sem alteração, prévia recebe andar ativo, sem overflow/erros JS |
| Smoke A/B e geração base | Quatro páginas em Chrome 360×800, sem overflow/erros JS/HTTP; manifesto confere com os 17 blobs versionados |

O checkout de verificação não contém os arquivos ignorados do diretório de trabalho.
Node/Python/emulador usaram pacotes já instalados na máquina; o build final instalou as
dependências próprias com `npm ci` na cópia. O reaproveitamento inicial por links foi
recusado pelo Turbopack, então o aceite do build foi feito em uma nova cópia sem esses
links. Java 21 foi acrescentado somente ao PATH
do processo. Comandos permanentes: [DEPENDENCIAS.md](../DEPENDENCIAS.md).

Capturas em `relatorios/organizacao-2026-10-04/` e evidências do capturador em pasta
temporária são locais. Emulação de rede/toque não comprova aparelho físico; no smoke
do capturador, a resposta da prévia foi interceptada, e seu contrato foi testado
separadamente com o gerador Python real e a API. Não foram feitos deploys de produto.

## Próximas entregas

1. Cinco sessões físicas M1.1, com métricas e contexto/fotos reais reconciliados.
2. Retirada final do CV (M1.2) e automação operacional M2.
3. Redução do custo de entrada e sequenciamento da luz, guiada pela medição existente.
4. Comparação urbana M3, implementação M4 e lote real M5.

Detalhamento e correspondência entre nomes antigos/novos: [tasks/README.md](README.md).
