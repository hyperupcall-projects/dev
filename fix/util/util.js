import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import chalk from 'chalk'
import { execa } from 'execa'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require = createRequire(import.meta.url)

/**
 * @param {string} filepath
 * @returns {Promise<boolean>}
 */
export function fileExists(filepath) {
	return fs
		.stat(filepath)
		.then(() => true)
		.catch(() => false)
}

/**
 * @param {string} [packageName]
 * @returns {string}
 */
export function pkgRoot(packageName) {
	if (packageName === void 0) {
		return path.dirname(path.dirname(new URL(import.meta.url).pathname))
	} else {
		return path.dirname(require.resolve(packageName))
	}
}

/**
 * @param {string} configFileName
 */
export function getConfigPath(configFileName) {
	const thisLocation = path.join(pkgRoot(), configFileName)
	if (existsSync(thisLocation)) {
		return thisLocation
	}

	const thatLocation = path.join(pkgRoot('@hyperupcall/configs'), '.eslintrc.json')
	if (existsSync(thatLocation)) {
		return thatLocation
	}

	throw new Error(`Failed to find config file with name: ${configFileName}`)
}

/**
 * @param {Record<string, any>[]} trees
 */
export async function writeTrees(trees) {
	for (const tree of trees) {
		for (const [filepath, content] of Object.entries(tree)) {
			await fs.mkdir(path.dirname(filepath), { recursive: true })
			await fs.writeFile(filepath, content)
		}
	}
}

/**
 * @param {'done' | 'info' | 'skip-good' | 'skip-bad' | 'error'} variant
 * @param {string} id
 * @param {string} text
 */
export function print(variant, id, text) {
	switch (variant) {
		case 'done':
			console.log(`${chalk.green('DONE:')} ${chalk.bold(id)}: ${text}`)
			break
		case 'info':
			console.log(`${chalk.magenta('DONE:')} ${chalk.bold(id)}: ${text}`)
			break
		case 'skip-good':
			console.log(`${chalk.cyan('SKIP:')} ${chalk.bold(id)}: ${text}`)
			break
		case 'skip-bad':
			console.log(`${chalk.yellow('SKIP:')} ${chalk.bold(id)}: ${text}`)
			break
		case 'error':
			console.log(`${chalk.red('ERROR:')} ${chalk.bold(id)}: ${text}`)
	}
}

/**
 * @returns {Promise<import('../../index.js').Project | null>}
 */
export async function getProject() {
	if (!(await fileExists('.git'))) {
		return null
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
			gitHasRemote: false,
			branchName,
		}
	}
	const { stdout: remoteUrl } = await execa('git', ['remote', 'get-url', remoteName])

	const match = remoteUrl.match(/[:/](?<owner>.*?)\/(?<name>.*)$/u)
	if (!match?.groups) {
		return {
			gitHasRemote: false,
			branchName,
		}
	}

	return {
		gitHasRemote: true,
		branchName,
		remoteName,
		remoteUrl,
		owner: match.groups.owner,
		name: match.groups.name,
	}
}

export const projectInfo = await getProject()
