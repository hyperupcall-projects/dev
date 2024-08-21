Tools like [EditorConfig](https://editorconfig.org), [ESLint](https://eslint.org), and [Stylelint](https://stylelint.io) require configuration. Managing configuration by hand can be time consuming and error-prone.

This tools automates that.

## Previous Approaches

I first wrote [Glue](https://github.com/hyperupcall/glue), a configuration manager and a task runner, in Bash. It had some issues:

- I thought this would make things more simple, but increased complexity
  - For example, supposedly-general-enough "tasks" would often need to be overridden on a per-repository basis
- To fix this I created [Bake](https://github.com/hyperupcall/bake), written in Bash, that only handles "task" running

I wrote it in Bash.

- Justification was that Bash is highly portable (if carefully written) and terse
  - Stupid
- I created [Basalt](https://github.com/hyperupcall/basalt), a Bash package manager, because I thought it would help me separate logic (and reuse it in other projects)

Writing it in Bash was so stupid I abandoned this approach.

Next, I wrote  [repo](https://github.com/fox-archives/repo) (originally called "foxxy"), a repository manager, in Rust (originally with Deno). It had some issues:

- At the time, the Deno ecosystem had fewer libraries to choose from and features to use
- Rust is not a good scripting language
