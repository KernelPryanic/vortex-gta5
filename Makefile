# Vortex GTA 5 extension - build / lint / test / package
#
# `make lint`, `make test`, `make build` are the entry points. `make package`
# produces the Vortex-installable archive (.zip by default; `make package-7z`
# for .7z).

NPM := npm

.DEFAULT_GOAL := build

.PHONY: all install build lint typecheck test package package-7z clean dev help

all: lint build ## lint then build

install: ## install dependencies
	$(NPM) install --legacy-peer-deps

build: ## compile the extension to dist/
	$(NPM) run build

lint: typecheck ## static checks (TypeScript type-check)

typecheck: ## type-check without emitting
	$(NPM) run typecheck

test: ## compile and run unit tests (node:test)
	$(NPM) test

package: build ## build + produce a .zip for Vortex's "Drop File(s)"
	$(NPM) run package

package-7z: build ## build + produce a .7z instead of .zip
	$(NPM) run package:7z

dev: ## rebuild on change (webpack watch)
	$(NPM) run webpack -- --watch

clean: ## remove build output and archives
	@node -e "const fs=require('fs');['dist','.test-build'].forEach(d=>fs.rmSync(d,{recursive:true,force:true}));fs.readdirSync('.').filter(f=>/\.(zip|7z)$$/.test(f)).forEach(f=>fs.rmSync(f,{force:true}));"
	@echo "cleaned dist/, .test-build/ and archives"

help: ## list targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
