FROM node:24.19.0-alpine3.23 AS build

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

FROM nginx:1.30.4-alpine-slim

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
