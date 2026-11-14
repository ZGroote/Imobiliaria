# Comparação da sonda de ambiente

A primeira captura (`environment-before.json` / `environment-after.json`) teve hashes internos diferentes, apesar de materiais, ganhos e contagens de texturas idênticos em duas entradas/saídas. Esse resultado não foi aceito como equivalência visual.

As texturas de superfície em `materials/interior-textures.js` usam `Math.random()` para ruído. O teste `--environment` passou a semear o gerador pelo CDP antes dos scripts da página, apenas no perfil isolado de teste. A aplicação mantém seu comportamento original. Resultados com semente são gravados em arquivos separados para preservar a evidência da investigação.
