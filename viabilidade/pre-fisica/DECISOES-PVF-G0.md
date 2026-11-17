# Decisões do PVF-G0 (16/11/2026)

O usuário aceitou as 7 recomendações da seção 5 do `PVF-G0.md` ("segue com as 7 recomendações do PVF"). Isso libera o **PVF-G1 só no galho isolado `viabilidade/projetista-g0`**: nada de merge, painel, Firestore, deploy ou publicação.

1. **Domínio inicial:** só prédio residencial multifamiliar com pavimento-tipo. Casa e sobrado ficam fora.
2. **Dados:** Copernicus GLO-30 só para triagem, com atribuição. A sondagem é enviada pelo cliente; sem ela, o domínio geotécnico fica `nao_verificado`. Nenhuma sondagem é inferida por mapa.
3. **Estrutura:** concreto armado convencional, em faixas preliminares, só no PVF-G2 e com parâmetros revisados por engenheiro calculista. Ainda não temos calculista: os parâmetros nascem `verified: false`.
4. **Vínculo:** cargas e solo se ligam a `revision_id` + `element_ids` do `projetista/0.1.0`. Se o `content_sha256` da geometria muda, o vínculo perde a validade sozinho.
5. **Trava:** sem sondagem ou sem método estrutural habilitado, a síntese nunca passa de `CONDICIONAL_COM_PENDENCIAS`.
6. **Quem aprova:** só um profissional habilitado marca estrutura ou solo como verificado; o registro leva nome, conselho e número. Toda exportação sai com aviso de "preliminar".
7. **Custo:** fica para o PVF-G5.

Ainda pendente com o usuário, o jurídico e o engenheiro: quem será o profissional (6), o calculista (3) e as condições de uso da sondagem do cliente (2). Até lá, o código trata tudo isso como "ausente".
