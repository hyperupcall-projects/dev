#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { Cli, Command, Option, Builtins } from 'clipanion'

import { run as runNew } from '../src/new.js'
import { run as runFix } from '../src/fix.js'
import { run as runInstall, cleanupTerminal } from '../src/install.js'
import { run as runRepos } from '../src/repos.js'
import { run as runScript } from '../src/script.js'
import { run as runStartServer } from '../src/start-server.js'

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
	class FixCommand extends Command {
		static paths = [[`fix`]]
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
			description: `Install a program through a TUI`,
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
		static paths = [[`script`]]
		static usage = Command.Usage({
			description: `Execute a script`,
		})

		positionals = Option.Proxy()

		async execute() {
			await runScript({}, this.positionals)
		}
	},
)
cli.register(
	class StartServer extends Command {
		static paths = [[`start-server`]]
		static usage = Command.Usage({
			description: `Start the server`,
		})

		positionals = Option.Proxy()

		async execute() {
			await runStartServer({}, this.positionals)
		}
	},
)
cli.register(Builtins.HelpCommand)

cli.runExit(process.argv.slice(2), {})
