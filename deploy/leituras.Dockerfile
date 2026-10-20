# Serviço de leituras (tools/leitura-api.mjs) no Cloud Run: o Node recebe e chama o Python, que
# valida a leitura e gera a prévia 3D (pipeline/gerar_maquete.py + v1.5/miniaturas/pagina_maquete.py).
# Contexto: a pasta montada por `python deploy/contexto.py leituras <pasta>`; ver deploy/README.md.
# Os dois estágios usam Debian bookworm: o binário do Node copiado acha a mesma glibc e a libstdc++.
FROM node:24-bookworm-slim AS node
WORKDIR /app
COPY deploy/servicos/package.json deploy/servicos/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM python:3.14-slim-bookworm
COPY --from=node /usr/local/bin/node /usr/local/bin/node
# requirements.txt: jsonschema é o único pacote que a leitura e a prévia importam.
RUN pip install --no-cache-dir "jsonschema>=4.26,<5" && useradd --create-home app
WORKDIR /app
COPY --from=node /app/node_modules ./node_modules
COPY deploy/servicos/package.json ./
COPY . .
RUN rm -f Dockerfile
ENV READINGS_BIND_HOST=0.0.0.0 PYTHON=python PYTHONDONTWRITEBYTECODE=1
USER app
CMD ["node", "tools/leitura-api.mjs"]
