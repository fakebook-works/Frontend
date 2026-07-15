# Fakebook Frontend

React + TypeScript frontend for Fakebook, built with Vite.

## Requirements

- Node.js 20 or newer
- npm

## Setup

Install dependencies:

```sh
npm install
```

Create or update environment files as needed:

```sh
VITE_API_GATEWAY_URL=/api
VITE_GRAPHQL_GATEWAY_URL=/graphql
VITE_UPLOAD_SERVER_URL=/media
VITE_SOCKET_PATH=/socket.io
```

For local development, `.env.development` points API and realtime requests to the API Gateway:

```sh
VITE_API_GATEWAY_URL=http://localhost:5000/api
VITE_SOCKET_GATEWAY_URL=http://localhost:5000
VITE_SOCKET_PATH=/socket.io
```

Socket.io clients should be created with `createGatewaySocket()` from `src/api/realtime.ts`. It derives the gateway origin from `VITE_API_GATEWAY_URL` by default and sends the current access token in the Socket.io handshake auth payload.

## Media flow

The frontend uploads files directly to Upload Server with authenticated `POST /media/upload`. Upload Server returns a media URL. The frontend then sends that URL through Gateway in `createFeedPost` or `createNormalStory`; SocialGraph stores the URL and returns it in feed/story queries for rendering.

When Upload Server uses a separate origin, configure:

```sh
VITE_UPLOAD_SERVER_URL=http://localhost:5050
```

Relative media URLs are normalized to that origin before being saved through SocialGraph.

## Scripts

Start the development server:

```sh
npm run dev
```

Build the app:

```sh
npm run build
```

Run lint checks:

```sh
npm run lint
```

Preview the production build:

```sh
npm run preview
```
