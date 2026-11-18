FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --include-workspace-root
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/api --omit=dev && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist
RUN mkdir -p apps/api/uploads apps/api/outbox && chown -R node:node apps/api
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
