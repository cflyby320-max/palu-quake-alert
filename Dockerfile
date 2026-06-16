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
ENV STATE_FILE=/data/state.json
ENV LOG_FILE=/data/quake_alert.log
VOLUME ["/data"]
# No `npm install` — this project has zero dependencies by design.
CMD ["node", "run.js"]
