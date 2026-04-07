.PHONY: all up test e2e

## all: build all components as local Docker images
all:
	docker compose build

## up: build Docker images if source has changed, then start the app (frontend :3000, backend :8080)
up:
	docker compose up --build

## test: build latest Docker images, run all unit/integration tests, then run E2E tests
test:
	docker compose build
	cd backend && cargo test
	cd frontend && npm test -- --watchAll=false
	cd e2e && npm install
	cd e2e && npx playwright install chromium
	docker compose up -d
	@echo "Waiting for services to be ready..."
	@until curl -sf http://localhost:8080/api/v1/health > /dev/null; do sleep 1; done
	@until curl -sf http://localhost:3000 > /dev/null; do sleep 1; done
	cd e2e && npm test; STATUS=$$?; docker compose down; exit $$STATUS

## e2e: install playwright (first run only), start the stack, run E2E tests, then stop
##      Requires Docker. The stack is started in detached mode, tests run, then it is torn down.
e2e:
	cd e2e && npm install
	cd e2e && npx playwright install chromium
	docker compose up -d --build
	@echo "Waiting for services to be ready..."
	@until curl -sf http://localhost:8080/api/v1/health > /dev/null; do sleep 1; done
	@until curl -sf http://localhost:3000 > /dev/null; do sleep 1; done
	cd e2e && npm test; STATUS=$$?; docker compose down; exit $$STATUS
