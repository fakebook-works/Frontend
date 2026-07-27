# Frontend agent rules

When embedded in the Fakebook workspace, also read the root API security contract.

- Application API traffic uses the Gateway GraphQL client. Do not call subgraph ports.
- Multipart media uses the Upload client; send returned URLs through normal GraphQL mutations.
- Do not store refresh tokens, service secrets, private JWT keys or trusted user headers.
- Preserve Snowflake/64-bit IDs as strings at the JavaScript boundary.
- Stop subscription reconnect loops on authentication/session rejection and clean up hidden streams.
- Do not suppress security/auth errors by treating them as empty data.
- Do not change established UI appearance unless explicitly requested.
- Run npm test, npm run build, npm run lint and npm audit after API/dependency changes.
