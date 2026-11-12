#!/usr/bin/env node
import { Builtins, Cli, Command, Option, UsageError } from 'clipanion'

import { run as runNew } from '../commands/new.ts'
import { run as runFix } from '../commands/lint.ts'
import { run as runVersion } from '../commands/version.ts'

import {
	runCommandInRepositories,
	runFetchRepositoryData,
	runRepositoriesTui,
	runSyncRepositories,
} from '../commands/repos.ts'
import {
	runPull as runChangelogPull,
	runValidate as runChangelogValidate,
} from '../commands/changelog.ts'
import {
	runCheckLicenseHeaders,
	runCreateVSCodeLaunchers,
	runSymlinkHiddenDirs,
	runToggleTools,
	runValidateHyperupcallArchives,
} from '../commands/task.ts'
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
	workingDir = Option.String('--dir', {
		description: 'Run as if dev was started in this directory',
	})

	// Changing the working directory makes the command (and subprocesses) operate there.
	protected maybeChangeDir() {
		if (!this.workingDir) {
			return
		}

		try {
			process.chdir(this.workingDir)
		} catch {
			throw new UsageError(`Cannot change to directory: ${this.workingDir}`)
		}
	}
}

cli.register(
	class NewCommand extends DevCommand {
		static override paths = [[`new`]]
		static override usage = Command.Usage({
			description: `Create a new project`,
		})

		dir = Option.String({ required: false })
		ecosystem = Option.String({ required: false })
		templateName = Option.String({ required: false })
		projectName = Option.String({ required: false })
		force = Option.Boolean('--force')
		options = Option.String('--options')

		async execute() {
			this.maybeChangeDir()
			await runNew({
				dir: this.dir,
				ecosystem: this.ecosystem,
				templateName: this.templateName,
				projectName: this.projectName,
				force: this.force,
				options: this.options,
			})
		}
	},
)
cli.register(
	class LintCommand extends DevCommand {
		static override paths = [[`lint`]]
		static override usage = Command.Usage({
			description: `Lint and fix issues with code`,
		})

		dir = Option.String({ required: false })
		yes = Option.Boolean('--yes')
		strict = Option.Boolean('--strict')
		match = Option.Array('--match')
		only = Option.Array('--only')
		exclude = Option.Array('--exclude')

		async execute() {
			this.maybeChangeDir()
			await runFix({
				dir: this.dir,
				yes: this.yes,
				strict: this.strict,
				match: this.match,
				only: this.only,
				exclude: this.exclude,
			})
		}
	},
)
cli.register(
	class ReposFetchRepositoryDataCommand extends DevCommand {
		static override paths = [[`repos`, `fetch-repository-data`]]
		static override usage = Command.Usage({
			description: `Fetch the list of repositories from GitHub`,
		})

		async execute() {
			this.maybeChangeDir()
			await runFetchRepositoryData()
		}
	},
)
cli.register(
	class ReposTuiCommand extends DevCommand {
		static override paths = [[`repos`, `tui`]]
		static override usage = Command.Usage({
			description: `Open a repository interactively`,
		})

		async execute() {
			this.maybeChangeDir()
			await runRepositoriesTui()
		}
	},
)
cli.register(
	class ReposSyncCommand extends DevCommand {
		static override paths = [[`repos`, `sync`]]
		static override usage = Command.Usage({
			description: `Synchronize the managed repositories`,
		})

		async execute() {
			this.maybeChangeDir()
			await runSyncRepositories()
		}
	},
)
cli.register(
	class ReposRunCommand extends DevCommand {
		static override paths = [[`repos`, `run`]]
		static override usage = Command.Usage({
			description: `Run a command in every managed repository`,
		})

		command = Option.String({ required: true })
		// Everything after the command name is forwarded to it verbatim.
		args = Option.Proxy()

		async execute() {
			this.maybeChangeDir()
			await runCommandInRepositories({
				command: this.command,
				args: this.args,
			})
		}
	},
)
cli.register(
	class ChangelogPullCommand extends DevCommand {
		static override paths = [[`changelog`, `pull`]]
		static override usage = Command.Usage({
			description: `Write CHANGELOG.md from the repository's GitHub releases`,
		})

		async execute() {
			this.maybeChangeDir()
			await runChangelogPull({})
		}
	},
)
cli.register(
	class ChangelogValidateCommand extends DevCommand {
		static override paths = [[`changelog`, `validate`]]
		static override usage = Command.Usage({
			description: `Check if CHANGELOG.md matches the repository's GitHub releases`,
		})

		diff = Option.Boolean('--diff')

		async execute() {
			this.maybeChangeDir()
			await runChangelogValidate({ diff: this.diff })
		}
	},
)
cli.register(
	class TaskCommand extends DevCommand {
		static override paths = [[`task`]]
		static override usage = Command.Usage({
			description: `Run a task`,
		})

		async execute() {
			this.maybeChangeDir()
			process.stdout.write(`Usage: dev task <task>

Tasks:

check-license-headers
symlink-hidden-dirs
validate-hyperupcall-archives
create-vscode-launchers
toggle-tools
`)
			process.exit(1)
		}
	},
)
cli.register(
	class TaskCheckLicenseHeadersCommand extends DevCommand {
		static override paths = [[`task`, `check-license-headers`]]
		static override usage = Command.Usage({
			description: `Check the license headers of the managed repositories`,
		})

		async execute() {
			this.maybeChangeDir()
			await runCheckLicenseHeaders()
		}
	},
)
cli.register(
	class TaskSymlinkHiddenDirsCommand extends DevCommand {
		static override paths = [[`task`, `symlink-hidden-dirs`]]
		static override usage = Command.Usage({
			description: `Move the hidden directories of the managed repositories to a central directory`,
		})

		async execute() {
			this.maybeChangeDir()
			await runSymlinkHiddenDirs()
		}
	},
)
cli.register(
	class TaskValidateHyperupcallArchivesCommand extends DevCommand {
		static override paths = [[`task`, `validate-hyperupcall-archives`]]
		static override usage = Command.Usage({
			description: `Check that the hyperupcall-archives repositories are archived`,
		})

		async execute() {
			this.maybeChangeDir()
			await runValidateHyperupcallArchives()
		}
	},
)
cli.register(
	class TaskCreateVSCodeLaunchersCommand extends DevCommand {
		static override paths = [[`task`, `create-vscode-launchers`]]
		static override usage = Command.Usage({
			description: `Create the VSCode launchers of the ecosystem packs`,
		})

		async execute() {
			this.maybeChangeDir()
			await runCreateVSCodeLaunchers()
		}
	},
)
cli.register(
	class TaskToggleToolsCommand extends DevCommand {
		static override paths = [[`task`, `toggle-tools`]]
		static override usage = Command.Usage({
			description: `Toggle the editor tools of the current project`,
		})

		async execute() {
			this.maybeChangeDir()
			await runToggleTools()
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

		force = Option.Boolean('--force')

		async execute() {
			this.maybeChangeDir()
			await runVersion({ force: this.force })
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
