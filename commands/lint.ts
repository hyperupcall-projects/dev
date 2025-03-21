// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as readline from 'node:readline/promises'
import util, { styleText } from 'node:util'
import { fileExists, pkgRoot } from '#common'
import yn from 'yn'
import toml from 'smol-toml'
import { execa } from 'execa'
import { globby } from 'globby'
import ansiEscapes from 'ansi-escapes'

import type { CommandFixOptions, Project } from '#types'

export async function run(options: CommandFixOptions, positionals: string[]) {
	if (positionals.length > 0) {
		process.chdir(positionals[0] || '.')
	}

	const project = await getProject()

	let config = {}
	try {
		config = toml.parse(
			await fs.readFile(path.join(project.rootDir, 'project.toml'), 'utf-8'),
		)
	} catch (err) {
		if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
			throw err
		}
	}

	// Print metadata.
	{
		let str = ''
		str += `${styleText(['blue', 'bold'], 'Directory:')} ${project.rootDir}\n`
		if (project.type === 'with-remote-url') {
			str += `${styleText(['blue', 'bold'], 'Project:')}   ${ansiEscapes.link(`${project.owner}/${project.name}`, `https://github.com/${project.owner}/${project.name}`)}\n`
		}

		process.stdout.write(str)
	}

	// TODO
	const skippedOrganizations = ['bash-bastion']
	const skippedRepositories = ['SchemaStore/schemastore']
	if (
		skippedRepositories.includes(`${project.owner}/${project.name}`) ||
		skippedOrganizations.includes(project.owner)
	) {
		console.info(`[${styleText('yellow', 'SKIP')}] ${project.owner}/${project.name}`)
		return
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

		if (project.type === 'under-version-control' || project.type === 'with-remote-url') {
			if (await fileExists('.git')) {
				await collect(`200-version-control/*`)
			}
		}

		if (project.type === 'with-remote-url') {
			await collect(`300-remote-url/*`)
		}
	}

	// Collect rule files that match the ecosystem.
	{
		if (await fileExists('package.json')) {
			await collect(`400-ecosystem/nodejs/*`)
		}

		if ((await fileExists('deno.jsonc')) || (await fileExists('deno.json'))) {
			await collect(`400-ecosystem/deno/*`)
		}

		await collect(`400-ecosystem/_/*`)
	}

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

	for (const fixFile of ruleFiles) {
		const fixId = path.basename(path.dirname(fixFile)) + '/' + path.parse(fixFile).name
		if (`${project.owner}/${project.name}` === 'awesome-lists/awesome-bash') {
			if (
				fixFile.includes('300-remote-url/repo-metadata') ||
				fixFile.includes('_/editorconfig')
			) {
				console.info(`[${styleText('yellow', 'SKIP')}] ${fixId}`)
				continue
			}
		}

		await fixFromFile(
			path.join(pkgRoot(), 'config/lint-rules', fixFile),
			project,
			options,
		)
	}

	console.info('Done.')
}

/**
 * @param {string} fixFile
 ] * @param {Project} project
 * @param {CommandFixOptions} options
 */
async function fixFromFile(fixFile, project, options) {
	const fixId = path.basename(path.dirname(fixFile)) + '/' + path.parse(fixFile).name

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
		const issues = module.issues({ project })
		for await (const issue of issues) {
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
				const input = await rl.question(`Would you like to fix this issue? (y/n): `)
				rl.close()
				shouldRunFix = yn(input)
			}

			if (shouldRunFix) {
				await issue.fix()
			} else {
				printWithTips(`[${styleText('red', 'FAIL')}] ${fixId}`, [
					'Failed because running fix function was declined',
				])
				failed = true
				break
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

/**
 * @returns {Promise<Project>}
 */
async function getProject() {
	if (!(await fileExists('.git'))) {
		return {
			type: 'only-directory',
			rootDir: process.cwd(),
			name: path.basename(process.cwd()),
		}
	}

	const { stdout: branchName } = await execa('git', ['branch', '--show-current'])
	const { stdout: remoteName } = await (async () => {
		try {
			if (branchName) {
				return await execa('git', ['config', '--get', `branch.${branchName}.remote`])
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
		} catch (err) {
			// If there is a git branch, but no configured remotes, then control flow reaches here.
			return {
				stdout: null,
			}
		}
	})()
	if (!remoteName) {
		return {
			type: 'under-version-control',
			rootDir: process.cwd(),
			name: path.basename(process.cwd()),
			branchName,
		}
	}
	const { stdout: remoteUrl } = await execa('git', ['remote', 'get-url', remoteName])
	const match = remoteUrl.match(/[:/](?<owner>.*?)\/(?<name>.*)$/u)
	if (!match?.groups) {
		printWithTips(
			`Failed to extract repository name and owner for remote name "${remoteName}"`,
			[`Remote name has URL of "${remoteUrl}"`],
		)
		process.exit(1)
	}

	return {
		type: 'with-remote-url',
		rootDir: process.cwd(),
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
