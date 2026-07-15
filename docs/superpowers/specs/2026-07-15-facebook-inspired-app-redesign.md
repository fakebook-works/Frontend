# Accurate Facebook UI/UX Clone for Fakebook

## Goal

Clone the supplied Facebook UI/UX references as accurately as the existing React application permits while retaining Fakebook branding, existing data flows, and local assets. Fidelity includes layout proportions, component dimensions, spacing, typography hierarchy, colors, borders, shadows, interaction states, menus, responsive collapse order, and form behavior.

## Authoritative References

The following screenshots are the visual source of truth:

- `C:\Users\ngoan\Downloads\facebook ui\dang nhap fb.png`
- `C:\Users\ngoan\Downloads\facebook ui\dang ky fb.png`
- `C:\Users\ngoan\Downloads\facebook ui\dang ky2 fb.png`
- `C:\Users\ngoan\Downloads\facebook ui\facebook.png`
- `C:\Users\ngoan\Downloads\facebook ui\dropdown menu avatar.png`
- `C:\Users\ngoan\Downloads\facebook ui\settings.png`
- `C:\Users\ngoan\Downloads\facebook ui\settings page.png`

When this document and a screenshot differ visually, the screenshot wins unless following it would break an existing functional or accessibility contract.

## Visual Direction

- Use a restrained Facebook-like system with clean grotesk typography, strong blue actions, flat surfaces, subtle dividers, circular avatars, and compact navigation.
- Dark home surfaces use `#18191a`, `#242526`, `#3a3b3c`, soft gray text, and a Fakebook blue close to `#0866ff`.
- Authentication and settings use spacious light surfaces with white backgrounds, gray borders, black primary text, and blue links/actions.
- Keep Fakebook branding and existing local imagery, but match the screenshots' geometry and visual treatment closely. Do not introduce external Facebook photography or copyrighted Facebook logos.

## Login

Create a responsive split-screen login experience. The left side contains the Fakebook logo, a lifestyle image composition, and a short brand statement. The right side contains email, password, primary login, password recovery, account creation, and language controls. On mobile, the image composition collapses and the form becomes the primary view.

The password control includes an accessible eye button that toggles visibility without losing focus or changing the value. The button exposes translated show/hide labels and remains keyboard operable.

## Signup

Replace the registration modal with a dedicated signup screen. Use a focused form column containing name, date of birth, gender, email, location, password, password confirmation, user-friendly privacy text, primary signup, existing-account navigation, and the language/footer area. Preserve the existing registration request and email-verification flow.

Registration password behavior:

- Password and password-confirmation fields both have accessible visibility toggles.
- Confirmation must match before the registration request is sent.
- A live strength meter reports weak, fair, good, or strong using length and character-class checks.
- The meter is guidance, while the existing backend-compatible minimum of eight characters remains the submission gate.
- Date of birth must represent an age from 14 through 120 inclusive. The date input exposes matching `min`/`max` values and submit-time validation rejects bypass attempts.

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

Premium plan cards and the Premium settings section list a verified profile badge as a user-facing benefit. This addition is presentation copy only; the frontend must not grant or forge verification state.

## Content

Continue the approved end-user copy cleanup. Render benefits, actions, and recovery guidance instead of internal service names, endpoints, or backend status.

## Remaining Screens

Apply the same accurately cloned Facebook design system to every remaining user-facing screen and state, including profile, profile editing, Messenger, Premium, email verification, two-factor prompts, password recovery/reset, session/device management, empty states, loading states, errors, modals, menus, and responsive navigation.

Reuse shared Fakebook components and tokens rather than creating page-specific visual systems. Match the supplied references closely in layout language, density, color, borders, typography, icon framing, navigation behavior, and responsive hierarchy while retaining Fakebook branding and avoiding copied Facebook assets or photography.

## Behavior and Compatibility

- Preserve Authentication, SocialGraph, Messenger, Payment, routing, and realtime contracts.
- Preserve light/dark theme support.
- Preserve English/Vietnamese translations and fallback behavior for other locales.
- Do not require Docker lifecycle changes.

## Screenshot-Led Workflow

Implement in five fidelity passes using the supplied screenshots directly:

1. Login and signup, including all password and birth-date behavior.
2. Authenticated top bar, navigation rails, composer, stories, and feed proportions.
3. Header avatar-menu placement, sizing, focus behavior, and menu rows.
4. Settings drawer and full settings page.
5. Responsive collapse and final cross-screen token cleanup.

After each pass, render the local app at the reference viewport, capture a screenshot, and compare geometry, typography, spacing, controls, and colors against the matching source image before moving to the next pass.

## Verification

- Production build succeeds.
- Relevant authentication, home, settings, theme, locale, and Messenger tests pass.
- No user-facing infrastructure terminology remains.
- Keyboard and pointer interactions work for the avatar menu and settings navigation.
- Login, signup, home, and settings remain usable at desktop, tablet, and mobile widths.
- Registration tests prove password confirmation, strength feedback, visibility toggles, and age validation.
- Login tests prove its password visibility toggle is keyboard accessible and does not alter submitted credentials.
- Browser screenshots are captured at the reference viewport sizes and reviewed side by side with all seven supplied images.
