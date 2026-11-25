.PHONY: up down restart logs build test lint clean help

help:
	@echo "CloudTorrent Management Commands:"
	@echo "  make up         - Start all services with docker compose"
	@echo "  make down       - Stop and remove all containers"
	@echo "  make restart    - Restart all services"
	@echo "  make logs       - Tail logs of all containers"
	@echo "  make build      - Build or rebuild Docker images"
	@echo "  make test       - Run backend test suite"
	@echo "  make clean      - Clean cache and temporary files"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

build:
	docker compose build

test:
	cd backend && pytest tests -v

clean:
	rm -rf backend/.pytest_cache backend/__pycache__ frontend/dist frontend/node_modules/.vite
