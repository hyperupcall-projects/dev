#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import fs from 'node:fs/promises'
import path from 'node:path'

import { Cli, Command, Option, Builtins } from 'clipanion'

import { run as runNew } from '../commands/new.ts'
import { run as runFix } from '../commands/lint.ts'
import { run as runInstall, cleanupTerminal } from '../commands/install.ts'
import { run as runRepos } from '../commands/repos.ts'
import { run as runTask } from '../commands/task.ts'
import { startServer } from '../devserver/start.ts'

/**
 * @import { PackageJson } from "type-fest";
 */

/** @type {PackageJson} */
const packageJson = JSON.parse(
	await fs.readFile(path.join(import.meta.dirname, '../package.json'), 'utf-8'),
)

const cli = new Cli({
	binaryLabel: 'dev',
	binaryName: 'dev',
	binaryVersion: packageJson.version,
	enableCapture: false,
})

cli.register(
	class NewCommand extends Command {
		static paths = [[`new`]]
		static usage = Command.Usage({
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
		static paths = [[`lint`]]
		static usage = Command.Usage({
			description: `Lint and fix issues with code`,
		})

		yes = Option.Boolean('--yes')
		match = Option.Array('match')
		only = Option.Array('only')
		exclude = Option.Array('exclude')
		positionals = Option.Proxy()

		async execute() {
			await runFix(
				{
					yes: this.yes,
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
	class InstallCommand extends Command {
		static paths = [[`install`]]
		static usage = Command.Usage({
			description: `Install or update a program through the TUI`,
		})

		positionals = Option.Proxy()

		async execute() {
			await runInstall({}, this.positionals)
		}

		async catch(/** @type {unknown} */ error) {
			globalThis.skipTerminalCleanup = true
			cleanupTerminal()
			console.error(error)
		}
	},
)
cli.register(
	class ReposCommand extends Command {
		static paths = [[`repos`]]
		static usage = Command.Usage({
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
		static paths = [[`task`]]
		static usage = Command.Usage({
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
		static paths = [[`start-dev-server`]]
		static usage = Command.Usage({
			description: `Start the global development server`,
		})

		prebundle = Option.Boolean('--prebundle')
		positionals = Option.Proxy()

		async execute() {
			await startServer()
		}
	},
)
cli.register(Builtins.HelpCommand)

cli.runExit(process.argv.slice(2))
