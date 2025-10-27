#!/usr/bin/env -S deno run --allow-all
import { Builtins, Cli, Command, Option } from 'clipanion'

import { run as runNew } from '../commands/new.ts'
import { run as runFix } from '../commands/lint.ts'

import { run as runRepos } from '../commands/repos.ts'
import { run as runTask } from '../commands/task.ts'
import { startServer } from '../devserver/webframework/webframework.ts'
import process from 'node:process'

const version = '0.4.0' // TODO

const cli = new Cli({
	binaryLabel: 'dev',
	binaryName: 'dev',
	binaryVersion: version,
	enableCapture: false,
})

cli.register(
	class NewCommand extends Command {
		static override paths = [[`new`]]
		static override usage = Command.Usage({
			description: `Create a new project`,
		})

		ecosystem = Option.String({ required: false })
		'template-name' = Option.String({ required: false })
		'project-name' = Option.String({ required: false })
		force = Option.Boolean('--force')
		options = Option.String({ required: false })
		positionals = Option.Proxy()

		async execute() {
			await runNew(
				{
					ecosystem: this.ecosystem,
					templateName: this['template-name'],
					projectName: this['project-name'],
					force: this.force,
					options: this.options,
				},
				this.positionals,
			)
		}
	},
)
cli.register(
	class LintCommand extends Command {
		static override paths = [[`lint`]]
		static override usage = Command.Usage({
			description: `Lint and fix issues with code`,
		})

		yes = Option.Boolean('--yes')
		strict = Option.Boolean('--strict')
		match = Option.Array('match')
		only = Option.Array('only')
		exclude = Option.Array('exclude')
		positionals = Option.Proxy()

		async execute() {
			await runFix(
				{
					yes: this.yes,
					strict: this.strict,
					match: this.match,
					only: this.only,
					exclude: this.exclude,
				},
				this.positionals,
			)
		}
	},
)

cli.register(
	class ReposCommand extends Command {
		static override paths = [[`repos`]]
		static override usage = Command.Usage({
			description: `Manage repositories`,
		})

		positionals = Option.Proxy()

		async execute() {
			await runRepos({}, this.positionals)
		}
	},
)
cli.register(
	class ScriptCommand extends Command {
		static override paths = [[`task`]]
		static override usage = Command.Usage({
			description: `Run a task`,
		})

		positionals = Option.Proxy()

		async execute() {
			await runTask({}, this.positionals)
		}
	},
)
cli.register(
	class StartServer extends Command {
		static override paths = [[`start-dev-server`]]
		static override usage = Command.Usage({
			description: `Start the global development server`,
		})

		prebundle = Option.Boolean('--bundle')
		positionals = Option.Proxy()

		async execute() {
			startServer(this.positionals)
		}
	},
)
cli.register(Builtins.HelpCommand)

cli.runExit(process.argv.slice(2))
