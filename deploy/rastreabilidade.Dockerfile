# Link por corretor (rastreabilidade/servidor.mjs) no Cloud Run.
# Contexto: a pasta montada por `python deploy/contexto.py rastreabilidade <pasta>`; ver deploy/README.md.
FROM node:24-bookworm-slim
WORKDIR /app
COPY deploy/servicos/package.json deploy/servicos/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY rastreabilidade ./rastreabilidade
# O Cloud Run manda a porta em PORT e exige escutar fora do loopback.
ENV NODE_ENV=production TRACKING_BIND_HOST=0.0.0.0
USER node
CMD ["node", "rastreabilidade/servidor.mjs"]
