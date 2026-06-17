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
VITE_SOCKET_PATH=/socket.io
```

For local development, `.env.development` points API and realtime requests to the API Gateway:

```sh
VITE_API_GATEWAY_URL=http://localhost:5000/api
VITE_SOCKET_GATEWAY_URL=http://localhost:5000
VITE_SOCKET_PATH=/socket.io
```

Socket.io clients should be created with `createGatewaySocket()` from `src/api/realtime.ts`. It derives the gateway origin from `VITE_API_GATEWAY_URL` by default and sends the current access token in the Socket.io handshake auth payload.

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
