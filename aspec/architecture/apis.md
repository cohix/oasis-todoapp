# APIs

Convention: REST
Protocol: HTTP

## Guidance:
- conventional REST APIs should be used which reference objects (such as work areas, todos, bundles) using CRUD actions.
- version the API such that breaking changes can coexist with older versions of the API
- APIs should exist at a common URL base path such as `/api/v1/...`
- all API calls should be idempotent
- all API calls should result in a completed task, no async background work or eventual consistency