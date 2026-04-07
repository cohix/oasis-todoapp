# Work Items Rules

> Source of truth: `aspec/work-items/`

## Format

Each work item file (`NNNN-name.md`) defines:
- **Name** and issue link
- **Overview** and description
- **User Stories** — as a [persona], I want to [action], so I can [outcome]
- **Implementation Guidance** — concrete technical direction
- **Edge Case Considerations** — boundary conditions to handle
- **Codebase Integration** — which components are affected and how they interact

## Workflow

Before writing any code for a work item:
1. Read the full work item spec
2. Understand all user stories and acceptance criteria
3. Review implementation guidance, edge cases, and codebase integration notes
4. Create a branch: `{feature|bug|task}-XXXX-name` (based on the work item filename)
5. Implement UI and backend components separately; they communicate via REST API
6. Generate usage documentation and place it in `docs/`

## Naming

Work item files use zero-padded 4-digit indices: `NNNN-name.md`.
New work items must be added to `aspec/work-items/` before implementation begins.