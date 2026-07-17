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
VITE_GRAPHQL_TIMEOUT_MS=20000
```

For local development, keep browser URLs relative and configure Vite's private proxy targets:

```sh
VITE_DEV_GATEWAY_TARGET=http://localhost:2001
VITE_DEV_UPLOAD_TARGET=http://localhost:4001
```

Realtime notifications and Messenger events use authenticated GraphQL-over-SSE subscriptions through the same `VITE_GRAPHQL_GATEWAY_URL` endpoint. Messenger loads only server conversations (there is no synthetic fallback), creates direct conversations idempotently for friends, and also supports selecting multiple friends to create a group conversation. The top-bar dock keeps at most three floating chat windows; a profile's Message action opens the canonical direct conversation.

All active authentication, social, search, recommendation, messaging, notification, and payment flows use typed Gateway GraphQL documents. The retired REST feed/friend/post/messenger screens and clients have been removed; direct HTTP is reserved for authenticated media upload to Upload Server.

## Application routes

The authenticated shell uses browser History routing for `/home`, `/search`, `/friends`, `/reels`, `/groups`, `/profile/:id`, `/messenger`, `/notifications`, `/saved`, `/settings/:section`, and `/premium/payment`. All browser-owned social data is requested through Gateway GraphQL; media upload remains the intentional direct Upload Server flow.

## Media flow

The frontend uploads files directly to Upload Server with authenticated `POST /media/upload`. Upload Server returns a media URL. The frontend then sends that URL through Gateway in `createFeedPost` or `createNormalStory`; SocialGraph stores the URL and returns it in feed/story queries for rendering.

During local development Vite proxies the relative media edge to the canonical Upload Server port:

```sh
VITE_UPLOAD_SERVER_URL=/media
VITE_DEV_UPLOAD_TARGET=http://localhost:4001
```

Keeping the browser-facing value relative also works for remote access through the configured Tailscale edge instead of leaking a client-side `localhost` URL.

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
