# Desempenho — LIV, Laranjeiras e gerador

Autorizado em 31/10/2026 no chat `01a193a3-c81d-79f2-8f50-40b6061cd0c2`: implementar e publicar nos dois prédios depois da entrega do Claude e levar as correções ao gerador. A entrega foi confirmada no commit `6aa12bd` (plantas espelhadas, iluminação e sombras), com QA e commit concluídos, ainda sem publicação.

Trabalho isolado na branch `codex/desempenho-maquetes-20261031`, worktree `_to_delete/worktree-desempenho`. A branch compartilhada `feat/predio-novo` e suas alterações pendentes permanecem preservadas. Dependências são acessadas por junções; não alterar arquivos dentro delas.

Auditoria, evidências e plano detalhado em `C:/Users/respawn/.codex/visualizations/2026/10/31/01a193a3-c81d-79f2-8f50-40b6061cd0c2/` (`auditoria-liv.md`, `auditoria-liv-complemento.md`, `plano-implantacao.md`). Métricas desktop não equivalem a homologação física.

## Tarefas e aceitação

- [x] Confirmar entrega do Claude e isolar checkout sem absorver alterações de outras sessões.
- [x] Memória/edição: liberar referências fortes a recursos descartados e eliminar recálculo de navegação que não depende dos móveis. Regressões Node e repetição de 30 ajustes com coleta de lixo; não acumular buffers antigos nem bloquear cada ajuste com busca de rotas.
- [ ] Rotas/geometria: reutilizar resultados válidos e evitar cópias desnecessárias, preservando posição, portas e propriedade dos recursos compartilhados.
- [ ] Iluminação: inicializar hora/lado corretos; validar plafons apagados fora dos shaders com transições dia/noite, quatro plantas e sombras vizinhas do Laranjeiras preservadas.
- [ ] Assets/cache: conferir escopo real do worker, atualizar identidade/prioridade/manifesto e remover só preparação não utilizada; medir texturas e política de cache/qualidade antes de manter tratamentos.
- [ ] Gerador: localizar fontes/template correspondentes, incorporar correções aplicáveis e provar uma nova saída pelo fluxo normal, sem remendar apenas bundles existentes.
- [ ] Pacotes: construir e testar LIV/Laranjeiras, comparar visual e fluxos nos backends suportados; commits exclusivos desta tarefa assinados pelo Codex.
- [ ] Publicar usando procedimento do Hosting compartilhado; verificar URLs, hashes, plantas espelhadas, navegação, edição, iluminação, cache e preservação dos demais sites. Registrar release anterior e recuperação.

O controle de horário não recalculou rotas no ensaio integrado; não corrigir essa hipótese descartada. O desenho deve permanecer equivalente; mudanças de resolução/compressão/preparo só ficam com ganho medido e validação visual. Não reutilizar atlas em geometria diferente.

## Evidências dos incrementos

`aabb8c4`: 28 regressões Node passaram. Chrome isolado, 30 ajustes do sofá: no LIV, mediana de 1.066,65 ms para 1,9 ms; no Laranjeiras corrigido, 1,55 ms. Depois da restauração e coleta de lixo, o backing storage voltou ao nível inicial (diferença de 19 bytes nos dois casos); antes, o LIV retinha mais 56.905.579 bytes. Sem erros de página. Relatórios `auditoria-interacoes-liv-corrigido.json` e `auditoria-interacoes-laranjeiras-corrigido.json` na pasta da auditoria.

Cache da última consulta de rotas: limitado a uma posição, limpo junto da grade em `invalidate`, devolvendo cópias para o chamador não alterar o cache. Seis regressões focadas e o oráculo de navegação real passaram (2 plantas, 48 rotas sequenciais, 8.608 verificações). No ensaio CPU sequencial, consultas repetidas de Canto/Meio passaram de aproximadamente 0,7–0,9 s para 0,02–0,03 ms; a primeira busca ainda faz o cálculo completo. Sem promessa de ganho na primeira busca ou FPS. Relatórios `benchmark-rotas.json` e `nav-regressao-corrigido.json`.
