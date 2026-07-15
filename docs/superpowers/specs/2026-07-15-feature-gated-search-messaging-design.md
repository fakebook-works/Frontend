# Unavailable Service Navigation Design

## Goal

Show Search, Messaging, and Notification navigation icons without implementing pages that cannot connect to a public API.

## Behavior

- Search, Messaging, and Notification icons are always visible.
- All three icons are disabled and cannot navigate.
- Disabled icons expose an accessible unavailable label and tooltip.
- No GraphQL request, direct subgraph request, placeholder page, mock data, or feature flag is added.
- Existing Home, Premium, and Security navigation remains functional.

## Availability Rule

A service page is implemented only after its contract is publicly composed through API Gateway and can be runtime-tested from the frontend.

- Search: deferred; not composed.
- Messaging: deferred; not composed and Gateway SSE support is missing.
- Notification: deferred; repository has no product API contract.

## Upload Server

Upload Server is intentionally direct and does not need API Gateway proxying. Frontend uses its authenticated `POST /media/upload` endpoint and then passes returned media URLs to SocialGraph mutations through Gateway.

## Non-Goals

- No backend, Upload Server, or API Gateway changes.
- No direct browser calls to Search, Messaging, or Notification subgraphs.
- No selectable dead-end pages.
