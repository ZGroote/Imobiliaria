# POC Instagram / WebView — Cedros LEVE

Experimento isolado para abrir a experiência 3D do imóvel em uma página de tela cheia adequada ao navegador interno de redes sociais. O alvo inicial é o **Monte dos Cedros**, sempre com `--modo leve` explícito.

## O que este POC prova

- Reutiliza o `pagina_maquete.py` e a Planta 3D/Visita 3D existentes; não cria segundo renderer.
- Gera uma cópia do artefato LEVE e injeta apenas uma camada de apresentação do experimento.
- Abre direto em **Planta 3D**, preservando os gestos que o viewer já oferece (`pointer`, pinça e joystick na visita).
- Ocupa a viewport do WebView, respeita safe areas e inclui CTA para entrar/voltar da Visita 3D.
- Trata `orientationchange`, `visibilitychange` e perda do contexto WebGL, com recarga/fallback visível.
- Não altera `pagina_maquete.py`, perfis, PREMIUM, Firebase, Firestore ou arquivos publicados.

Isto **não prova** que JavaScript roda dentro de uma foto, Reel ou Story. O POC é uma página web para ser aberta por link. A validação no navegador interno do Instagram exige uma URL de teste e um aparelho real; emulação/desktop não substitui esse passo.

## Gerar

Na raiz do repositório:

```bash
python experiments/instagram-3d-poc/build_poc.py
```

O comando chama, sem publicar:

```text
pagina_maquete.py --unidade monte-dos-cedros-37 --modo leve --saida <temporário>
```

Depois injeta a camada do POC e grava:

```text
experiments/instagram-3d-poc/dist/index.html
```

Também é possível aplicar a camada a um HTML já gerado:

```bash
python experiments/instagram-3d-poc/build_poc.py --source /caminho/cedros.html --output /tmp/instagram-cedros.html
```

O build imprime tamanho e SHA-256 do resultado para permitir comparação de evidências.

## Testes

```bash
python -m unittest tests.test_instagram_3d_poc -v
```

Os testes verificam que a transformação exige os hooks reais de Planta 3D/Visita 3D, recusa dupla injeção, força `--modo leve`, não contém deploy e não modifica o HTML fonte.

## Smoke manual antes de qualquer URL pública

1. Servir a raiz do repositório localmente, por exemplo com `python -m http.server 8080`.
2. Abrir `http://localhost:8080/experiments/instagram-3d-poc/dist/` em viewport móvel.
3. Confirmar que inicia em Planta 3D, arrastar gira, pinça aproxima/afasta e a página não rola durante o gesto.
4. Tocar **Entrar no imóvel**, testar olhar/movimento e usar **Voltar à planta**.
5. Girar o aparelho/viewport e confirmar reenquadramento.
6. Recarregar pelo botão `↺` e confirmar retorno à pose inicial.
7. Registrar console, tamanho do arquivo, tempo até interação e FPS observado.

## Próximo gate: Instagram real

Para demonstrar o fluxo desejado é necessária uma URL HTTPS temporária/isolada. O teste deve registrar: sistema operacional, versão do Instagram, ponto de entrada (Story/Reel/bio/DM), se abriu WebView interno ou navegador externo, gestos, orientação e comportamento do CTA. **Não fazer deploy nem publicar a URL sem autorização separada.**

## Escopo e reversão

Todo o POC fica em `experiments/instagram-3d-poc/` mais seu teste unitário. Remover esses arquivos elimina o experimento; nenhuma configuração de Hosting ou produto publicado é alterada.
