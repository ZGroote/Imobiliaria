# T29: os recusados por "cor insegura" e "fora do quadro" (só medir) (16/11)

Galho `viabilidade/cor-quadro`, que sai do `sem-frente` (PR #127). **Esta tarefa não muda código nem regra.** Só mede e classifica, como na T26.

No sorteio de 500 (semente 20261120), depois da T28, saem 306 aceitos. Entre os recusados estão cerca de 24 por "cor insegura" e 22 por "fora do quadro". Confira os números exatos de hoje.

## O que fazer

1. **Cor insegura:** para cada lote, diga qual cor o mapa tem ali e por que não foi classificada com segurança. Use estas categorias e crie outra se precisar:
   - texto ou número impresso por cima da zona;
   - hachura ou padrão de área especial;
   - borda de duas zonas;
   - cor de zona desbotada ou com degradê da imagem;
   - cor fora da legenda;
   - outro motivo.

   Para cada um, diga qual seria a zona certa olhando o Anexo 02 com os olhos e se ela é inequívoca.
2. **Fora do quadro:** para cada lote, diga onde ele fica em relação ao quadro do Anexo 02:
   - fora da área urbana, e a recusa está certa;
   - na margem, na legenda ou no carimbo do mapa;
   - num recorte que existe em outro anexo ou prancha da lei;
   - erro de georreferência, quando o lote está dentro, mas o encaixe do mapa erra.

   Meça o erro de encaixe, se houver, em metros.
3. **Tabela de contagem** por categoria, com quantos teriam zona inequívoca.
4. **Conferência na imagem:** abra todos no Anexo 02, e na foto quando ajudar. Monte uma folha de prints pequena em `terreno/evidencias/t29/`.
5. **Proposta:** diga o que daria para resolver, quantos lotes cada proposta ganha e qual risco ela traz de pôr um lote na zona errada. Diga também o que **não** resolver.

Para saber o que existe na lei além do Anexo 02, use só os arquivos que já estão na pasta do terreno ou o que a Prefeitura publica abertamente. Não force URL nem contorne bloqueio.

Não mude código, `motor/`, `relatorio/` nem `lotes-piloto.json`. Script de medição, se precisar, vai para a pasta de rascunho, fora do repositório. Não commite. Relato em `terreno/RELATORIO-29.md`, curto e numerado, com a lista dos lotes e as categorias no fim. Ao terminar: `maestri ask "Claude Code" "Terreno tarefa 29 pronta"`.
