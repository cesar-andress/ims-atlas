.PHONY: setup lint test e2e build etl pipeline-fixture release-staging promote-release release-data catalog-port catalog-validate check-live rights-report qa lineage coverage-report phase3-report export-phase5-goldens dev cname pin-backtest typecheck

NODE_VERSION := 20
PNPM ?= pnpm
UV ?= uv

setup:
	@command -v node >/dev/null || (echo "Node required"; exit 1)
	@node -e "const [maj]=process.versions.node.split('.').map(Number); if(maj!==$(NODE_VERSION)){console.error('Need Node $(NODE_VERSION) LTS, got',process.versions.node); process.exit(1)}"
	corepack enable
	corepack prepare pnpm@9.15.0 --activate
	$(PNPM) install
	$(PNPM) --filter @ims-atlas/app exec playwright install chromium
	cd etl && $(UV) sync --extra backtest --group dev
	@echo "setup ok (ims-backtest @ config/ims-backtest.json tag)"

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
	cd etl && $(UV) sync --extra backtest --group dev
	cd etl && $(UV) run pytest

e2e:
	$(PNPM) --filter @ims-atlas/app run build
	$(PNPM) --filter @ims-atlas/app run e2e

build:
	$(PNPM) run build

etl:
	cd etl && $(UV) run atlas-etl build --fixture-root tests/fixtures/mini_world --force

pipeline-fixture:
	cd etl && $(UV) run atlas-etl run --fixture-root tests/fixtures/mini_world --force

qa:
	cd etl && $(UV) run atlas-etl qa

lineage:
	cd etl && $(UV) run atlas-etl lineage

coverage-report:
	cd etl && $(UV) run atlas-etl coverage-report

phase3-report:
	cd etl && $(UV) run atlas-etl phase3-report

export-phase5-goldens:
	cd etl && $(UV) sync --extra backtest --group dev
	cd etl && $(UV) run atlas-etl export-phase5-goldens

release-staging:
	cd etl && $(UV) run atlas-etl release --version 0.1.0 --staging --force
	cd etl && $(UV) run atlas-etl lineage
	cd etl && $(UV) run atlas-etl qa
	cd etl && $(UV) run atlas-etl coverage-report
	cd etl && $(UV) run atlas-etl phase3-report

promote-release:
	@test -n "$(BY)" || (echo "Usage: make promote-release BY='Your Name'"; exit 1)
	cd etl && $(UV) run atlas-etl promote 0.1.0 --by "$(BY)" --force

catalog-port:
	cd etl && $(UV) sync --extra backtest --group dev
	cd etl && $(UV) run atlas-etl catalog-port

catalog-validate:
	cd etl && $(UV) run atlas-etl catalog-validate

rights-report:
	cd etl && $(UV) run atlas-etl rights-report

check-live:
	cd etl && $(UV) run atlas-etl check-live

release-data: release-staging

dev:
	$(PNPM) run dev
