FROM mcr.microsoft.com/playwright:v1.61.0-jammy@sha256:264136758e43332108f6420f82c47f639f619ca65301065ceade677763f477ec AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

FROM mcr.microsoft.com/playwright:v1.61.0-jammy@sha256:264136758e43332108f6420f82c47f639f619ca65301065ceade677763f477ec AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npx playwright install chromium

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=3100
ENV HOST=0.0.0.0
ENV LAUNCH=true
ENV BROWSER_WIDTH=1280
ENV BROWSER_HEIGHT=720

EXPOSE 3100

CMD ["sh", "-c", "node dist/index.js --port ${PORT:-3100} --host ${HOST:-0.0.0.0}"]
