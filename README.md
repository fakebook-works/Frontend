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
```

For local development, `.env.development` points API requests to the API Gateway:

```sh
VITE_API_GATEWAY_URL=http://localhost:5000/api
```

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
