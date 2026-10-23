FROM node:26.12.1-bookworm AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
COPY internal/web/translation /src/internal/web/translation
ENV STORYBOOK_DISABLE_TELEMETRY=1
RUN npm run build

FROM golang:1.27.3-bookworm AS builder
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
ARG CONNECT_HUB_REVISION
ENV CONNECT_HUB_REVISION=$CONNECT_HUB_REVISION
COPY . .
COPY --from=frontend /src/internal/web/dist ./internal/web/dist
RUN python3 hub/package.py

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata openssl curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /src/dist/connect-hub/ /app/
COPY hub/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENV XUI_DB_FOLDER=/etc/connect-hub XUI_LOG_FOLDER=/var/log/connect-hub XUI_BIN_FOLDER=/app/bin XUI_MAIN_FOLDER=/app CONNECT_HUB_INTEGRATIONS_DIR=/etc/connect-hub/integrations XUI_NODE_TOKEN_KEY_FILE=/etc/connect-hub/node_token_key.json
VOLUME ["/etc/connect-hub"]
EXPOSE 2053
ENTRYPOINT ["/app/entrypoint.sh"]
