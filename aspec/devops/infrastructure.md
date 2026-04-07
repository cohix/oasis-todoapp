# Infrastructure

Deployment platform: developer laptop Docker
Cloud platform: none
Automation: docker-compose

## Architecture:
- use docker-compose to launch all components when the developer runs `make up`
- use simple, idiomatic Dockerfiles for each component that pull base images from Docker Hub.