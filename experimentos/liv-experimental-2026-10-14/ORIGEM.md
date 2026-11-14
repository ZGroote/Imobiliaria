# Liv experimental — origem

Cópia de `experimentos/liv-ipanema-webgpu-2026-10-09/` feita em 14/10/2026, a partir do commit
`6150044` do branch `codex/liv-ipanema-webgpu` **mais as alterações ainda sem commit** naquele dia.
Serve para os experimentos de qualidade visual (Caminho 1 e Gaussian Splatting, ver
`tasks/caminho1-liv/`) sem tocar no Liv original.

Ficaram de fora (continuam só no original): `entregas/`, `evidencias/`, `.liv-reproducao-*` e
`__pycache__/`.

Os scripts `.py`, `.mjs`, `.js`, `.ts` e `.html` foram reapontados para esta pasta. Manifestos `.json`
e documentos `.md` foram mantidos como estavam: registram a procedência no original.

Servir na raiz do repositório (configuração `liv` em `.claude/launch.json`):

```powershell
python -m http.server 8790 --bind 127.0.0.1 --directory .
```

Abrir `http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio`
ou `interior.html?tipologia=meio&modo=visita`.

## Tour em splat (15/10/2026)

No Tour do Meio, `interior-splat.js` cobre o canvas com `splat/visita.html` (Spark 2.2.0) e copia a câmera
do Tour a cada quadro. A navegação continua sendo a do Liv. O splat vem de `piloto-render/` e, por
enquanto, cobre só sala/cozinha (`?splat-zona=sala`); fora dela volta a malha. `?splat=0` desliga.

Preview: https://imobilaria-deccb-miniaturas--liv-splat-20261015-2hi1bgf3.web.app/maquete-liv-ipanema.html?geometria=entrada&unidades=edificio
(canal `liv-splat-20261015`, expira 22/10/2026). Montado com `montar_entrega.py --nome liv-splat-20261015`
mais a cópia manual de `splat/`, que o empacotador não descobre (é carregada num iframe criado em tempo de execução).
