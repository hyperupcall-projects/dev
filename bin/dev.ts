#!/usr/bin/env node
import { Builtins, Cli, Command, Option, UsageError } from 'clipanion'

import { run as runNew } from '../commands/new.ts'
import { run as runFix } from '../commands/lint.ts'
import { run as runVersion } from '../commands/version.ts'

import { run as runRepos } from '../commands/repos.ts'
import { run as runChangelog } from '../commands/changelog.ts'
import { run as runTask } from '../commands/task.ts'
import { execa } from 'execa'
import path from 'node:path'
import process from 'node:process'
import { detectEcosystem } from '#utilities/ecosystems.ts'

const version = '0.4.0' // TODO

const cli = new Cli({
	binaryLabel: 'dev',
	binaryName: 'dev',
	binaryVersion: version,
	enableCapture: false,
})

abstract class DevCommand extends Command {
	dir = Option.String('--dir', {
		description: 'Run as if dev was started in this directory',
	})

	// Changing the working directory makes the command (and subprocesses) operate there.
	protected maybeChangeDir() {
		if (!this.dir) {
			return
		}

		try {
			process.chdir(this.dir)
		} catch {
			throw new UsageError(`Cannot change to directory: ${this.dir}`)
		}
	}
}

cli.register(
	class NewCommand extends DevCommand {
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
			this.maybeChangeDir()
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
	class LintCommand extends DevCommand {
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
			this.maybeChangeDir()
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
	class ReposCommand extends DevCommand {
		static override paths = [[`repos`]]
		static override usage = Command.Usage({
			description: `Manage repositories`,
		})

		positionals = Option.Proxy()

		async execute() {
			this.maybeChangeDir()
			await runRepos({}, this.positionals)
		}
	},
)
cli.register(
	class ChangelogCommand extends DevCommand {
		static override paths = [[`changelog`]]
		static override usage = Command.Usage({
			description: `Manage changelog for repository`,
		})

		positionals = Option.Proxy()

		async execute() {
			this.maybeChangeDir()
			await runChangelog({}, this.positionals)
		}
	},
)
cli.register(
	class ScriptCommand extends DevCommand {
		static override paths = [[`task`]]
		static override usage = Command.Usage({
			description: `Run a task`,
		})

		positionals = Option.Proxy()

		async execute() {
			this.maybeChangeDir()
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

		async execute() {
			await execa('node', ['--run', 'start'], {
				stdio: 'inherit',
				cwd: path.join(import.meta.dirname, '..'),
			})
		}
	},
)
cli.register(
	class VersionCommand extends DevCommand {
		static override paths = [[`version`]]
		static override usage = Command.Usage({
			description: `Manage project versioning`,
		})

		positionals = Option.Proxy()

		async execute() {
			this.maybeChangeDir()
			await runVersion({}, this.positionals)
		}
	},
)
cli.register(
	class GetEcosystemsCommand extends DevCommand {
		static override paths = [['call', 'get-ecosystems']]

		directory = Option.String({ required: false })

		async execute() {
			this.maybeChangeDir()
			const ecosystemIds = await detectEcosystem({
				rootDir: this.directory ?? process.cwd(),
			})
			for (const ecosystemId of ecosystemIds) {
				this.context.stdout.write(`${ecosystemId}\n`)
			}
		}
	},
)
cli.register(Builtins.HelpCommand)

cli.runExit(process.argv.slice(2))
