# dev

My development tool. It helps with creating new projects from a template, managing the configuration of those projects, and more!

## TODO

**Features**
- prefix by-ecosystem, etc. with numbers (even if it is require hardcoded). Check for other number prefixes and error so I don't "wonder why its not working"
- find better way to manage "dependent errors". For example "readme has incorrect contents" should not stop "package.json linting". Single boolean for "everything else depends on this failing rule" or string for "ignore everything that depends on this"

- `start-dev-server`

**Linting**
- changelog
- lefthook
- `npm-package-json-lint`
- packageJson
  - accurate license (read file system)
  - accurate description (read from github?)
- packageJson.bin alphabetical if object
- Remove reading of `project.toml`, etc. `foxxo.toml` (`fox-dev.toml`)
- flag to enable-disable certain checks during development
