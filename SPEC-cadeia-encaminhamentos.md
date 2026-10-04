# Spec — cadeia-encaminhamentos

Objetivo: manter corretor original em repasses e transformar a barra em sublink
compartilhável da abertura. Depende de links-corretor. Contrato público e
contato WhatsApp futuro: [CONTRATO](rastreabilidade/CONTRATO.md).

Estrutura: servidor/visitas e `rastreabilidade/public/runtime.mjs`/`acesso.html`.
Estilo: funções explícitas como `abrirVisita({token,attemptId,receipt})`.
Verificação: `node --test tests/test_rastreabilidade_servidor.mjs tests/test_rastreabilidade_cliente.mjs` e navegador local.

Aceite: raiz→A→B preserva o corretor; A copia barra e B recebe o filho; refresh,
back/bfcache e retorno próprio não inventam geração; GET/prévia não cria visita;
conteúdo inválido/desativado não é exibido; nenhum recibo vai na URL.
Troca tour/maquete/modo preserva o token; destino externo encerra observação.

Sempre tratar atribuição como token recebido, não prova de quem enviou.
Sem recibo suficiente indicar incerteza; copiar mensagem original fora da
página não é detectável. Nunca modificar builds imutáveis ou a rodada M1.1.
