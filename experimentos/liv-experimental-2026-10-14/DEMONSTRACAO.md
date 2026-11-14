# Demonstração de disponibilidade

O cadastro local `liv-demo-disponibilidade` tem 170 apartamentos: **136 vendidos/ocupados (80%)** e **34 disponíveis (20%)**, distribuídos aleatoriamente. A configuração de produção permanece intacta. Preço, número comercial e vínculo de planta continuam vazios; cada ficha avisa que os dados são fictícios.

Abrir a maquete com `?geometria=entrada&unidades=edificio&demonstracao=1` e escolher **Disponíveis**. Todos os 34 disponíveis ficam verdes, independentemente do pavimento destacado. Vendidos não recebem brilho. A ficha abre por clique/toque na fachada; a lista lateral de finais, a ficha duplicada e o espelho público foram removidos.

[Painel local](http://127.0.0.1:3017/admin/properties/units?id=liv-demo-disponibilidade). Entrar pelo botão de demonstração do operador. A tabela contém os 170 registros; mudar a disponibilidade atualiza a maquete ao vivo. As edições continuam sendo feitas pelo painel, sem acesso público de escrita.

## Iniciar ou retomar

Executar a partir da raiz do repositório, com Java 21 e Node instalados:

```powershell
$env:JAVA_HOME='C:\Users\respawn\.jdks\jdk-21.0.12.1+1'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,storage --project demo-painel --export-on-exit experimentos/liv-ipanema-webgpu-2026-10-09/.demo-emulador "node experimentos/liv-ipanema-webgpu-2026-10-09/demo_disponibilidade.mjs"
```

O processo mantém o painel na porta 3017, Firestore em 8180 e autenticação em 9099. Na próxima abertura, se a pasta exportada existir, acrescentar `--import experimentos/liv-ipanema-webgpu-2026-10-09/.demo-emulador` ao comando do Firebase para preservar as edições. O script só cria o cadastro quando ele não existe, sem apagar outros cadastros.

`estoque-demo-config.json` é usado somente com `demonstracao=1`. O cliente rejeita o emulador fora de localhost; o script de preenchimento exige o projeto `demo-painel` e as portas locais previstas. Sem esse parâmetro, a configuração real segue funcionando como antes. O parâmetro acompanha a ida e o retorno pelo mapa.

## Verificação

`qa_demo_disponibilidade.py` passou em WebGPU, WebGL e toque emulado: 34 IDs destacados em todos os pavimentos, duas faces, clique real/toque, câmera preservada, uma única ficha e atualização de 34 para 33 após venda pelo painel, seguida de restauração para 34. Relatório em `evidencias/demo-disponibilidade/runtime.json`; distribuição em `distribuicao.json` da mesma pasta. O ensaio usa o SDK e o painel reais ligados ao emulador local, sem interceptar o estoque.

O teste não comprova disponibilidade comercial real nem desempenho em aparelho físico. As referências gerais Canto e Meio permanecem disponíveis; a associação por apartamento exige cadastro confirmado.
