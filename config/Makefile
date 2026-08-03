SERVICE_NAME := dev
PORT ?= 40000
USER ?= $(shell whoami)
WORKING_DIRECTORY := $(abspath ..)
REPO_ROOT := $(abspath ..)
PRINT_CONFIG := node "$(REPO_ROOT)/utilities/print-dev-config.mjs"
NODE_BINARY := $(shell $(PRINT_CONFIG) paths.nodeBinary)
EXEC_START := $(NODE_BINARY) --run start
DESCRIPTION := Edwin Central Dev Server
UNIT_DIR := $(HOME)/.config/systemd/user
SERVICE_LIST_DIR := $(shell $(PRINT_CONFIG) paths.serviceListDir)
SERVICE_FILE := $(abspath $(SERVICE_NAME).service)

.PHONY: install
install:
	@mkdir -p "$(UNIT_DIR)" "$(SERVICE_LIST_DIR)"
	sed \
		-e 's|@@USER@@@|$(USER)|g' \
		-e 's|@@PORT@@@|$(PORT)|g' \
		-e 's|@@WORKING_DIRECTORY@@@|$(WORKING_DIRECTORY)|g' \
		-e 's|@@EXEC_START@@@|$(EXEC_START)|g' \
		-e 's|@@DESCRIPTION@@@|$(DESCRIPTION)|g' \
		$(SERVICE_NAME).service.in > "$(SERVICE_NAME).service"
	ln -sfn "$(SERVICE_FILE)" "$(UNIT_DIR)/$(SERVICE_NAME).service"
	@touch "$(SERVICE_LIST_DIR)/$(SERVICE_NAME).ini"
	@echo "Wrote $(SERVICE_FILE)"
	@echo "Symlinked $(UNIT_DIR)/$(SERVICE_NAME).service -> $(SERVICE_FILE)"
	@echo "Registered $(SERVICE_LIST_DIR)/$(SERVICE_NAME).ini"
	@echo "Run: systemctl --user daemon-reload && systemctl --user enable --now $(SERVICE_NAME).service"
