
Tools like [EditorConfig](https://editorconfig.org), [ESLint](https://eslint.org), and [Stylelint](https://stylelint.io) require configuration. Managing configuration by hand can be time consuming and error-prone.

This tools automates that.

## Terminology

Repository called 'fix'

Has:

- Matchers
- Group
- Rules

- green: already fixed or fixed
- yellow: manually skip
- cyan: automatic skip

## History

### First Approach

[Glue](https://github.com/hyperupcall/glue) was my first solution, written in Bash. It had some problems:

It was a task runner and a configuration manager.

- I thought this would make things more simple, but increased complexity
  - For example, supposedly-general-enough "tasks" would often need to be overridden on a per-repository basis
- To fix this I created [Bake](https://github.com/hyperupcall/bake), written in Bash, that only handles "task" running

I wrote it in Bash.

- Justification was that Bash is highly portable (if carefully written) and terse
  - Stupid
- I created [Basalt](https://github.com/hyperupcall/basalt), a Bash package manager, because I thought it would help me separate logic (and reuse it in other projects)

Writing it in Bash was so stupid I abandoned this approach.

### Second Approach

I named this project 'foxxy', rewritten in Deno, a scripting language. Then I rewrote it in Rust. Then I changed the name to [repo](https://github.com/fox-archives/repo).

The cons of this approach is painfully obvious:

- At the time, the Deno ecosystem had fewer libraries to choose from and features to use
- Rust is not a good scripting language

### Third Approach

I started from scratch again, this time using Node.js. It's easy and fast (enough).
