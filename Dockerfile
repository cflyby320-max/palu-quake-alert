# Portable always-on runtime. This is the RECOMMENDED production deployment:
# a long-lived process that polls every POLL_SECONDS and keeps dedup state on a
# mounted volume. Runs on any host (a $5 VPS, Fly.io, Railway, a Raspberry Pi).
#
# Build:  docker build -t palu-alert .
# Run:    docker run -d --restart=always --env-file .env \
#                    -v palu_state:/data palu-alert
#   (STATE_FILE/LOG_FILE point at /data so dedup survives restarts.)

FROM node:20-alpine
WORKDIR /app
COPY package.json run.js ./
COPY src ./src
COPY fixtures ./fixtures
COPY design ./design
# The watcher itself has ZERO dependencies and needs no `npm install`.
#
# The Instagram studio (optional, opt-in via STUDIO_ENABLED) is isolated in
# studio/ with its own package.json. Its single dependency — the SVG rasteriser —
# is installed ONLY here, fetching the correct Linux/musl binary for this image
# (the host's node_modules is excluded by .dockerignore). The bundled fonts under
# studio/assets travel in the COPY so cards render with no system fonts. A studio
# failure can never affect alert delivery, and flipping STUDIO_ENABLED needs no rebuild.
COPY studio ./studio
RUN npm install --prefix studio --omit=dev
ENV STATE_FILE=/data/state.json
ENV LOG_FILE=/data/quake_alert.log
VOLUME ["/data"]
CMD ["node", "run.js"]
