# syntax=docker/dockerfile:1
# Pinned base images; dev is the default target, build produces static assets.
FROM node:20.18.1-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20.18.1-bookworm-slim AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:20.18.1-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
USER node
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
