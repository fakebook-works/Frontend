# Gateway Services Frontend Integration Design

## Objective

Integrate the public SocialGraph, Recommendation, and Payment Gateway contracts into the Fakebook frontend. Authenticated users must reach a functional application experience instead of landing only on Account Security.

This work changes only the `Frontend` repository. It does not modify Authentication, SocialGraph, Recommendation, Payment, Search, Messaging, Notification, API Gateway, or any other backend service.

## Current State

Authentication already uses the Gateway GraphQL endpoint and supports login, registration, email verification, password recovery, session management, and logout.

The frontend also contains an older home page, post components, profile UI, friend UI, and messenger UI. Those features call legacy REST paths such as `/feed`, `/friends`, `/v1/users`, and `/messenger`. These paths are not evidence of a currently published Gateway contract and must not be presented as working integrations.

The Gateway currently composes and publicly exposes the service surfaces needed for this phase:

- SocialGraph: `visitedGroups`, `postDetail`, `postDetails`, `homeStories`, `myStories`, `recordGroupVisit`, `createFeedPost`, `createNormalStory`, `createShareStory`, and `deleteStory`.
- Recommendation: `recommendFeed`, hydrated through SocialGraph.
- Payment: `premiumPlans`, `premiumOrder`, and `createPremiumCheckout`.
- Authentication: the existing `me.validDate` field supplies the signed-in user's current premium expiry.

Search, Messaging, and Notification are not currently public Gateway subgraphs. The frontend must not call those services directly or claim those features are connected.

## Chosen Approach

Use incremental, typed Gateway GraphQL integration within the existing React application.

This approach preserves the completed authentication work, reuses its access-token refresh and error handling, and replaces legacy API dependencies only where a real public Gateway contract exists. It avoids a high-risk full rewrite and avoids keeping unsupported REST calls active.

## Application Architecture

### Authenticated Application Shell

`App` will continue to use the existing authentication provider as the top-level session authority.

- Signed-out users see `LoginPage` and its authentication flows.
- Signed-in users enter an authenticated application shell.
- The shell provides navigation for Home, Premium, and Account Security.
- Home is the default authenticated destination.
- Account Security remains the existing, functional authentication-management view.
- Unsupported destinations are not shown as working navigation items.

The shell will use local React view state because the application currently has no routing dependency. Introducing a router is outside this phase.

### Gateway GraphQL Client

The existing GraphQL request pipeline remains the single browser-to-backend path for these integrations. New operations must reuse:

- the configured Gateway `/graphql` URL;
- the access-token interceptor;
- HttpOnly refresh-cookie rotation;
- one retry after a successful token refresh;
- centralized `UNAUTHENTICATED` handling;
- Gateway availability notifications.

Service-specific request and response types will be separated into focused frontend modules where that improves readability. The browser must never send trusted internal headers or service secrets.

All GraphQL `ID` and Snowflake-like identifiers remain strings in frontend state. The client must not coerce them to JavaScript numbers. GraphQL `ID` inputs use string variables. For `Long` inputs that can exceed JavaScript's safe-integer range, the client first validates an unsigned decimal string and then emits that value as a GraphQL integer literal; it never performs numeric arithmetic or JSON number conversion on the identifier.

## Feature Design

### Recommended Home Feed

Home loads `recommendFeed(userId, skip, take)` using the authenticated user's canonical ID.

- Preserve the order returned by Recommendation.
- Omit items whose hydrated `post` is `null`; null is a valid privacy, deletion, or authorization race, not a page error.
- Support initial loading, empty feed, retry, and incremental pagination states.
- Distinguish user posts from group posts using `__typename`.
- Render the public post fields only: content, creation time, privacy, author, media, and group metadata when present.
- Do not display fabricated reaction, comment, or share counts because they are absent from this public contract.

Creating a post uses `createFeedPost`. The authenticated user ID is supplied as `authorId`, content and privacy come from the composer, and uploaded media URLs are included only after the existing signed-upload flow succeeds. On success, the new post is inserted into the visible feed without pretending that Recommendation has already reranked it.

Legacy post editing, deleting, reacting, commenting, and sharing controls will not be shown as functional unless a public Gateway operation exists for them.

### Stories

The Home view loads `homeStories` using cursor pagination by author bucket.

- Render story authors and the supported normal/shared story variants.
- Use `endCursor` only when `hasNextPage` is true.
- Support creation through the canonical `createNormalStory` and `createShareStory` mutations when the corresponding source data is available.
- Support deletion only for the signed-in user's stories through `deleteStory`.
- Do not use a non-existent generic `createStory` operation.

The story experience will have explicit empty and unavailable states. It must not substitute friend avatars or seeded content when the service returns no stories.

### Visited Groups

Home displays group shortcuts from `visitedGroups`.

- Cursors are opaque and are never parsed by the frontend.
- Opening a group records the visit through `recordGroupVisit` before or alongside the local detail transition.
- Because no complete public group-detail surface is documented for this phase, shortcuts show the contract's name and avatar data without inventing group membership or feed behavior.

### Premium and Payment

The Premium view loads `premiumPlans` and reads the authenticated user's `validDate` to show current premium state.

- Prices are formatted as Vietnamese đồng from the integer amount returned by Payment.
- Plan duration and code come from the service response; the frontend does not hard-code prices as authoritative values.
- Selecting a plan calls `createPremiumCheckout` during a direct user action.
- The returned checkout URL must parse successfully and use HTTPS before the browser navigates to it. Invalid or non-HTTPS URLs are rejected locally. No PayOS credentials or internal headers are exposed.
- The returned `orderCode` is stored locally as pending checkout state so the UI can query `premiumOrder` when the user returns.
- Order states such as created, pending, paid, cancelled, and expired are rendered from the Payment enum rather than inferred from time alone.
- A paid order triggers an Authentication `me` refresh so `validDate` reflects the activated premium period.

The frontend will provide a manual status refresh and use bounded foreground polling every five seconds for at most two minutes while the Premium view is open. Polling stops immediately when the order reaches a terminal state or the view unmounts. It never runs in the background after navigation.

## Error and State Handling

- `UNAUTHENTICATED` follows the existing refresh-or-sign-out behavior.
- `FORBIDDEN` is shown as an authorization message and does not retry automatically.
- `BAD_USER_INPUT` is shown next to the action that supplied invalid input.
- Gateway network failures use the existing global availability notification plus a local retry action.
- Partial GraphQL data is used only when the required feature data is present and the error does not make the result ambiguous.
- Empty arrays and nullable posts are normal results, not server errors.
- Mutating controls are disabled while their request is pending to prevent duplicate submissions.
- Checkout creation is not automatically retried because a repeated mutation can create multiple orders.

## Unsupported Services and Legacy UI

Search, Messaging, Notification, full profile management, friendship management, comments, reactions, and unsupported post mutations remain outside the functional navigation until the Gateway exposes verified public contracts.

Existing unsupported source files can remain only when they are unreachable from the authenticated application shell and excluded from active service flows. Active application code must not call undocumented direct-service or legacy REST endpoints. Seeded messenger data must not be presented as live service data.

Marketplace remains removed and must not be reintroduced.

## Localization and Accessibility

All new user-facing strings are added in English and Vietnamese with valid UTF-8 text. Existing locale selection behavior remains:

- use the saved locale from `localStorage` when present;
- otherwise select from IP/region detection with a safe browser-language fallback;
- persist explicit user changes.

Interactive controls use semantic buttons and labels, loading states are announced where practical, keyboard focus remains visible, and external checkout navigation is clearly described.

## Verification

Frontend verification must include:

1. TypeScript production build.
2. ESLint with no errors.
3. A static scan proving Marketplace is still absent and no mojibake patterns were introduced.
4. Contract-focused tests for GraphQL response normalization, especially string IDs, nullable recommendation posts, cursor handling, and Payment order states.
5. Component or browser-level checks for loading, empty, error, retry, and successful states of Home and Premium.
6. A live Gateway smoke test, when the composed services are running, covering:
   - authenticated recommended-feed loading;
   - post creation;
   - stories loading;
   - visited groups loading;
   - premium-plan loading;
   - checkout creation without completing a real payment;
   - pending-order status retrieval.

A frontend build alone does not prove service integration. If a live composed environment is unavailable, the final report must distinguish contract-tested behavior from runtime-verified behavior.

## Delivery Sequence

1. Refactor the GraphQL client into reusable typed service operations without changing authentication behavior.
2. Add the authenticated application shell and restore Home as the default destination.
3. Implement Recommendation feed rendering and SocialGraph post creation.
4. Implement stories and visited-group shortcuts.
5. Implement Premium plans, checkout creation, and order status.
6. Remove active dependencies on unsupported legacy REST features.
7. Add localization, accessibility, and contract-focused tests.
8. Run static verification and live Gateway smoke tests where services are available.

## Non-Goals

- No backend, microservice, database, schema, deployment, or API Gateway changes.
- No direct browser calls to internal subgraph endpoints.
- No implementation of unavailable Search, Messaging, or Notification contracts.
- No fake service data or placeholder behavior presented as a working integration.
- No PayOS secret handling in frontend code.
- No Marketplace restoration.
- No broad visual redesign unrelated to integrating the supported services.
