# Imobiliária — base 1.5

Mapa imobiliário 3D, ficha do imóvel, maquete, planta e visita em primeira pessoa.
Esta é a base **em desenvolvimento**, não uma release estável aprovada.

As fontes atuais estão em `v1.5/`. O pipeline, os testes e os dados compartilhados
continuam na raiz. `v16-moveis` é a chave técnica da variante modular, não a versão
do produto. `renderizador/` contém o v15 legado, ainda usado como referência.

## Instalar e verificar

Use Python 3.11 ou superior e Node.js compatível com o `package-lock.json`.

```powershell
python -m pip install -r requirements.txt
npm ci
npm run test:py
npm test
npm run montar
```

Em 21/09/2026: 43 testes Python passaram; 103 testes Node passaram e 10 falharam.
As falhas e as prioridades estão em [REVISAO-1.5.md](REVISAO-1.5.md).
Os testes de equivalência leem commits antigos com `git show`: use um clone com
histórico completo, não apenas um ZIP ou clone raso.

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
