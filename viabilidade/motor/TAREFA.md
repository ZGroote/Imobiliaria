# Tarefa da frente Motor

Você faz parte de um time de 5 IAs coordenado pela central "Claude Code". Projeto: protótipo de estudo de viabilidade de terreno (lote + lei -> opções de prédio em 3D com números). Contexto: um cliente tem um arquiteto que leva 1-2 semanas por estudo e precisa de 5-6 até achar um bom; queremos gerar várias opções em horas.

ANTES DE TUDO leia viabilidade/README.md (regras, frentes e o CONTRATO de dados). O PRD completo está em viabilidade/PRD.md, se precisar.

Regras duras:
- Pasta de trabalho: C:/Users/respawn/Desktop/imobiliaria-viabilidade (galho feat/viabilidade). Escreva SÓ dentro da sua pasta: viabilidade/motor/. O resto do projeto é só leitura. Não commite (a central commita). Não publique nada, não toque em Firebase/painel/deploy.
- Use subagentes para paralelizar a sua frente (pesquisa, leitura, testes), você coordena eles.
- Responda e escreva em português do Brasil simples.
- Se o contrato do README não servir pra você, NÃO mude o README: proponha a mudança no seu relatório final.
- Não invente número. Sem fonte = marque como não conferido.
- Quando terminar, mande o relatório final com: maestri ask "Claude Code" "<relatório: o que entregou, arquivos, o que ficou faltando, dúvidas>". Mantenha curto (até ~25 linhas).

SUA FRENTE: Motor
Escrever o motor em Python (só biblioteca padrão + o que já estiver em requirements.txt; se precisar de shapely, veja se já está instalado e diga) em viabilidade/motor/: recebe um Lote e uma Zona (formatos do contrato) + premissas e gera estudo.json. Passos: (1) caixa máxima: recua o polígono do lote (frontal na aresta da frente, lateral/fundos nas outras), aplica taxa de ocupação, CA máximo e altura; (2) gera pelo menos 3 opções diferentes quando couberem: torre única, duas torres, lâmina/prédio baixo e largo (e embasamento+torre se fizer sentido), cada uma respeitando os limites e com métricas (área construída, computável estimada, CA usado, TO usada, pavimentos, unidades estimadas); (3) alertas quando algo passa do limite ou fica no limite; (4) tudo determinístico (mesma entrada = mesmo arquivo). Enquanto Lei e Terreno não entregam, use um lote real pequeno tirado de lotes_saocarlos.geojson (campo fx/fy é UTM; converta o polígono WGS84 pra UTM 23S) e uma zona de exemplo com números claramente marcados como FICTÍCIOS. Deixe um comando simples: python -I viabilidade/motor/gerar.py --lote X --zona Y --saida estudo.json, e um exemplo pronto em viabilidade/motor/exemplos/estudo-exemplo.json (a frente Visual vai usar). Um teste curto que falha se a caixa sair do lote ou se o CA passar do máximo. Entregue o exemplo cedo: assim que o estudo-exemplo.json existir, avise com maestri ask "Claude Code" "Motor: estudo-exemplo pronto" e continue.
