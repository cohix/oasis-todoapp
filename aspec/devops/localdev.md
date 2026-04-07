# Local Development

Development: docker
Build tools: make, npm, cargo

## Workflows:

### Developer Loop:
- `make all` should build all components as local Docker images to be prepared for execution.
- `make test` should build latest Docker images and execute all unit, integration, and end-to-end tests.
- `make up` should build all components as local Docker images (if source has been updated since last build), start the backend service, and serve the UI webapp via Docker Compose.

### Local testing:
- `make test` should build all components and run all unit tests, integration tests, and end to end tests.

### Version control:
- For new work items, create a branch called `{feature|bug|task}-XXXX-name` based on the filename of the work item at hand.

### Documentation:
- Usage documentation should be generated for each work item and placed into the `docs/` folder.