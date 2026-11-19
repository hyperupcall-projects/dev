# shellcheck shell=bash

# The raw Markdown lives outside of this repository. Override this variable in
# the environment if your catalog lives elsewhere.
CATALOG_CONTENT_DIR="${CATALOG_CONTENT_DIR:-${HOME}/Documents/Knowledge/Catalog}"
case "$CATALOG_CONTENT_DIR" in
	'~/'*) CATALOG_CONTENT_DIR="${HOME}/${CATALOG_CONTENT_DIR#'~/'}" ;;
	'~') CATALOG_CONTENT_DIR="$HOME" ;;
esac

# Hugo will not resolve relative mount sources that escape the project root, so
# render a local config with the absolute path. The result is gitignored.
task.generate-hugo-config() {
	if [ ! -d "$CATALOG_CONTENT_DIR" ]; then
		bake.die "Catalog content directory not found: $CATALOG_CONTENT_DIR"
	fi

	sed "s|@CATALOG_CONTENT_DIR@|${CATALOG_CONTENT_DIR}|g" \
		"$BAKE_ROOT/hugo.toml" > "$BAKE_ROOT/config/hugo.generated.toml"
}

# doc: Build the site to ~/.dev/.data/catalog-output
task.build() {
	task.generate-hugo-config
	task.hugo-build
}

# doc: Serve the site locally with live reload
task.hugo() {
	task.generate-hugo-config
	hugo server --config "$BAKE_ROOT/config/hugo.generated.toml"
}

# doc: Build the site to ~/.dev/.data/catalog-output
task.hugo-build() {
	task.generate-hugo-config
	hugo --config "$BAKE_ROOT/config/hugo.generated.toml" --minify --cleanDestinationDir
}

# doc: Commit changes to the Markdown repository, using the date as the message
task.commit() {
	local date=
	date=$(date '+%Y-%m-%d')
	git -C "$CATALOG_CONTENT_DIR" commit -m "$date" "$@"
}

# doc: Find links in a source file that are duplicated in the catalog
task.search-duplicates() {
	cd "$CATALOG_CONTENT_DIR" || bake.die "Failed to cd to $CATALOG_CONTENT_DIR"
	"$BAKE_ROOT/scripts/search_duplicates.ts" "$@"
}

# doc: Find links duplicated across the catalog
task.search-duplicates-all() {
	cd "$CATALOG_CONTENT_DIR" || bake.die "Failed to cd to $CATALOG_CONTENT_DIR"
	"$BAKE_ROOT/scripts/search_duplicates_all.ts" "$@"
}

# doc: Organize the headings of a Markdown file or directory in the catalog
task.organize-headings() {
	cd "$CATALOG_CONTENT_DIR" || bake.die "Failed to cd to $CATALOG_CONTENT_DIR"
	deno run --allow-read --allow-write "$BAKE_ROOT/organize_headings.ts" "$@"
}

# doc: Install and start catalog.service (systemd user unit) on PORT (default 6006)
task.service-install() {
	local port="${1:-${PORT:-6006}}"
	local service_name='catalog'
	local unit_dir="$HOME/.config/systemd/user"
	local unit_file="$unit_dir/$service_name.service"
	local rendered="$BAKE_ROOT/config/$service_name.service"
	local template="$BAKE_ROOT/config/$service_name.service.in"

	local hugo=
	hugo=$(command -v hugo) || bake.die "hugo not found on PATH; install Hugo first"

	task.generate-hugo-config

	local exec_start="$hugo server --config \"$BAKE_ROOT/config/hugo.generated.toml\" --bind 127.0.0.1 --port $port --disableBrowserError --noHTTPCache"

	mkdir -p "$unit_dir"
	sed \
		-e "s|@@USER@@@|$(id -un)|g" \
		-e "s|@@PORT@@@|$port|g" \
		-e "s|@@WORKING_DIRECTORY@@@|$BAKE_ROOT|g" \
		-e "s|@@EXEC_START@@@|$exec_start|g" \
		-e "s|@@DESCRIPTION@@@|Hugo Catalog site|g" \
		"$template" > "$rendered"
	ln -sfn "$rendered" "$unit_file"

	systemctl --user daemon-reload
	systemctl --user enable "$service_name.service"
	systemctl --user restart "$service_name.service"
	bake.info "Installed and started $service_name.service (port $port)"
}

# doc: Stop, disable, and remove the catalog.service systemd user unit
task.service-uninstall() {
	local service_name='catalog'
	local unit_dir="$HOME/.config/systemd/user"

	systemctl --user disable --now "$service_name.service" 2>/dev/null || true
	rm -f "$unit_dir/$service_name.service"
	systemctl --user daemon-reload
	bake.info "Removed $service_name.service"
}
