#!/usr/bin/env node
import { execa } from 'execa'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { run as runNew } from './new.ts'
import { run as runFix } from './metalint.ts'
import { run as runFormat } from './format.ts'
import { run as runLint } from './lint.ts'
import { run as runVersion } from './version.ts'

import {
	runCommandInRepositories,
	runFetchRepositoryData,
	runRepositoriesTui,
	runSyncRepositories,
} from './repos.ts'
import {
	runPull as runChangelogPull,
	runValidate as runChangelogValidate,
} from './changelog.ts'
import {
	runCheckLicenseHeaders,
	runCreateVSCodeLaunchers,
	runSymlinkHiddenDirs,
	runToggleTools,
	runValidateHyperupcallArchives,
} from './task.ts'
import { detectEcosystem } from '#utilities/ecosystems.ts'

function maybeChangeDir(workingDir?: string) {
	if (!workingDir) {
		return
	}

	try {
		process.chdir(workingDir)
	} catch {
		console.error(`Cannot change to directory: ${workingDir}`)
		process.exit(1)
	}
}

const cli = yargs(hideBin(process.argv))
	.scriptName('dev')
	.version(JSON.parse(
		readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
	).version)
	.option('dir', {
		type: 'string',
		description: 'Run as if dev was started in this directory',
	})
	.command(
		'new [targetDir] [ecosystem] [templateName] [projectName]',
		'Create a new project',
		(y) =>
			y
				.positional('targetDir', {
					type: 'string',
					description: 'Directory to create the project in',
				})
				.positional('ecosystem', {
					type: 'string',
					description: 'Ecosystem of the template',
				})
				.positional('templateName', {
					type: 'string',
					description: 'Template to use',
				})
				.positional('projectName', {
					type: 'string',
					description: 'Name of the project',
				})
				.option('force', {
					type: 'boolean',
					description: 'Use the directory even if it is not empty',
				})
				.option('options', {
					type: 'string',
					description: 'Comma-separated list of extra template options',
				}),
		async (argv) => {
			maybeChangeDir(argv.dir)
			await runNew({
				dir: argv.targetDir as string | undefined,
				ecosystem: argv.ecosystem as string | undefined,
				templateName: argv.templateName as string | undefined,
				projectName: argv.projectName as string | undefined,
				force: argv.force as boolean | undefined,
				options: argv.options as string | undefined,
			})
		},
	)
	.command(
		'metalint [targetDir]',
		'Lint and fix issues with repository config and metadata',
		(y) =>
			y
				.positional('targetDir', {
					type: 'string',
					description: 'Directory of the project to lint',
				})
				.option('yes', { type: 'boolean', description: 'Apply every fix without asking' })
				.option('strict', {
					type: 'boolean',
					description: 'Also run checks marked as strict',
				})
				.option('match', {
					type: 'string',
					array: true,
					description: 'Parsed but unused',
				})
				.option('only', { type: 'string', array: true, description: 'Parsed but unused' })
				.option('exclude', {
					type: 'string',
					array: true,
					description: 'Parsed but unused',
				}),
		async (argv) => {
			maybeChangeDir(argv.dir)
			await runFix({
				dir: argv.targetDir as string | undefined,
				yes: argv.yes as boolean | undefined,
				strict: argv.strict as boolean | undefined,
				match: argv.match as string[] | undefined,
				only: argv.only as string[] | undefined,
				exclude: argv.exclude as string[] | undefined,
			})
		},
	)
	.command(
		'format [formatter]',
		'Format the project with the configured formatters',
		(y) =>
			y.positional('formatter', {
				type: 'string',
				description: 'Formatter to run',
			}),
		async (argv) => {
			maybeChangeDir(argv.dir)
			await runFormat({
				formatter: argv.formatter as string | undefined,
			})
		},
	)
	.command(
		'lint [linter]',
		'Lint the project with the configured linters',
		(y) =>
			y.positional('linter', {
				type: 'string',
				description: 'Linter to run',
			}),
		async (argv) => {
			maybeChangeDir(argv.dir)
			await runLint({
				linter: argv.linter as string | undefined,
			})
		},
	)
	.command('repos', 'Manage repositories across GitHub accounts and organizations', (y) =>
		y
			.command(
				'fetch-repository-data',
				'Fetch the list of repositories from GitHub',
				() => {},
				async (argv) => {
					maybeChangeDir(argv.dir)
					await runFetchRepositoryData()
				},
			)
			.command(
				'tui',
				'Open a repository interactively',
				() => {},
				async (argv) => {
					maybeChangeDir(argv.dir)
					await runRepositoriesTui()
				},
			)
			.command(
				'sync',
				'Synchronize the managed repositories',
				() => {},
				async (argv) => {
					maybeChangeDir(argv.dir)
					await runSyncRepositories()
				},
			)
			.command(
				'run',
				'Run a command in every managed repository (usage: dev repos run -- <command> [args...])',
				(y) => y.parserConfiguration({ 'populate--': true }),
				async (argv) => {
					maybeChangeDir(argv.dir)
					const [command, ...args] = (argv['--'] as string[] | undefined) ?? []

					if (!command) {
						console.error('Usage: dev repos run -- <command> [args...]')
						process.exitCode = 1
						return
					}

					await runCommandInRepositories({ command, args })
				},
			)
			.demandCommand(1),
	)
	.command('changelog', 'Manage changelogs', (y) =>
		y
			.command(
				'pull',
				"Write CHANGELOG.md from the repository's GitHub releases",
				() => {},
				async (argv) => {
					maybeChangeDir(argv.dir)
					await runChangelogPull({})
				},
			)
			.command(
				'validate',
				"Check if CHANGELOG.md matches the repository's GitHub releases",
				(y) =>
					y.option('diff', {
						type: 'boolean',
						description: 'Print a unified diff of the changes',
					}),
				async (argv) => {
					maybeChangeDir(argv.dir)
					await runChangelogValidate({ diff: argv.diff as boolean | undefined })
				},
			)
			.demandCommand(1),
	)
	.command(
		'task',
		'Run a task',
		(y) =>
			y
				.command(
					'check-license-headers',
					'Check the license headers of the managed repositories',
					() => {},
					async (argv) => {
						maybeChangeDir(argv.dir)
						await runCheckLicenseHeaders()
					},
				)
				.command(
					'symlink-hidden-dirs',
					'Move the hidden directories of the managed repositories to a central directory',
					() => {},
					async (argv) => {
						maybeChangeDir(argv.dir)
						await runSymlinkHiddenDirs()
					},
				)
				.command(
					'validate-hyperupcall-archives',
					'Check that the hyperupcall-archives repositories are archived',
					() => {},
					async (argv) => {
						maybeChangeDir(argv.dir)
						await runValidateHyperupcallArchives()
					},
				)
				.command(
					'create-vscode-launchers',
					'Create the VSCode launchers of the ecosystem packs',
					() => {},
					async (argv) => {
						maybeChangeDir(argv.dir)
						await runCreateVSCodeLaunchers()
					},
				)
				.command(
					'toggle-tools',
					'Toggle the editor tools of the current project',
					() => {},
					async (argv) => {
						maybeChangeDir(argv.dir)
						await runToggleTools()
					},
				),
		() => {
			process.stdout.write(`Usage: dev task <task>

Tasks:

check-license-headers
symlink-hidden-dirs
validate-hyperupcall-archives
create-vscode-launchers
toggle-tools
`)
			process.exitCode = 1
		},
	)
	.command(
		'start-dev-server',
		'Start the global development server',
		() => {},
		async () => {
			await execa('node', ['--run', 'start'], {
				stdio: 'inherit',
				cwd: path.join(import.meta.dirname, '..'),
			})
		},
	)
	.command(
		'version',
		'Manage project versioning',
		(y) =>
			y.option('force', {
				type: 'boolean',
				description: 'Continue even if the working tree has changes',
			}),
		async (argv) => {
			maybeChangeDir(argv.dir)
			await runVersion({ force: argv.force as boolean | undefined })
		},
	)
	.command(
		'call get-ecosystems [directory]',
		'Print the IDs of the ecosystems detected in a directory',
		(y) =>
			y.positional('directory', {
				type: 'string',
				description: 'Directory to inspect',
			}),
		async (argv) => {
			maybeChangeDir(argv.dir)
			const ecosystemIds = await detectEcosystem({
				rootDir: (argv.directory as string | undefined) ?? process.cwd(),
			})
			for (const ecosystemId of ecosystemIds) {
				process.stdout.write(`${ecosystemId}\n`)
			}
		},
	)
	.demandCommand(1)
	.strict()
	.help()

await cli.parseAsync()
