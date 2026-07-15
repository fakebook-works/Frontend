# SocialGraph Registration Frontend Design

## Scope

Change only the Fakebook frontend registration flow. API Gateway and all backend microservices remain read-only and unchanged.

## Problem

The registration modal currently asks for a username and posts a legacy REST payload to `/v1/auth/register`. That contract does not match the current platform architecture:

- Authentication owns email/password identity and does not own username, gender, or other profile fields.
- Public registration is the API Gateway GraphQL `createUser` mutation owned by SocialGraph.
- SocialGraph's current `CreateUserInput` requires `name`, `gender`, `birthdate`, `location`, `email`, and `password`.
- `createUser` returns registration status and the canonical user ID; it does not return an authenticated session.

## User Experience

The registration modal will contain:

- Full name
- Email address
- Password
- Gender
- Birth date
- Location

It will not contain or derive a username. Gender will be collected as profile data and sent only through the SocialGraph-owned registration mutation.

All required fields must be present before submission. Password validation will match the backend minimum of eight characters. While submitting, the form is disabled. On success, the modal displays a confirmation telling the user to verify their email before logging in. Registration does not log the user in automatically.

## Frontend API Contract

The frontend will send this GraphQL operation to `VITE_GRAPHQL_GATEWAY_URL`, falling back to `/graphql`:

```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    success
    userId
    message
  }
}
```

Variables use this shape:

```json
{
  "input": {
    "name": "Nguyen Van A",
    "gender": true,
    "birthdate": "2000-01-01",
    "location": "Ha Noi",
    "email": "a@example.com",
    "password": "secret123"
  }
}
```

The GraphQL client will treat HTTP errors, GraphQL errors, and a `success: false` payload as registration failures. It will not persist tokens or user state.

## Component and State Changes

- `src/api/client.ts`: replace the legacy registration request and username-bearing `RegisterBody` with a GraphQL `createUser` request and registration result type.
- `src/lib/auth.tsx`: registration returns the result without calling `persistAuth`.
- `src/pages/LoginPage.tsx`: remove username state/input, add SocialGraph profile fields, validate the form, and show the post-registration confirmation.
- `src/i18n.tsx`: update registration/login wording and add labels/messages needed by the new flow.
- `src/App.css`: extend registration form styling to cover select elements and the success state.

## Error Handling

- Network and Gateway availability failures use the existing temporary-unavailable behavior.
- GraphQL validation/service errors are converted to `ApiError` so the modal can display a safe account-creation error.
- Duplicate email errors use an email-specific message; username is never mentioned.
- A failed request leaves the entered data in place for correction and retry.

## Verification

- A static contract check must prove the registration modal and `RegisterBody` no longer contain username and that the client contains the `createUser` operation.
- `npm run lint` must pass.
- `npm run build` must pass.
- The final request construction must be inspected to confirm gender is nested under the SocialGraph `CreateUserInput`, not sent to a legacy Authentication endpoint.

## Non-goals

- No API Gateway or microservice changes.
- No changes to login, refresh-token, or logout contracts in this slice.
- No username generation or profile username policy.
- No automatic login after registration.
