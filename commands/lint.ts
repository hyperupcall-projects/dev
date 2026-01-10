// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as readline from 'node:readline/promises'
import { styleText } from 'node:util'
import os from 'node:os'
import { fileExists, pkgRoot } from '#common'
import yn from 'yn'
import toml from 'smol-toml'
import { execa } from 'execa'
import { globby } from 'globby'
import ansiEscapes from 'ansi-escapes'
import * as jsonc from 'jsonc-parser'
import { xdgConfig } from 'xdg-basedir'
import { getEcosystems } from '../devutils/index.ts'

import type { CommandFixOptions, Config, Issue, Project } from '#types'
import _ from 'lodash'
import process from 'node:process'

export async function run(options: CommandFixOptions, positionals: string[]) {
	if (positionals.length > 0) {
		process.chdir(positionals[0] || '.')
	}

	const project = await getProject()

	const globalConfig = {
		skippedOrganizations: ['bash-bastion'],
		skippedRepositories: ['SchemaStore/schemastore'],
	}

	let config: Config = {
		rules: {
			...(project.type === 'with-remote-url' &&
					`${project.owner}/${project.name}` === 'awesome-lists/awesome-bash'
				? {
					'remote-url/remote-metadata/disable-projects-tab': 'off',
					'remote-url/remote-metadata/default-branch-main': 'off',
				}
				: {}),
		},
	}
	try {
		config = _.merge(
			config,
			toml.parse(
				await fs.readFile(path.join(project.rootDir, 'dev.toml'), 'utf-8'),
			),
		) as Config
	} catch (err) {
		if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
			throw err
		}
	}

	if (
		project.type === 'with-remote-url' &&
		(globalConfig.skippedRepositories.includes(
			`${project.owner}/${project.name}`,
		) ||
			globalConfig.skippedOrganizations.includes(project.owner))
	) {
		console.info(
			`[${styleText('yellow', 'SKIP')}] ${project.owner}/${project.name}`,
		)
		return
	}

	// FIX EDITOR SETTINGS
	if (await fileExists('.vscode/settings.json')) {
		const userSettingsJsonFile = path.join(
			xdgConfig,
			'Code/User/settings.json',
		)
		const defaultTitle = jsonc.parse(
			await fs.readFile(userSettingsJsonFile, 'utf-8'),
		)['window.title']

		const settingsText = await fs.readFile('.vscode/settings.json', 'utf-8')
		const settingsJson = jsonc.parse(settingsText)
		const ecosystem = (await getEcosystems(Deno.cwd()))[0]
		if (settingsJson['window.title']) {
			const output = settingsText.replace(
				/"window\.title"[ \t]*:[ \t]*".*?"/m,
				`"window.title": "${defaultTitle} (${ecosystem})"`,
			)
			await fs.writeFile('.vscode/settings.json', output)
		} else if (Object.keys(settingsJson).length === 0) {
			const output = `{
	"window.title": "${defaultTitle} (${ecosystem})"
}`
			await fs.writeFile('.vscode/settings.json', output)
		} else {
			const output = settingsText.replace(
				/[ \t]*{/m,
				`{\n\t"window.title": "${defaultTitle} (${ecosystem})",`,
			)
			await fs.writeFile('.vscode/settings.json', output)
		}
	}

	const ruleFiles: string[] = []
	const collect = async (pattern: string) => {
		const matches = await globby(pattern, {
			cwd: path.join(pkgRoot(), 'config/lint-rules'),
		})

		for (const match of matches) {
			ruleFiles.push(match)
		}
	}

	// Collect rule files that match the version control system type.
	{
		await collect(`100-directory/*`)

		if (
			project.type === 'under-version-control' ||
			project.type === 'with-remote-url'
		) {
			if (await fileExists('.git')) {
				await collect(`200-version-control/*`)
			}
		}

		if (project.type === 'with-remote-url') {
			await collect(`300-remote-url/*`)
		}
	}

	// Collect rule files that match the ecosystem.
	const ecosystems = await getEcosystems(Deno.cwd()) // TODO
	for (const ecosystem of ecosystems) {
		switch (ecosystem) {
			case 'nodejs':
				await collect(`400-ecosystem/nodejs/*`)
				break
			case 'vscode-extension':
				await collect(`400-ecosystem/vscode-extension/*`)
				break
			case 'deno':
				await collect(`400-ecosystem/deno/*`)
				break
			case 'c':
				await collect(`400-ecosystem/c/*`)
				break
			case 'cpp':
				await collect(`400-ecosystem/cpp/*`)
				break
			case 'bash':
				await collect(`400-ecosystem/bash/*`)
				break
			case 'python':
				await collect(`400-ecosystem/python/*`)
				break
			case 'zed-extension':
				await collect(`400-ecosystem/zed-extension/*`)
				break
			case 'java':
				await collect(`400-ecosystem/java/*`)
				break
		}
	}
	await collect(`400-ecosystem/_/*`)

	// Collect rule files that match the name.
	{
		if (project.type === 'with-remote-url') {
			await collect(`500-name/${project.name}/_/*`)
			await collect(`500-name/_/${project.name}/*`)
			await collect(`500-name/${project.owner}/${project.name}/*`)
		}
	}

	// Remove rule files that are superceded by another rule file.
	for (let i = ruleFiles.length - 1; i >= 0; --i) {
		const fixFile = ruleFiles[i]
		const idx = ruleFiles.findIndex((item) => {
			return (
				path.parse(item).name.slice(item.indexOf('-') + 1) ===
					path.parse(fixFile).name.slice(fixFile.indexOf('-') + 1)
			)
		})

		if (i !== idx) {
			ruleFiles.splice(idx, 1)
		}
	}

	// Print metadata.
	{
		const homedirPretty = project.rootDir.startsWith(os.homedir())
			? `~/${project.rootDir.slice(os.homedir().length + 1)}`
			: project.rootDir
		let str = ''
		str += `${styleText(['blue', 'bold'], 'Directory:')}  ${homedirPretty}\n`
		if (project.type === 'with-remote-url') {
			str += `${styleText(['blue', 'bold'], 'Project:')}    ${
				ansiEscapes.link(
					`${project.owner}/${project.name}`,
					`https://github.com/${project.owner}/${project.name}`,
				)
			}\n`
		}
		str += `${styleText(['blue', 'bold'], 'Ecosystems:')} ${
			new Intl.ListFormat().format(
				ecosystems,
			)
		}\n`

		Deno.stdout.write(new TextEncoder().encode(str))
	}

	for (const fixFile of ruleFiles) {
		await fixFromFile(
			path.join(pkgRoot(), 'config/lint-rules', fixFile),
			project,
			options,
			config,
		)
	}

	console.info('Done.')
	Deno.exit(1) // TODO
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
		const issues: AsyncGenerator<Issue> = module.issues({ project })
		for await (const issue of issues) {
			if (issue.strict && !options.strict) {
				console.info(
					`[${styleText('yellow', 'SKIP')}] ${fixId}/${issue.id}`,
				)
				continue
			}

			if (issue.id) {
				if (`${fixId}/${issue.id}` in (config.rules ?? {})) {
					const rule = (config.rules ?? {})[`${fixId}/${issue.id}`]
					if (rule === 'off') {
						console.info(
							`[${styleText('yellow', 'SKIP')}] ${fixId}/${issue.id}`,
						)
						continue
					}
				}
			}

			console.info(`[EVAL] ${fixId}: Found issue`)
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

			let shouldRunFix
			if (options.yes) {
				shouldRunFix = true
			} else {
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout,
				})
				const input = await rl.question(
					`Would you like to fix this issue? (y/n): `,
				)
				rl.close()
				shouldRunFix = yn(input)
			}

			if (shouldRunFix) {
				await issue.fix(fixId)
			} else {
				console.info(`[${styleText('yellow', 'SKIP')}] ${fixId}`)
				return
			}
		}

		if (!failed) {
			console.info(`[${styleText('green', 'PASS')}] ${fixId}`)
		} else {
			Deno.exit(1)
		}
	} catch (err) {
		if (err.name === 'ExitPromptError') {
			printWithTips(`[${styleText('red', 'FAIL')}] ${fixId}`, [
				'Failed because the user exited the prompt',
			])
			Deno.exit()
		}

		printWithTips(`[${styleText('red', 'FAIL')}] ${fixId}`, [
			'Failed because an error was caught',
		])
		console.error(err)
		Deno.exit(1)
	}
}

async function getProject(): Promise<Project> {
	if (!(await fileExists('.git'))) {
		return {
			type: 'only-directory',
			rootDir: Deno.cwd(),
			name: path.basename(Deno.cwd()),
		}
	}

	const { stdout: branchName } = await execa('git', [
		'branch',
		'--show-current',
	])
	const { stdout: remoteName } = await (async () => {
		try {
			if (branchName) {
				return await execa('git', [
					'config',
					'--get',
					`branch.${branchName}.remote`,
				])
			} else {
				// If HEAD does not point to a branch, it is in a detached state.
				// This can occur with '@actions/checkout'. In such cases, we read
				// it from the config key 'clone.defaultRemoteName'. If that is not
				// set, then it is defaulted to 'origin'. See #172 for details.
				return await execa('git', [
					'config',
					'--default',
					'origin',
					'--get',
					'clone.defaultRemoteName',
				])
			}
		} catch {
			// If there is a git branch, but no configured remotes, then control flow reaches here.
			return {
				stdout: null,
			}
		}
	})()
	if (!remoteName) {
		return {
			type: 'under-version-control',
			rootDir: Deno.cwd(),
			name: path.basename(Deno.cwd()),
			branchName,
		}
	}
	const { stdout: remoteUrl } = await execa('git', [
		'remote',
		'get-url',
		remoteName,
	])
	const match = remoteUrl.match(/[:/](?<owner>.*?)\/(?<name>.*)$/u)
	if (!match?.groups) {
		printWithTips(
			`Failed to extract repository name and owner for remote name "${remoteName}"`,
			[`Remote name has URL of "${remoteUrl}"`],
		)
		Deno.exit(1)
	}

	return {
		type: 'with-remote-url',
		rootDir: Deno.cwd(),
		name: match.groups.name,
		branchName,
		remoteName,
		remoteUrl,
		owner: match.groups.owner,
	}
}

function printWithTips(str: string, tips: string[]) {
	console.info(str)
	for (const tip of tips) {
		console.info(` -> ${tip}`)
	}
}
