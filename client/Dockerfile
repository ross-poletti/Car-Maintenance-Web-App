FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY client/package.json ./client/package.json
RUN npm install --workspaces --include-workspace-root

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
COPY client ./client
WORKDIR /app/client
RUN npm run build

FROM nginx:1.29-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
