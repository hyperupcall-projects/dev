# dev — Documentation

`dev` is a personal development tool. It can:

- create new projects from templates (`dev new`)
- lint a project and fix the configuration it finds wrong (`dev lint`)
- bump a project's version, then commit and tag it (`dev version`)
- manage many repositories, changelogs and maintenance tasks (`dev repos`, `dev changelog`, `dev task`)
- run a local web dashboard (`dev start-dev-server`)

You can change how a project is linted and versioned by adding a **`dev.toml`** file at the project's root. See [The `dev.toml` file](#the-devtoml-file).

---

## Running the tool

The entry point is `bin/dev.ts`, a [Clipanion](https://github.com/arcanis/clipanion) CLI. It runs on Node.js directly, with no build step:

```sh
node --run cli -- <command> [args]   # from this repository
dev <command> [args]                 # if `dev` is on your PATH
```

Every command except `start-dev-server` accepts this option:

| Option         | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `--dir <path>` | Run as if `dev` had been started in `<path>`. It changes the working directory first. |

`dev help` lists all commands.

### Other package scripts

| Script                | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `node --run dev`      | Run the dev server in watch mode                |
| `node --run start`    | Run the dev server                              |
| `node --run lint`     | Lint this repository                            |
| `node --run format`   | Format this repository                          |
| `node --run typecheck`| Run `tsc` type checking                         |

---

## Commands

### `dev new [dir] [ecosystem] [template-name] [project-name]`

Creates a new project from a template.

1. If `dir` is missing, it asks for a directory. It offers to create the directory if it doesn't exist.
2. If `ecosystem` is missing, it asks you to pick one. Only ecosystems that have templates are listed.
3. If `template-name` is missing, it asks you to pick a template for that ecosystem.
4. If `project-name` is missing, it asks for one.
5. It copies `config/templates/<ecosystem>/<ecosystem>-<template>/` into the target directory, rendering every file with [Handlebars](https://handlebarsjs.com). It skips `node_modules` and `__pycache__`.

Options:

- `--force`: use the directory even if it isn't empty. Without it, the directory must be empty.
- `options`: a comma-separated list of extra template options.

Templates you can pick from `dev new`:

| Ecosystem | Templates                                   |
| --------- | ------------------------------------------- |
| `nodejs`  | `hello-world`, `cli`, `web-server-express`  |
| `deno`    | `webframework`                              |
| `cpp`     | `cmake`, `hello-world`, `playground`        |
| `rust`    | `hello-world`, `cli`, `gui`                 |
| `go`      | `hello-world`, `cli`, `web-server`          |

`config/templates/` also contains template directories for `c`, `html`, `java`, `php`, `python` and `webext`. Not every template listed above has a directory yet.

### `dev lint [dir] [--yes] [--strict]`

Checks the current project (or `dir`) against a set of **lint rules**. For each problem it finds, it offers to fix it.

| Option     | Description                                                       |
| ---------- | ----------------------------------------------------------------- |
| `--yes`    | Apply every fix without asking                                    |
| `--strict` | Also run checks marked as *strict*. These are skipped by default. |

`--match`, `--only` and `--exclude` are parsed but have no effect yet.

What `dev lint` does:

1. **Finds the project type**:
   - `only-directory`: there is no `.git`.
   - `under-version-control`: there is a `.git`, but the current branch has no remote.
   - `with-remote-url`: there is a remote. The owner and name are read from the remote URL.
2. **Loads `dev.toml`** from the project root, if there is one (see below).
3. **Updates editor settings**:
   - If `.vscode/settings.json` exists, it sets `window.title` to your default title with the ecosystem name added, then merges in `config/vscode-config.jsonc`.
   - If `.zed/settings.json` exists, it merges in `config/zed-config.jsonc`.
4. **Collects rule files** from `config/lint-rules/`:
   - `100-directory/*`: always.
   - `200-version-control/*`: if the project uses git.
   - `300-remote-url/*`: if the project has a remote.
   - `400-ecosystem/_/*`: always.
   - `400-ecosystem/<ecosystem>/*`: for each detected ecosystem.
   - `500-name/<owner>/_/*` and `500-name/<owner>/<name>/*`: if the project has a remote.

   If two rule files have the same base name (ignoring the numeric prefix), only the one collected later is kept. More specific rules therefore replace general ones.
5. **Runs each rule file** and prints `PASS`, `SKIP`, `FAIL` or `QUES` (a problem was found and it asks whether to fix it). A problem with no fix function counts as `FAIL`. Any `FAIL` makes the command exit with code 1.

### `dev version`

Bumps the project's version, then creates a release commit and tag.

1. Stops if the git working tree has uncommitted changes.
2. Reads the newest `v*` tag. If there are none, it asks for a starting version (default `0.1.0`).
3. Asks for the new version: patch, minor, major, or a custom semver. A custom version must be higher than the current one.
4. Writes the new version into the version files of every ecosystem detected at the root (see the table below).
5. Does the same for every directory listed in `updateVersionDirectories` in `dev.toml`.
6. Runs `git add` on the changed files, commits with message `vX.Y.Z` (an empty commit if nothing changed), and creates an annotated tag `vX.Y.Z`.
7. Shows the push command (`git push && git push --tags`) but doesn't run it.

It only changes versions that are already written in a file. If a file has no version field, or the version isn't a literal value, the file is left as it is. TOML files are edited with `utilities/mergetoml.py`, which keeps comments and formatting.

### `dev repos <subcommand>`

Manages repositories across GitHub accounts and organizations. Subcommands: `fetch-repository-data`, `tui`, `sync` and `run`. Requires the private config described below.

### `dev changelog pull`

Pulls changelog information for the current git repository using the GitHub API.

### `dev task <task>`

Runs a maintenance task across your repositories:

- `check-license-headers`
- `symlink-hidden-dirs`
- `validate-hyperupcall-archives`
- `create-vscode-launchers`
- `toggletools`

### `dev start-dev-server`

Starts the local web dashboard in `devserver/`, built with Hono. It listens on `PORT`, or `3000` if `PORT` isn't set. Pages include the project manager, workspaces, services, blocklists, dictionary, and open file/directory.

### `dev call get-ecosystems [directory]`

Prints the IDs of the ecosystems detected in a directory, one per line.

---

## Ecosystems

Code: `utilities/ecosystems.ts`. An ecosystem defines four things: how to detect it, which lint rule files apply to it, how to update its version, and (optionally) its templates. A project can match more than one ecosystem.

| ID                 | Detected when                                              | Version updated in                                                        |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| `nodejs`           | `package.json` exists                                      | `package.json`                                                            |
| `vscode-extension` | `package.json` has a `displayName` field                   | `package.json`                                                            |
| `deno`             | `deno.json` or `deno.jsonc` exists                         | `deno.json` / `deno.jsonc`                                                |
| `c`                | `*.c` files exist, or `CMakeLists.txt` declares `C`        | First matching file: `CMakeLists.txt`, `configure.ac`/`.in`, `meson.build`, `GNUmakefile`/`Makefile`/`makefile` |
| `cpp`              | `CMakeLists.txt` declares `CXX`                            | Same as `c`                                                               |
| `python`           | `pyproject.toml` or top-level `*.py` files exist           | `pyproject.toml`, `setup.cfg` or `setup.py`                               |
| `bash`             | `basalt.toml` exists                                       | `basalt.toml` (`[package].version`)                                       |
| `woof-plugin`      | `manifest.ini` and `tools` both exist                      | `manifest.ini`                                                            |
| `zed-extension`    | `extension.toml` exists                                    | `extension.toml` (top-level `version`)                                    |
| `java`             | `gradlew`, `build.gradle` or `build.gradle.kts` exists     | `gradle.properties`, `build.gradle{,.kts}`, `pom.xml`                     |
| `rust`             | `Cargo.toml` exists                                        | `Cargo.toml` (`[package].version`), plus the root package's entry in `Cargo.lock` |
| `webext`           | `manifest.json` has a `manifest_version` key               | `manifest.json`                                                           |
| `go`               | `go.mod` or `*.go` files exist                             | `VERSION` file, if it exists (Go module versions come from git tags)      |

---

## The `dev.toml` file

`dev.toml` is an **optional, per-project** config file. It goes in the project's **root directory**, which is the directory `dev` runs in, set by `--dir` or by the positional `dir` argument of `dev lint`.

- The file is parsed as TOML with [`smol-toml`](https://github.com/squirrelchat/smol-toml).
- If the file is missing, defaults are used. If it exists but isn't valid TOML, the command fails with an error.
- Two commands read it: **`dev lint`** and **`dev version`**.
- The name must be `dev.toml`. The `directory/no-files` lint rule reports the old name `project.toml` and offers to rename it to `dev.toml`.

### Schema

The type is `Config` in `types.d.ts`:

```ts
type Config = {
	rules?: Record<string, 'off'>
	updateVersionDirectories?: string[]
}
```

Both keys are optional. Other keys are ignored.

### `[rules]`

Used by `dev lint`. Turns off individual lint checks.

```toml
[rules]
'version-control/project-name/local-remote-name-mismatch' = "off"
'remote-url/license/must-have-license-file' = "off"
```

- **Keys** are rule IDs in the form `<category>/<rule-name>/<issue-id>` (see below). Quote them, because they contain `/`.
- **Values**: only `"off"` does anything. A turned-off check prints `SKIP`, and the next check runs. Any other value is ignored, and the check runs normally.
- Your `[rules]` table is deep-merged (lodash `merge`) over the built-in defaults, so your values take priority. The only built-in default: for `awesome-lists/awesome-bash`, `remote-url/remote-metadata/disable-projects-tab` and `remote-url/remote-metadata/default-branch-main` are off.

#### How rule IDs are built

For a rule file at `config/lint-rules/<…>/<parent-dir>/<NN-file>.ts` that reports an issue with `id: '<issue-id>'`:

```
<parent-dir>/<file>/<issue-id>
```

All `NN-` numeric prefixes are removed. Examples:

| Rule file                                           | Issue ID                       | `dev.toml` key                                                      |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `200-version-control/10-project-name.ts`            | `local-remote-name-mismatch`   | `version-control/project-name/local-remote-name-mismatch`           |
| `300-remote-url/30-license.ts`                      | `must-have-license-file`       | `remote-url/license/must-have-license-file`                         |
| `400-ecosystem/woof-plugin/woof.ts`                 | `name-mismatch`                | `woof-plugin/woof/name-mismatch`                                    |

Only the **direct parent directory** is part of the ID. For example, rules in `400-ecosystem/_/` get IDs starting with `_/`, and `500-name/_/.github/readme.ts` gets IDs starting with `.github/readme`.

**Only issues that have an `id` can be turned off.** Issues without an `id` can't be turned off from `dev.toml`. You can still decline their fix at the prompt.

#### Rule IDs you can turn off

| Key                                                                  | What it checks                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| `version-control/project-name/local-remote-name-mismatch`            | Local directory name matches the remote repository name |
| `version-control/readme/must-exist`                                  | Exactly one readme file exists                         |
| `version-control/readme/must-be-uppercase`                           | Readme file name is uppercase (`README.md`)            |
| `version-control/readme/must-have-matching-title`                    | Readme title matches the expected title                |
| `version-control/readme/must-have-title-that-includes-project-name`  | Readme title includes the project name                 |
| `remote-url/remote-metadata/disable-projects-tab`                    | GitHub "Projects" tab is turned off                    |
| `remote-url/remote-metadata/default-branch-main`                     | Default branch is `main`                               |
| `remote-url/license/must-have-license-file`                          | A license file exists                                  |
| `remote-url/license/must-have-correct-contents`                      | License file has the expected contents                 |
| `woof-plugin/woof/name-mismatch`                                     | Woof plugin name is consistent                         |
| `woof-plugin/woof/description-mismatch`                              | Woof plugin description is consistent                  |

To find more IDs, search `config/lint-rules/` for `id:`.

### `updateVersionDirectories`

Used by `dev version`. A list of **subdirectories, relative to the project root**, whose version files are updated along with the root's.

```toml
updateVersionDirectories = ["packages/cli", "editors/vscode"]
```

`dev version` runs ecosystem detection separately in each listed directory. It updates the version files of whatever ecosystems it finds there and adds those files to the release commit.

Use this in monorepos, or when a project bundles a package from a different ecosystem. For example, a Rust tool with a VS Code extension in `editors/vscode/`.

- Put this key at the top level of the file, **before** any `[table]` header. TOML puts keys written after a header inside that table.
- If a listed directory matches no ecosystem, nothing in it changes.
- If the key is missing, only the project root is updated.

### Full example

```toml
# Top-level keys must come before any [table].
updateVersionDirectories = ["editors/vscode"]

[rules]
'version-control/project-name/local-remote-name-mismatch' = "off"
'remote-url/remote-metadata/default-branch-main' = "off"
```

---

## Private global config (`dev.config.js`)

This is separate from `dev.toml`. Commands that work across many repositories (`repos`, `task`, and the dev server) read a private, machine-wide config:

- Path: `~/.devhidden/configs/dev.config.js`, or the path in the `DEV_CONFIG` environment variable.
- It must be an ES module with `export default { ... }`.
- Any string that starts with `~/` is expanded to an absolute path.
- Required keys: `paths` (object), `pinnedProjects` (array), `knowledgeFolders` (array of `{ id, name, path }`), `binaries` (object with `obsidian` and `clion` command arrays). Optional: `githubTokenFile`.
- Print one resolved value: `node utilities/print-dev-config.mjs paths.nodeBinary`.

The full type is `DevConfig` in `utilities/dev-config.ts`.

### Environment variables

| Variable            | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `GITHUB_AUTH_TOKEN` | GitHub token, usually set in `.env` (see `.env.example`). `githubTokenFile` takes priority over it. |
| `DEV_CONFIG`        | Another path for the private config                                     |
| `PORT`              | Dev server port (default `3000`)                                        |

---

## Adding to the tool

### Writing a lint rule

Create a `.ts` file under the right `config/lint-rules/` category. It must export `issues`, an async generator of type `Issues`:

```ts
import type { Issues } from '#types'

export const issues: Issues = async function* issues({ project }) {
	yield {
		id: 'some-check',            // optional; needed so it can be turned off in dev.toml
		message: ['What is wrong', 'Why'],
		fix: async () => { /* ... */ }, // optional; without it the check counts as FAIL
		strict: false,               // if true, it only runs with --strict
		// skip: 'reason',           // yield this to skip the rest of the file
	}
}
```

Export `skip` from the module to turn off the whole file. To have a file replace a more general one, give it the same base name in a more specific directory.

### Adding an ecosystem

Add an entry to `ecosystems` in `utilities/ecosystems.ts` with `label`, `ecosystemInDir`, `lintFileGlobs` and `updateVersion`. You can also add `templates` and `vscodePackId`. If you add templates, put them in `config/templates/<id>/<id>-<template>/`.

---

## Repository layout

| Path                     | Contents                                                   |
| ------------------------ | ---------------------------------------------------------- |
| `bin/dev.ts`             | CLI entry point and command definitions                    |
| `commands/`              | Code for each command                                      |
| `utilities/`             | Ecosystem definitions, filetype detection, private config loader, TOML merge helper (`mergetoml.py`), repository helpers |
| `config/lint-rules/`     | Lint rule files, grouped by category                       |
| `config/templates/`      | Project templates for `dev new`                            |
| `config/*`               | Shared config files that rules copy into projects (EditorConfig, clang-format, yamllint, …) |
| `devserver/`             | Web dashboard (Hono)                                       |
| `types.d.ts`             | Shared types, including `Config` (the `dev.toml` schema)   |
| `dev.toml`               | This repository's own `dev.toml`                           |
