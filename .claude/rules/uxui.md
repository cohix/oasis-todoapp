# UX/UI Rules

> Source of truth: `aspec/uxui/interface.md`, `aspec/uxui/experience.md`, `aspec/uxui/setup.md`

## Visual Design

- Color palette: navy blue, black, white, and gunmetal grey
- Interface must be modern and clean
- Application name displayed in the top left, next to the tab bar
- No CLI component

## Responsiveness & Accessibility

- Interface must be fully responsive and mobile-ready
- Follow accessibility best practices
- Support light and dark mode, switchable via a menu in the top right corner

## UX Behaviour

- Data loads automatically from the backend on page load — no manual refresh needed
- Every user action is saved immediately (sent to backend) — no save button required
- Application launches with no signup or login — just run `make up` and open the browser