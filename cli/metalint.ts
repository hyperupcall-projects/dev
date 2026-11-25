// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as clack from '@clack/prompts'
import { styleText } from 'node:util'
import os from 'node:os'
import {
	fileExists,
	getGitRemoteName,
	parseGitHubRepository,
	pkgRoot,
} from '#utilities/util.ts'
import toml from 'smol-toml'
import { execa } from 'execa'
import { globby } from 'globby'
import ansiEscapes from 'ansi-escapes'
import { detectEcosystem, ecosystems } from '#utilities/ecosystems.ts'
import { detectFiletypes } from '#utilities/filetype.ts'

import type { Config, Issue, Project } from '#types'
import process from 'node:process'
import { mergeTOML } from '#utilities/util.ts'
import { fixEditorSettings } from '#utilities/ide.ts'

type CommandFixOptions = {
	config: Config
	yes?: boolean
	match?: string[]
	exclude?: string[]
	only?: string[]
	strict?: boolean
}

export async function run(options: CommandFixOptions) {
	const project = await getProject()
	const config: Config = options.config

	await fixEditorSettings()

	const ruleFiles: string[] = []
	const collect = async (pattern: string) => {
		const matches = await globby(pattern, {
			cwd: path.join(pkgRoot(), 'config/metalint-rules'),
		})

		for (const match of matches) {
			ruleFiles.push(match)
		}
	}

	// Collect rule files that match the version control system type.
	{
		await collect(`100-dir/*`)

		if (project.type === 'with-vcs' || project.type === 'with-remotevcs') {
			if (await fileExists('.git')) {
				await collect(`200-vcs/*`)
			}
		}

		if (project.type === 'with-remotevcs') {
			await collect(`300-remotevcs/*`)
		}
	}

	// Collect rule files that match the ecosystem.
	await collect(`400-ecosystem/_/*`)
	const ecosystemIds = await detectEcosystem({ rootDir: process.cwd() })
	const filetypes = await detectFiletypes({ rootDir: process.cwd() })
	const filetypeIds = Object.keys(filetypes)
	for (const ecosystemId of ecosystemIds) {
		for (const pattern of await ecosystems[ecosystemId].lintFileGlobs()) {
			await collect(pattern)
		}
	}

	// Collect rule files that match the name.
	{
		if (project.type === 'with-remotevcs') {
			await collect(`500-name/${project.owner}/_/*`)
			await collect(`500-name/${project.owner}/${project.name}/*`)
		}
	}

	// Remove rule files that are superceded by another rule file.
	for (let i = ruleFiles.length - 1; i >= 0; i -= 1) {
		const highPriorityFilename = ruleFiles[i].match(/.*\/[0-9]*(.*?)\./)?.[1]
		if (!highPriorityFilename) {
			throw new TypeError(`Expected variable "highPriorityFilename" to not be falsy`)
		}

		for (let j = 0; j < i; j += 1) {
			const lowPriorityFilename = ruleFiles[j].match(/.*\/[0-9]*(.*?)\./)?.[1]
			if (!lowPriorityFilename) {
				throw new TypeError(`Expected variable "lowPriorityFilename" to not be falsy`)
			}

			if (highPriorityFilename == lowPriorityFilename) {
				ruleFiles.splice(j, 1)
				break
			}
		}
	}

	// Print metadata.
	{
		const homedirPretty = project.rootDir.startsWith(os.homedir())
			? `~/${project.rootDir.slice(os.homedir().length + 1)}`
			: project.rootDir
		let str = ''
		str += `${styleText(['blue', 'bold'], 'Directory:')}  ${homedirPretty}\n`
		if (project.type === 'with-remotevcs') {
			str += `${styleText(['blue', 'bold'], 'Project:')}    ${ansiEscapes.link(
				`${project.owner}/${project.name}`,
				`https://github.com/${project.owner}/${project.name}`,
			)}\n`
		}
		str += `${styleText(['blue', 'bold'], 'Ecosystems:')} ${new Intl.ListFormat().format(
			ecosystemIds,
		)}\n`
		str += `${styleText(['blue', 'bold'], 'Filetypes:')}  ${new Intl.ListFormat().format(
			filetypeIds,
		)}\n`

		process.stdout.write(str)
	}

	for (const fixFile of ruleFiles) {
		await fixFromFile(
			path.join(pkgRoot(), 'config/metalint-rules', fixFile),
			project,
			options,
			config,
		)
	}

	console.info('Done.')
}

async function fixFromFile(
	fixFile: string,
	project: Project,
	options: CommandFixOptions,
	config: Config,
) {
	const fixId = (
		path.basename(path.dirname(fixFile)) +
		'/' +
		path.parse(fixFile).name
	).replaceAll(/[0-9]+-/gu, '')

	const module = await import(fixFile)
	if (!module.issues) {
		throw new TypeError(
			`Failed to find issues for "${fixId}" because no "issues" function was exported`,
		)
	}

	if (module.skip) {
		console.info(`[${styleText('yellow', 'SKIP')}] ${fixId}`)
		return
	}

	try {
		let failed = false
		const issues: AsyncGenerator<Issue> = module.issues({ project, config })
		for await (const issue of issues) {
			if (issue.skip) {
				console.info(`[${styleText('yellow', 'SKIP')}] ${fixId}: ${issue.message}`)
				return
			}

			if (issue.strict && !options.strict) {
				console.info(`[${styleText('yellow', 'SKIP')}] ${fixId}/${issue.id}`)
				continue
			}

			if (config.rules?.[`${fixId}/${issue.id}`] === 'off') {
				console.info(`[${styleText('yellow', 'SKIP')}] ${fixId}/${issue.id}`)
				continue
			}

			console.info(`[QUES] ${fixId}`)
			if (Array.isArray(issue.message)) {
				for (const message of issue.message) {
					console.info(` -> ${message}`)
				}
			} else {
				console.info(issue.message)
			}

			if (!issue.fix) {
				printWithTips(`[${styleText('red', 'FAIL')}] ${fixId}`, [
					'No fix function exists',
				])
				failed = true
				break
			}

			let action: 'fix' | 'ignore-once' | 'ignore' | symbol
			if (options.yes) {
				action = 'fix'
			} else {
				action = await clack.select({
					message: 'What would you like to do?',
					initialValue: 'fix',
					options: [
						{ value: 'fix', label: 'Fix issue' },
						{ value: 'ignore-once', label: 'Ignore issue once' },
						{ value: 'ignore', label: 'Ignore issue' },
					],
				})

				if (clack.isCancel(action)) {
					printWithTips(`[${styleText('red', 'FAIL')}] ${fixId}`, [
						'Failed because the user exited the prompt',
					])
					process.exit(1)
				}
			}

			if (action === 'fix') {
				await issue.fix()
			} else {
				if (action === 'ignore') {
					const ruleId = `${fixId}/${issue.id}`
					await ignoreIssue(project.rootDir, ruleId)
					config.rules ??= {}
					config.rules[ruleId] = 'off'
				}
				console.info(`[${styleText('yellow', 'SKIP')}] ${fixId}`)
				continue
			}
		}

		if (!failed) {
			console.info(`[${styleText('green', 'PASS')}] ${fixId}`)
		} else {
			process.exit(1)
		}
	} catch (err) {
		printWithTips(`[${styleText('red', 'FAIL')}] ${fixId}`, [
			'Failed because an error was caught',
		])
		console.error(err)
		process.exit(1)
	}
}

async function ignoreIssue(rootDir: string, ruleId: string) {
	const configPath = path.join(rootDir, 'dev.toml')
	const override = toml.stringify({ rules: { [ruleId]: 'off' } })
	if (!(await fileExists(configPath))) {
		await fs.writeFile(configPath, override)
		return
	}

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-toml-'))
	try {
		const overridePath = path.join(tmpDir, 'override.toml')
		await fs.writeFile(overridePath, override)
		const output = await mergeTOML(configPath, overridePath)
		await fs.writeFile(configPath, output)
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

async function getProject(): Promise<Project> {
	if (!(await fileExists('.git'))) {
		return {
			type: 'only-directory',
			rootDir: process.cwd(),
			name: path.basename(process.cwd()),
		}
	}

	const { stdout: branchName } = await execa('git', ['branch', '--show-current'])
	const remoteName = await getGitRemoteName()
	if (!remoteName) {
		return {
			type: 'with-vcs',
			rootDir: process.cwd(),
			name: path.basename(process.cwd()),
			branchName,
		}
	}
	const { stdout: remoteUrl } = await execa('git', [
		'remote',
		'get-url',
		'--',
		remoteName,
	])
	const repository = parseGitHubRepository(remoteUrl)
	if (!repository) {
		printWithTips(
			`Failed to extract repository name and owner for remote name "${remoteName}"`,
			[`Remote name has URL of "${remoteUrl}"`],
		)
		process.exit(1)
	}

	return {
		type: 'with-remotevcs',
		rootDir: process.cwd(),
		name: repository.repo,
		branchName,
		remoteName,
		remoteUrl,
		owner: repository.owner,
	}
}

function printWithTips(str: string, tips: string[]) {
	console.info(str)
	for (const tip of tips) {
		console.info(` -> ${tip}`)
	}
}
