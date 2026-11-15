# Tarefa 16 — acessibilidade
- Fora: bordas dos controles com contraste baixo; foco verde do canvas fraco no fundo claro; select sem foco explícito; maquete sem giro por teclado.
- Controles: borda #40505c → #6b7b80, de 1,71:1 → 3,23:1 com preenchimento; de 2,21:1 → 4,18:1 com página. Botões sobre maquete: #718186, de 2,94:1 → 3,19:1 contra preenchimento composto e 3,18:1 contra fundo claro (antes 3,46:1).
- Canvas: foco #91dcba → #0e151b, de 1,26:1 → 14,46:1 contra #e1e5e2, desenhado para dentro. Foco dos demais controles: 8,92:1 contra #212c34.
- Textos mantidos: principal/página 15,18:1; secundário/cartão 8,50:1; aviso amarelo 9,61:1; aviso de volumes 13,61:1; botão 11,76:1 (mesmos valores antes/depois).
- Setas giram e +/− ajustam zoom; Tab sai da maquete. Select recebe estilo/foco explícito; canvas descreve volumes e envelope, com instruções associadas.
- aria-pressed e listas dt/dd preservados; avisos amarelos com role=note sem região viva, evitando interrupções nas trocas.
- testar.cjs cobre ordem de Tab e foco, Enter/espaço, opções/comparação, aria-pressed, rótulo, giro e vistas; mede cores computadas e salva pares de contraste por perfil.
- node --check de testar.cjs e do módulo inline passou; nova tentativa no servidor 8787 bloqueada por spawn EPERM. Central deve confirmar no Chrome após o ajuste da borda sobre a maquete. Sem commit.
- Arquivos alterados: viabilidade/visual/index.html; viabilidade/visual/testar.cjs; viabilidade/visual/RELATORIO-16.md.
