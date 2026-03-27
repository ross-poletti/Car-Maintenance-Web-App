FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY server/package.json ./server/package.json
RUN npm install --workspaces --include-workspace-root

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server/package.json ./server/package.json
COPY server/src ./server/src
WORKDIR /app/server
EXPOSE 4000
CMD ["node", "src/index.js"]
