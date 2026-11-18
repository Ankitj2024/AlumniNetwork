FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace apps/web --include-workspace-root
COPY apps/web apps/web
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
RUN npm run build -w apps/web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web ./apps/web
USER node
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
