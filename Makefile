.PHONY: setup lint test build etl release-data dev cname pin-backtest typecheck

NODE_VERSION := 20
PNPM ?= pnpm
UV ?= uv

setup:
	@command -v node >/dev/null || (echo "Node required"; exit 1)
	@node -e "const [maj]=process.versions.node.split('.').map(Number); if(maj!==$(NODE_VERSION)){console.error('Need Node $(NODE_VERSION) LTS, got',process.versions.node); process.exit(1)}"
	corepack enable
	corepack prepare pnpm@9.15.0 --activate
	$(PNPM) install
	cd etl && $(UV) sync --group dev
	@echo "setup ok (ims-backtest pin optional: make pin-backtest when tag is set)"

cname:
	node scripts/write-cname.mjs

pin-backtest:
	node scripts/pin-backtest.mjs
	cd etl && $(UV) sync --extra backtest

lint:
	$(PNPM) run lint
	cd etl && $(UV) run ruff check .
	cd etl && $(UV) run ruff format --check .

typecheck:
	$(PNPM) run typecheck

test:
	$(PNPM) run test
	cd etl && $(UV) run pytest

build:
	$(PNPM) run build

etl:
	cd etl && $(UV) run atlas-etl build

release-data:
	cd etl && $(UV) run atlas-etl release

dev:
	$(PNPM) run dev
