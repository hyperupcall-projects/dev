SERVICE_NAME := catalog
PORT ?= 6006
USER ?= $(shell whoami)
CONFIG_DIR := $(abspath .)
WORKING_DIRECTORY := $(abspath ..)
HUGO := $(shell command -v hugo 2>/dev/null)
EXEC_START := $(HUGO) server --config $(WORKING_DIRECTORY)/config/hugo.generated.toml --bind 127.0.0.1 --port $(PORT) --disableBrowserError --noHTTPCache
DESCRIPTION := Hugo Catalog site
UNIT_DIR := $(HOME)/.config/systemd/user
SERVICE_LIST_DIR := $(HOME)/.devhidden/service-list
UNIT_FILE := $(CONFIG_DIR)/$(SERVICE_NAME).service

.PHONY: install```
install:
	@test -n "$(HUGO)" || (echo 'error: hugo not found on PATH; set HUGO=...' >&2; exit 1)
	@mkdir -p "$(UNIT_DIR)" "$(SERVICE_LIST_DIR)"
	@"$(WORKING_DIRECTORY)/bake" generate-hugo-config
	sed \
		-e 's|@@USER@@@|$(USER)|g' \
		-e 's|@@PORT@@@|$(PORT)|g' \
		-e 's|@@WORKING_DIRECTORY@@@|$(WORKING_DIRECTORY)|g' \
		-e 's|@@EXEC_START@@@|$(EXEC_START)|g' \
		-e 's|@@DESCRIPTION@@@|$(DESCRIPTION)|g' \
		$(SERVICE_NAME).service.in > "$(UNIT_FILE)"
	ln -sfn "$(UNIT_FILE)" "$(UNIT_DIR)/$(SERVICE_NAME).service"
	@touch "$(SERVICE_LIST_DIR)/$(SERVICE_NAME).ini"
	@echo "Rendered $(UNIT_FILE)"
	@echo "Symlinked $(UNIT_DIR)/$(SERVICE_NAME).service -> $(UNIT_FILE)"
	@echo "Registered $(SERVICE_LIST_DIR)/$(SERVICE_NAME).ini"
	@echo "Run: systemctl --user daemon-reload && systemctl --user enable --now $(SERVICE_NAME).service"
