# End-User Copy Cleanup

## Goal

Remove infrastructure and implementation terminology from the Fakebook user interface. Users should see language describing actions, benefits, status, and recovery steps rather than internal services or protocols.

## Scope

Apply the cleanup to all user-facing English and Vietnamese copy in the frontend, including the home experience, registration, account and session management, premium, and Messenger.

Remove or rewrite references to SocialGraph, Recommendation, Authentication, API Gateway, GraphQL, endpoints, backend routes, service ownership, and preview integration status. Source-code comments and developer documentation are outside this change unless their text is rendered to users.

## Content Rules

- Describe what the user can do or what information they are seeing.
- Keep helper text brief and natural.
- Use generic recovery messages such as “Unable to load data” and “This feature is currently unavailable.”
- Do not expose which internal component failed.
- Preserve meaningful security information, such as whether a session is active or a verification step is required.
- Keep English and Vietnamese translations semantically aligned.

## Component Changes

- Home subtitles describe feeds, stories, and shortcuts without naming data providers.
- Registration describes creation of an account and profile without service ownership details.
- Account pages describe credentials, verification, and sessions in user language.
- Premium headings and errors describe plans and checkout rather than payment services.
- Messenger removes API route panels, backend-status labels, and technical seed conversations. Empty, loading, offline, and unavailable states remain clear.

## Behavior

No API, state-management, routing, authentication, payment, or realtime behavior changes are included. This is a presentation-only change.

## Verification

1. Search rendered frontend source for internal technology names and confirm none remain in user-facing strings.
2. Run the frontend production build.
3. Run relevant frontend tests.
4. Confirm both English and Vietnamese screens retain useful labels, helper text, errors, and empty states.
