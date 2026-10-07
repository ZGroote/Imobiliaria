# Versão melhorada (07/10/2026) — miniatura v4

Maquete, planta e visita 3D do **Monte dos Cedros** com o mesmo desenho e a mesma luz
calculada do padrão aprovado em 23/09, mas muito mais leve para baixar, abrir e rodar no
celular. **Nada fora desta pasta foi alterado**: o padrão aprovado continua em
`../padrao-atual/` e é a base de comparação (versão 3; esta é a 4).

- Resultado, medições, custos e a análise técnica por técnica: [RELATORIO.md](RELATORIO.md).
- Quanto custa o segundo acesso (mesma maquete, outra maquete, depois de publicar): [ESTUDO-ACESSOS.md](ESTUDO-ACESSOS.md).
- O que muda para quem visita (medido; ver o relatório): abre com 36% dos bytes (17% no
  celular fraco), a maquete aparece em 0,1–1,2 s (imagem de capa), a luz calculada chega
  1,4× a 6× mais cedo, a memória de vídeo cai 56–81%, e parada a página não desenha nada.
- O que **não** muda: câmera livre, os quatro modos, conjunto/bloco, destaque do andar,
  editor de móveis com o retorno à iluminação dinâmica, interruptores, deep links
  (`?modo=visita`, `?modo=planta3d`, `?conjunto=1`).
- O que **saiu** a pedido: "Ver mapa" e a versão offline/duplo clique.

## Estrutura

| Pasta | O que tem |
|---|---|
| `fonte/` | Código da página v4. `miniatura.js` (o visualizador, derivado do aprovado), `qualidade.js` (perfis e resolução dinâmica), `luz.js` (KTX2), `binario.js`, `pagina.html`, e `interior/` (os módulos do renderizador, **sem alteração**). |
| `gerador/` | `derivar.py` (dados → binário + KTX2), `montar.mjs` (site), `capa.mjs` (imagem de abertura). |
| `imoveis/` | Configuração de cada imóvel PREMIUM (hoje: Cedros). |
| `derivados/<imovel>/` | Saída do `derivar.py`. Versionada, menos os dois atlas de resolução cheia (passam de 1 MiB, a trava de tamanho do repositório): o `derivar.py` os refaz com os mesmos bytes e confere contra `conferencia.json`. |
| `medicoes/` | Medidor, comparação visual, teste de fumaça, custos e os resultados (`resultados/`). |
| `testes/` | Testes rápidos (`npm test`). |
| `publicado/` | Site montado (não versionado; `node gerador/montar.mjs` refaz em segundos). |

## Comandos

Dentro desta pasta, com Node 20+ e Python 3.11+ (NumPy e Pillow, como no resto do repositório):

```powershell
npm ci                                   # three r168, esbuild, playwright-core, ktx2-encoder
python gerador/derivar.py                # 1ª vez após clonar (~1 min) e quando mudar luz/UV/template
node gerador/montar.mjs                  # monta publicado/ (segundos)
node gerador/capa.mjs; node gerador/montar.mjs   # imagem de capa (precisa de Chrome; não versionada)
npm test                                 # testes rápidos
node medicoes/fumaca.mjs                 # abre a página, percorre os modos, editor e interruptores
node medicoes/comparar.mjs --q alto      # compara com o aprovado, pixel a pixel
node medicoes/medir.mjs --versao nova    # bytes, tempos, memória (e --versao base)
node medicoes/custos.mjs                 # custo de Hosting por 1.000 acessos/dia
node medicoes/acessos.mjs; python medicoes/estudo_acessos.py   # acessos repetidos → ESTUDO-ACESSOS.md
```

Atalho para tudo isso: `npm run gerar` (derivar → montar → capa → montar).

Para ver no navegador: `node medicoes/servidor.mjs publicado 8780` e abrir
`http://127.0.0.1:8780/`. Parâmetros úteis: `?q=alto|medio|baixo` (força o perfil),
`?perf=1` (mostra FPS, perfil, resolução e a GPU — use no celular de verdade),
`?drs=0` (desliga a resolução dinâmica).

## Publicar (somente com autorização)

A configuração `firebase.json` desta pasta aponta para `publicado/` com cache imutável para
`app/`, `lib/` e `assets/`. Para testar sem tocar o site no ar, use um **canal de
pré-visualização** do site das miniaturas:

```powershell
node gerador/montar.mjs
npx firebase hosting:channel:deploy v4 --config firebase.json --project imobilaria-deccb
```

Isso gera uma URL própria (`...--v4-xxxx.web.app`) e não altera `imobilaria-deccb-miniaturas.web.app`.

## Novo imóvel PREMIUM

1. Produzir o template e a luz como no padrão atual (`../PADRAO-ATUAL.md`: unwrap, bake,
   denoise, encode → `lightmap.rgbm.gz` e `geometry-compact.json`).
2. Criar `imoveis/<id>.json` apontando para eles (modelo: `monte-dos-cedros-37.json`).
3. `python gerador/derivar.py imoveis/<id>.json`, `node gerador/montar.mjs --imovel <id>`,
   `node gerador/capa.mjs --imovel <id>` e montar de novo.

O reempacotamento do atlas externo, a codificação KTX2, a capa e o empacotamento são
automáticos. Não reutilizar atlas entre malhas diferentes (regra do `../AGENTS.md`).

## Versões

- **v3 (base, intocada):** `../padrao-atual/` — `anterior/v2.html` + `lightmap-v3.js`,
  `exterior-v3.js`, `interruptores.js`; montada por `../padrao_atual.py`.
- **v4 (esta pasta):** a próxima mudança vira v5 numa pasta nova, mantendo esta como está.
