SHELL := /bin/bash
NPM ?= npm

.PHONY: setup install setup-hooks lint format format-check typecheck build test verify \
	db-up db-down db-generate db-migrate db-seed bootstrap

setup: install setup-hooks

install:
	$(NPM) install

setup-hooks:
	git config core.hooksPath .githooks

lint:
	$(NPM) run lint

format:
	$(NPM) run format

format-check:
	$(NPM) run format:check

typecheck:
	$(NPM) run typecheck

build:
	$(NPM) run build

test:
	$(NPM) run test

verify: lint format-check typecheck build

db-up:
	docker compose up -d postgres redis

db-down:
	docker compose down

db-generate:
	$(NPM) run db:generate

db-migrate:
	$(NPM) run db:migrate

db-seed:
	$(NPM) run db:seed

bootstrap: db-up db-generate db-migrate db-seed
