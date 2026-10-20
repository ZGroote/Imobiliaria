# Padrão das miniaturas

Leia `PADRAO-ATUAL.md` antes de alterar Cedros ou a publicação das miniaturas.

- A versão canônica do Cedros está em `padrao-atual/`; a montagem é `padrao_atual.py`. Não retornar silenciosamente ao template antigo nem reutilizar atlas em malhas diferentes.
- `pagina_maquete.py --unidade monte-dos-cedros-37` deve continuar gerando o padrão aprovado. `--geometria-base` é uma escolha explícita para investigação/modelagem.
- Publicar somente com `firebase.miniaturas-1.json`, no site `imobilaria-deccb-miniaturas`, quando houver autorização do usuário. O `firebase.json` raiz publica outro produto.
- `firebase.miniaturas-1.json` não ignora `node_modules/`: maquetes como `liv-classico/` carregam o Three.js de `node_modules/three/` e ficam presas em "Abrindo a maquete…" se ele for omitido. O `firebase.miniaturas.json` original fica preservado só como versão anterior.
- Rodar o preparador e `qa_padrao_atual.py`; após publicar, rodar o mesmo QA contra a URL pública. Manter hashes de release e documentação atualizados.
- Não gerar vídeo para esse fluxo. Preservar a câmera livre, modos, destaque de andar e fallback ao mover móveis.
- Colinas e Castanheiras ainda não foram convertidos para este padrão visual; não afirmar que foram.
