# Facebook-Inspired Fakebook Redesign

## Goal

Redesign Fakebook's authentication and core application shell to follow the familiar hierarchy, density, and interaction patterns shown in the supplied Facebook references while retaining Fakebook branding, existing data flows, and original assets.

## Visual Direction

- Use a restrained Facebook-like system with clean grotesk typography, strong blue actions, flat surfaces, subtle dividers, circular avatars, and compact navigation.
- Dark home surfaces use `#18191a`, `#242526`, `#3a3b3c`, soft gray text, and a Fakebook blue close to `#0866ff`.
- Authentication and settings use spacious light surfaces with white backgrounds, gray borders, black primary text, and blue links/actions.
- Do not copy Facebook photography, logos, or proprietary assets. Use Fakebook branding and existing local imagery.

## Login

Create a responsive split-screen login experience. The left side contains the Fakebook logo, a lifestyle image composition, and a short brand statement. The right side contains email, password, primary login, password recovery, account creation, and language controls. On mobile, the image composition collapses and the form becomes the primary view.

## Signup

Replace the registration modal with a dedicated signup screen. Use a focused form column containing name, date of birth, gender, email, location, password, user-friendly privacy text, primary signup, existing-account navigation, and the language/footer area. Preserve the existing registration request and email-verification flow.

## Authenticated Home

Use a fixed top navigation bar, left navigation rail, centered feed, and right contextual rail. The center contains the composer, stories, and posts. The right rail contains useful social modules such as friend requests, birthdays, and contacts when data is available. Responsive breakpoints remove the right rail first, collapse the left rail next, and leave a focused mobile feed.

## Avatar Menu

Clicking the header avatar opens a compact anchored menu styled after the supplied reference. It contains:

- The signed-in profile card and a View Profile action.
- Fakebook Premium, opening its section inside Settings & Privacy.
- Settings & Privacy.
- Language.
- Display & Accessibility for light/dark appearance.
- Logout.

Do not add Business Suite, incident reporting, activity logs, or support destinations that the current application cannot fulfill. Keyboard focus, Escape dismissal, outside-click dismissal, and appropriate ARIA semantics are required.

## Settings & Privacy

Create one settings destination matching the supplied full-page reference. Retain the shared application header. Use a fixed-width left navigation column with the page title, settings search, grouped categories, icons, short descriptions, and a scrollable content area. The main region starts with a prominent settings search and frequently used settings shortcuts, followed by the selected category content.

The available categories are:

- Profile details: name, avatar, bio, location, birth date, and gender.
- Security & Login: password change and account verification guidance.
- Privacy: existing profile and post visibility controls.
- Sessions & Devices: active sessions, session history, and device revocation.
- Language.
- Display & Accessibility: light/dark theme and readable appearance controls already supported by the app.

Language and light/dark appearance controls live inside this page rather than being permanently scattered around the application shell. Security and account concerns include password changes, verification guidance, active sessions, session history, and device revocation. Search filters existing settings by translated title and description.

Do not present nonfunctional technical placeholders. Premium becomes a category inside Settings & Privacy and is linked directly from the avatar menu.

## Content

Continue the approved end-user copy cleanup. Render benefits, actions, and recovery guidance instead of internal service names, endpoints, or backend status.

## Remaining Screens

Apply the same Facebook-inspired design system to every remaining user-facing screen and state, including profile, profile editing, Messenger, Premium, email verification, two-factor prompts, password recovery/reset, session/device management, empty states, loading states, errors, modals, menus, and responsive navigation.

Reuse shared Fakebook components and tokens rather than creating page-specific visual systems. Match the supplied references closely in layout language, density, color, borders, typography, icon framing, navigation behavior, and responsive hierarchy while retaining Fakebook branding and avoiding copied Facebook assets or photography.

## Behavior and Compatibility

- Preserve Authentication, SocialGraph, Messenger, Payment, routing, and realtime contracts.
- Preserve light/dark theme support.
- Preserve English/Vietnamese translations and fallback behavior for other locales.
- Do not require Docker lifecycle changes.

## Image-First Workflow

Generate five standalone implementation references before coding:

1. Login screen.
2. Signup screen.
3. Authenticated home screen.
4. Settings & Privacy screen.
5. Header avatar-menu detail.

Analyze layout, typography, spacing, controls, colors, responsive behavior, and reusable component rules from each image before implementation.

## Verification

- Production build succeeds.
- Relevant authentication, home, settings, theme, locale, and Messenger tests pass.
- No user-facing infrastructure terminology remains.
- Keyboard and pointer interactions work for the avatar menu and settings navigation.
- Login, signup, home, and settings remain usable at desktop, tablet, and mobile widths.
