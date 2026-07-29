FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite values are public browser configuration, never application secrets.
ARG VITE_API_GATEWAY_URL
ARG VITE_GRAPHQL_GATEWAY_URL
ARG VITE_GRAPHQL_TIMEOUT_MS
ARG VITE_UPLOAD_SERVER_URL
ARG VITE_IP_GEOLOCATION_URL

RUN npm run build

FROM nginx:1.27-alpine AS final

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
