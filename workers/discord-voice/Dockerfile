FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY index.ts ./

ENV NODE_ENV=production
EXPOSE 8787

CMD ["npm", "start"]
