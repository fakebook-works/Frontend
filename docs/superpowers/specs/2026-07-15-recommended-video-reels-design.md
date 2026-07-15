# Reels Frontend Availability Decision

## Decision

Do not implement Reels page until API Gateway exposes a public Reels contract.

Repository documentation confirms:

- `reelCandidates(userId, limit)` is marked `@internal` in Gateway composition.
- `GET /internal/recommendation/reel-candidates` is service-to-service REST.
- `createReel` is composition-internal.
- Public Gateway feed documentation does not list a Reels query.

Filtering `recommendFeed` video posts is not the correct Reels backend contract and would not load all reels.

## Frontend Behavior

- Reels icon remains visible.
- Reels icon is disabled and cannot navigate.
- Accessible label reports unavailable state.
- No direct SocialGraph/Recommendation call, mock page, or fake reel data is added.

## Activation Requirement

Implement Reels only after Gateway publishes a viewer-authorized query returning hydrated reel ID, content, media, author, pagination, and privacy-filtered results.

## Non-Goals

- No backend, SocialGraph, Recommendation, or Gateway changes.
- No use of internal endpoints from browser.
