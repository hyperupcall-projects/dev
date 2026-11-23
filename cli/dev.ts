#!/usr/bin/env node
import { execa } from 'execa'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { run as runNew } from './new.ts'
import { run as runLicense } from './license.ts'
import { run as runMetalint } from './metalint.ts'
import { run as runFormat } from './format.ts'
import { run as runLint } from './lint.ts'
import { run as runVersion } from './version.ts'

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
import { loadConfig } from '#utilities/util.ts'
import type { Config } from '#types'

let config: Config

const cli = yargs(hideBin(process.argv))
	.scriptName('dev')
	.version(
		JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
			.version,
	)
	.option('dir', {
		type: 'string',
		description: 'Run as if dev was started in this directory',
	})
	.middleware(async (argv) => {
		if (argv.dir) {
			try {
				process.chdir(argv.dir)
			} catch {
				console.error(`Cannot change to directory: ${argv.dir}`)
				process.exit(1)
			}
		}
		config = await loadConfig(process.cwd())
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
		'license',
		'Choose a license and write it to LICENSE',
		() => {},
		async () => {
			await runLicense()
		},
	)
	.command(
		'metalint',
		'Lint and fix issues with repository config and metadata',
		(y) =>
			y
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
			await runMetalint({
				config,
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
			await runFormat({
				config,
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
			await runLint({
				config,
				linter: argv.linter as string | undefined,
			})
		},
	)
	.command('changelog', 'Manage changelogs', (y) =>
		y
			.command(
				'pull',
				"Write CHANGELOG.md from the repository's GitHub releases",
				() => {},
				async (argv) => {
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
						await runCheckLicenseHeaders()
					},
				)
				.command(
					'symlink-hidden-dirs',
					'Move the hidden directories of the managed repositories to a central directory',
					() => {},
					async (argv) => {
						await runSymlinkHiddenDirs()
					},
				)
				.command(
					'validate-hyperupcall-archives',
					'Check that the hyperupcall-archives repositories are archived',
					() => {},
					async (argv) => {
						await runValidateHyperupcallArchives()
					},
				)
				.command(
					'create-vscode-launchers',
					'Create the VSCode launchers of the ecosystem packs',
					() => {},
					async (argv) => {
						await runCreateVSCodeLaunchers()
					},
				)
				.command(
					'toggle-tools',
					'Toggle the editor tools of the current project',
					() => {},
					async (argv) => {
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
			await runVersion({ config, force: argv.force as boolean | undefined })
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
