# Zwei Stufen: bauen mit den Entwicklungs-Abhängigkeiten, ausliefern nur mit
# dem Server. Node 22 bringt SQLite mit, es gibt keine nativen Abhängigkeiten.
FROM node:22-slim AS bau
WORKDIR /bau
COPY app/package.json app/package-lock.json ./app/
RUN npm --prefix app ci
COPY modell.mjs modell.d.mts ./
COPY public ./public
COPY app ./app
RUN npm --prefix app run build

FROM node:22-slim

ENV NODE_ENV=production \
    PORT=8124 \
    HOST=0.0.0.0 \
    KARABIRRDT_DB=/data/karabirrdt.sqlite

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY *.mjs ./
COPY public ./public
COPY --from=bau /bau/public ./public

RUN mkdir -p /data && chown -R node:node /data /app

USER node
VOLUME ["/data"]
EXPOSE 8124

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8124)+'/api/bretter').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
