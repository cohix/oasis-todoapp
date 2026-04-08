IMAGE := todoapp

.PHONY: all docker up test e2e

## docker: build the monolithic Docker image
docker:
	docker build -t $(IMAGE) .

## up: run the container on port 3000 (Ctrl-C to stop)
up:
	docker run --rm \
	    -p 3000:80 \
	    -v "$(HOME)/.todoapp:/root/.todoapp" \
	    --name $(IMAGE) \
	    $(IMAGE)

# upd: run the image in the background on 3000
upd:
	docker run -d --rm \
	    -p 3000:80 \
	    -v "$(HOME)/.todoapp:/root/.todoapp" \
	    --name oasis-todoapp \
	    $(IMAGE)

## test: build image, run unit/integration tests, then run E2E tests against the container
test: docker
	cd backend && cargo test
	cd frontend && npm test -- --watchAll=false
	cd e2e && npm install
	cd e2e && npx playwright install chromium
	docker run -d --rm \
	    -p 80:80 \
	    -v "$(HOME)/.todoapp:/root/.todoapp" \
	    --name $(IMAGE) \
	    $(IMAGE)
	@echo "Waiting for services to be ready..."
	@until curl -sf http://localhost/api/v1/health > /dev/null; do sleep 1; done
	cd e2e && npm test; STATUS=$$?; docker stop $(IMAGE); exit $$STATUS

## e2e: build image, start container, run E2E tests, stop container
e2e:
	cd e2e && npm install
	cd e2e && npx playwright install chromium
	docker build -t $(IMAGE) .
	docker run -d --rm \
	    -p 80:80 \
	    -v "$(HOME)/.todoapp:/root/.todoapp" \
	    --name $(IMAGE) \
	    $(IMAGE)
	@echo "Waiting for services to be ready..."
	@until curl -sf http://localhost/api/v1/health > /dev/null; do sleep 1; done
	cd e2e && npm test; STATUS=$$?; docker stop $(IMAGE); exit $$STATUS
