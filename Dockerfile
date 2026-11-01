# One image for the Next.js app and the convex-init job.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    HUSKY=0

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN chmod +x docker/web-start.sh

EXPOSE 3000
CMD ["docker/web-start.sh"]
