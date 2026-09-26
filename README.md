# Imobiliária — base 1.5

Mapa imobiliário 3D, ficha do imóvel, maquete, planta e visita em primeira pessoa, mais o
painel administrativo e a publicação de cada imóvel no Firebase Hosting.
Esta é a base **em desenvolvimento**, não uma release estável aprovada.

**Onde está a verdade atual de cada parte:** [DOCUMENTACAO.md](DOCUMENTACAO.md).

As fontes atuais estão em `v1.5/`. O pipeline, os testes e os dados compartilhados
continuam na raiz. `v16-moveis` é a chave técnica da variante modular, não a versão
do produto. `renderizador/` contém o v15 legado, ainda usado como referência.

- **Painel** (`painel/`): Next.js estático no Firebase Hosting, com Firestore e regras em
  `firebase/`. Arquitetura e estado de produção: [tasks/painel/proposta.md](tasks/painel/proposta.md).
- **Publicação de imóveis**: `pipeline/build_imovel.py` gera o build; `pipeline/publicar_imovel.py`
  monta o preview e o live do site de imóveis (proposta §6–§9).

## Instalar e verificar

Use Python 3.11 ou superior e Node.js compatível com o `package-lock.json`.

```powershell
python -m pip install -r requirements.txt
npm ci
npm run test:py
npm test
npm run montar
```

Os testes do painel e das regras rodam no emulador do Firebase e precisam de JDK 21:

```powershell
npm run test:painel
npm run test:regras
```

Em 26/09/2026, todos verdes: 122 Node, 70 Python, painel 30, regras 28, TypeScript e build do
painel. O CI (`.github/workflows/ci.yml`) roda esses gates em todo PR para `main`.
Os testes de equivalência leem commits antigos com `git show`: use um clone com
histórico completo, não apenas um ZIP ou clone raso (o CI usa `fetch-depth: 0`).

## Montar o piloto completo

```powershell
python pipeline/preparar_piloto.py --versao 1.5 --destino releases/1.5
python -m http.server 8765 --bind 127.0.0.1 --directory releases/1.5
```

Abra http://127.0.0.1:8765/. O destino da montagem precisa ser novo.
Os mapas e tours precisam de HTTP para carregar os tiles de quintal.
As páginas em `maquete/` são independentes e também abrem por duplo clique.

O repositório inclui os dados consumidos pelo build de São Carlos, bibliotecas,
texturas, cadastros e tiles necessários ao piloto. Os tiles ficam atualmente em
`v16-moveis/publicado/mapa/quintais/`, caminho lido pelo preparador.
Backups, caches, ZIPs, capturas de experimentos e bases brutas de outras cidades
não fazem parte deste conjunto reprodutível.

Para gerar somente o exemplo de maquete:

```powershell
python v1.5/miniaturas/pagina_maquete.py
```

Esse exemplo usa dados demonstrativos; para um imóvel cadastrado, use `--unidade`.
Veja também [dependências](DEPENDENCIAS.md), [fontes 1.5](v1.5/LEIA-ME.md)
e [plano do piloto](tasks/v1.0/README.md).
