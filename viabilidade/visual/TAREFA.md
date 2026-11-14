# Tarefa da frente Visual

Você faz parte de um time de 5 IAs coordenado pela central "Claude Code". Projeto: protótipo de estudo de viabilidade de terreno (lote + lei -> opções de prédio em 3D com números). Contexto: um cliente tem um arquiteto que leva 1-2 semanas por estudo e precisa de 5-6 até achar um bom; queremos gerar várias opções em horas.

ANTES DE TUDO leia viabilidade/README.md (regras, frentes e o CONTRATO de dados). O PRD completo está em viabilidade/PRD.md, se precisar.

Regras duras:
- Pasta de trabalho: C:/Users/respawn/Desktop/imobiliaria-viabilidade (galho feat/viabilidade). Escreva SÓ dentro da sua pasta: viabilidade/visual/. O resto do projeto é só leitura. Não commite (a central commita). Não publique nada, não toque em Firebase/painel/deploy.
- Use subagentes para paralelizar a sua frente (pesquisa, leitura, testes), você coordena eles.
- Responda e escreva em português do Brasil simples.
- Se o contrato do README não servir pra você, NÃO mude o README: proponha a mudança no seu relatório final.
- Não invente número. Sem fonte = marque como não conferido.
- Quando terminar, mande o relatório final com: maestri ask "Claude Code" "<relatório: o que entregou, arquivos, o que ficou faltando, dúvidas>". Mantenha curto (até ~25 linhas).

SUA FRENTE: Visual
Fazer viabilidade/visual/index.html: página única (three.js por CDN com versão fixa, como o projeto já usa — veja as maquetes em experimentos/laranjeiras-2026-10-30/site/ só pra referência de estilo, SEM alterar nada lá) que abre um estudo.json (formato Estudo do contrato; por ?estudo=caminho ou arrastando o arquivo) e mostra: o lote no chão, a caixa máxima em linha/transparente, e as opções como volumes. Botões pra trocar de opção (A, B, C...) e modo lado a lado; painel com as métricas e os alertas de cada opção; aviso fixo "estudo preliminar, não substitui projeto nem aprovação". Visual sóbrio, legível no celular. Enquanto o Motor não entrega o exemplo, crie viabilidade/visual/exemplo-provisorio.json seguindo o contrato com números inventados (marcado como provisório). Teste abrindo num servidor local (python -m http.server) e tire um print com Chrome headless; descreva o que viu. Coordenadas vêm em UTM: centralize no lote pra evitar tremedeira de precisão.
