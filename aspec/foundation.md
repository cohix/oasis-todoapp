# Project Foundation

Name: todoapp
Type: SaaS
Purpose: an application to keep track of my todo items across my major areas of work as an architect.

# Technical Foundation

## Languages and Frameworks

### Frontend
Language: TypeScript
Frameworks: create-react-app
Guidance:
- use small, modular React components with an eye towards reuse
- Use only idiomatic TypeScript
- Only add 3rd party packages when completely needed
- Comment code where appropriate
- Include unit tests in each package, populate those tests with positive and negative test cases.

### Backend
Language: Rust
Frameworks: Warp
Guidance:
- Idiomatic, async Rust code
- Small, easily understood modules and crates
- Prefer simplicity (understandable by an intermediate Rust programmer) over complex code that is concise.

# Best Practices
- Organize code in small, simple, modular components
- Each component should contain unit tests that validate its behaviour in terms of inputs and outputs
- The overall codebase should contain integration tests that validate the interation between components that are used together
- practice

# Personas

### Persona 1:
Name: user
Purpose: the main user of the application
Use-cases:
- create and manage "work areas"
- create and manage todos
- group todos into "bundles"
RBAC:
- all actions allowed
- no actions disallowed