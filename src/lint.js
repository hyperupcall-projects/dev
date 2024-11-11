// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as readline from 'node:readline/promises'
import chalk from 'chalk'
import { fileExists, pkgRoot } from '../config/common.js'
import yn from 'yn'
import toml from 'smol-toml'
import { execa } from 'execa'

/**
 * @import { CommandFixOptions, Project } from '../index.js'
 */

export async function run(
	/** @type {CommandFixOptions} */ options,
	/** @type {string[]} */ positionals,
) {
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
		if (/** @type {NodeJS.Error} */ (err).code !== 'ENOENT') {
			throw err
		}
	}

	if (project.type === 'dir') {
		console.log(`${chalk.blue('Directory:')} ${project.rootDir}`)
	} else if (project.type === 'vcs-only') {
		console.log(`${chalk.blue('Repository:')} ${project.rootDir}`)
	} else if (project.type === 'vcs-with-remote') {
		console.log(
			`${chalk.blue(`Remote:`)} https://github.com/${project.owner}/${project.name}`,
		)
	}

	{
		const dir = path.join(pkgRoot(), 'config/lint-rules/by-other')
		const predicate = async function chooseEcosystem(/** @type {string} */ fixId) {
			if (fixId.startsWith('git/') && project.type !== 'dir') {
				return true
			}

			if (fixId.startsWith('github/') && project.type === 'vcs-with-remote') {
				return true
			}

			return false
		}
		await fixFromFile(
			path.join(pkgRoot(), 'config/lint-rules/by-other/other/no-code-of-conduct.js'),
			'other/no-code-of-conduct',
			project,
			options,
		)
		await fixFromDir(dir, predicate, project, options)
	}

	{
		const dir = path.join(pkgRoot(), 'config/lint-rules/by-ecosystem')
		const predicate = async function chooseEcosystem(/** @type {string} */ fixId) {
			if (fixId.startsWith('all/')) {
				return true
			}

			if (fixId.startsWith('nodejs/') && (await fileExists('package.json'))) {
				return true
			}

			if (fixId.startsWith('deno/') && (await fileExists('deno.jsonc'))) {
				return true
			}

			return false
		}
		await fixFromDir(dir, predicate, project, options)
	}

	// TODO: by-name

	console.log('Done.')
}

/**
 * @param {string} dir
 * @param {(fixId: string) => boolean | Promise<boolean>} predicate
 * @param {Project} project
 * @param {CommandFixOptions} options
 */
async function fixFromDir(dir, predicate, project, options) {
	for (const group of await fs.readdir(dir, { withFileTypes: true })) {
		for (const fixFileEntry of await fs.readdir(path.join(group.parentPath, group.name), {
			withFileTypes: true,
		})) {
			const fixFile = path.join(fixFileEntry.parentPath, fixFileEntry.name)
			const fixId = `${group.name}/${fixFileEntry.name.slice(0, -3)}`

			if (await predicate(fixId)) {
				await fixFromFile(fixFile, fixId, project, options)
			}
		}
	}
}

/**
 * @param {string} fixFile
 * @param {string} fixId
 * @param {Project} project
 * @param {CommandFixOptions} options
 */
async function fixFromFile(fixFile, fixId, project, options) {
	const module = await import(fixFile)
	if (!module.issues) {
		throw new TypeError(
			`Failed to find issues for "${fixId}" because no "issues" function was exported`,
		)
	}

	if (module.skip) {
		console.info(`[${chalk.yellow('SKIP')}] ${fixId}`)
		return
	}

	try {
		let failed = false
		const issues = module.issues({ project })
		for await (const issue of issues) {
			console.info(`[${chalk.cyan('EVAL')}] ${fixId}: Found issue`)
			if (Array.isArray(issue.message)) {
				for (const message of issue.message) {
					console.info(` -> ${message}`)
				}
			} else {
				console.info(issue.message)
			}

			if (!issue.fix) {
				printWithTips(`[${chalk.red('FAIL')}] ${fixId}`, ['No fix function exists'])
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
				printWithTips(`[${chalk.red('FAIL')}] ${fixId}`, [
					'Failed because running fix function was declined',
				])
				failed = true
				break
			}
		}

		if (!failed) {
			console.info(`[${chalk.green('PASS')}] ${fixId}`)
		}
	} catch (err) {
		printWithTips(`[${chalk.red('FAIL')}] ${fixId}`, [
			'Failed because an error was caught',
		])
		console.error(err)
	}
}

/**
 * @returns {Promise<Project>}
 */
async function getProject() {
	if (!(await fileExists('.git'))) {
		return {
			type: 'dir',
			rootDir: process.cwd(),
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
			type: 'vcs-only',
			rootDir: process.cwd(),
			branchName,
		}
	}
	const { stdout: remoteUrl } = await execa('git', ['remote', 'get-url', remoteName])

	const match = remoteUrl.match(/[:/](?<owner>.*?)\/(?<name>.*)$/u)
	if (!match?.groups) {
		return {
			type: 'vcs-only',
			rootDir: process.cwd(),
			branchName,
		}
	}

	return {
		type: 'vcs-with-remote',
		rootDir: process.cwd(),
		branchName,
		remoteName,
		remoteUrl,
		owner: match.groups.owner,
		name: match.groups.name,
	}
}

function printWithTips(/** @type {string} */ str, /** @type {string[]} */ tips) {
	console.info(str)
	for (const tip of tips) {
		console.info(` -> ${tip}`)
	}
}
