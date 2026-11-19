# Catalog

# Catalog

This is an organized list of all my bookmarks.

## Browse with Hugo

The website build, scripts, and service config live in `~/.dev/modules/catalog`; see its README. This directory only holds the raw Markdown.

To add to it, follow these steps:

1. Backup bookmarks. Try to export as "Firefox Bookmarks .json" format. Otherwise, export it as HTML, then convert it to JSON using Firefox.
2. Use `parse_bookmarks.ts` like so: ~/.dev/modules/catalog/scripts/parse_bookmarks.ts ./bookmarks.json 'To Organize' > bookmarks.md
3. Organize it.

## What resources are here?

Both conceptual resources and practical tools are listed in this catalog.

This resource list leans heavily into "free or open-source Linux software".

If it's high-quality, Windows and MacOS resources should still be listed. Paid sources are shown if they are very popular or by a person, small company, or workers co-op.

## Tagging

There are two types of tags: concept tags and context tags. Concept tags are self-explanatory and context tags are sorted by the process that you may be doing.

## Common Headings

These should be used later to create a "virtual view".

- Blogs & Opinions
- A11Y
- Content Creators
- Books
- Textbooks
- Standards & Specifications
- All other categories
- Interviews
- News
- Formatting
- Linting
- Static Analysis
- Conferences
- Outdated
- Fun

## common things

- The ... Fiasco
- Falsehoods about ...
- ... considered harmful

Builds my bookmark catalog into a website with [Hugo](https://gohugo.io/) v0.158+.

- **Markdown**: `~/Documents/Knowledge/Catalog` (only the raw Markdown lives there; override with `CATALOG_CONTENT_DIR` if it lives elsewhere). Each top-level directory is mounted into the site by the `[module]` mounts in `hugo.toml`. When adding a new top-level directory, add a mount for it there and an entry in `data/directory_order.yaml`.
- **Output**: `~/.dev/.data/catalog-output`. Both `bake build` and the dev server write here.

`hugo.toml` contains an `@CATALOG_CONTENT_DIR@` placeholder instead of a machine-specific absolute path. Each bake task renders it into the gitignored `config/hugo.generated.toml` before invoking Hugo, and passes that file with `--config`. Run the site through `bake` (including the user service) so this step is not skipped.

```sh
bake hugo            # serve with live reload
bake build           # build to ~/.dev/.data/catalog-output
bake commit          # commit the Markdown repository, using today's date as the message
```

The theme is the [hugo-catalog](https://github.com/hyperupcall-projects/hugo-catalog) git submodule in `themes/hugo-catalog` (based on the [Book theme](https://github.com/alex-shpak/hugo-book)). After cloning, run `git submodule update --init`. It ships plain CSS, so the extended Hugo binary and Dart Sass are not needed.

## Run as a user service

`bake service-install` renders `config/catalog.service` from `config/catalog.service.in`, symlinks it into `~/.config/systemd/user/`, then enables and (re)starts it. It serves on port 6006 by default.

```sh
bake service-install          # port 6006
bake service-install 8080     # custom port
PORT=8080 bake service-install
bake service-uninstall        # stop, disable, and remove
```

## Scripts

These run from the Markdown directory, so relative paths are resolved from there.

```sh
bake search-duplicates-all [--fix] [paths...]        # links duplicated across the catalog
bake search-duplicates <original_file> [paths...]    # links in a file that are already in the catalog
bake organize-headings [--dry-run] <file-or-directory>  # requires deno on PATH
./scripts/parse_bookmarks.ts ./bookmarks.json 'To Organize' > bookmarks.md
```
