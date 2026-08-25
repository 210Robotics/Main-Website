FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates espeak-ng ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY index.ts ./
COPY voice-state.ts ./

ENV NODE_ENV=production
EXPOSE 8787

CMD ["npm", "start"]
