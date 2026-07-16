/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_GATEWAY_URL?: string
  readonly VITE_GRAPHQL_GATEWAY_URL?: string
  readonly VITE_UPLOAD_SERVER_URL?: string
  readonly VITE_DEV_GATEWAY_TARGET?: string
  readonly VITE_DEV_UPLOAD_TARGET?: string
  readonly VITE_DEV_ALLOWED_HOST?: string
  readonly VITE_IP_GEOLOCATION_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
