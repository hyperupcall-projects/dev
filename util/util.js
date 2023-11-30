import * as fs from 'node:fs/promises'
import * as readline from 'node:readline/promises'
import * as path from 'node:path'
import detectIndent from 'detect-indent'
import yn from 'yn'
import chalk from 'chalk'
import { execa } from 'execa'
import { existsSync } from 'node:fs'

/**
 * @param {string} packageName
 * @returns {string}
 */
export function pkgRoot(packageName) {
	if (packageName === void 0) {
		return path.dirname(path.dirname(new URL(import.meta.url).pathname))
	} else {
		return path.dirname(new URL(import.meta.resolve(packageName)).pathname)
	}
}

/**
 * @typedef {object} ProjectInfo
 * @property {string} branchName
 * @property {string} remoteName
 * @property {string} remoteUrl
 * @property {string} owner
 * @property {string} name
 */

/**
 * @returns {Promise<ProjectInfo>}
 */
export async function getProjectInfo() {
	if (!existsSync('.git')) {
		return {
			branchName: null,
			remoteName: null,
			remoteUrl: null,
			owner: null,
			name: null
		}
	}

	const { stdout: branchName } = await execa('git', ['branch', '--show-current'])
	const { stdout: remoteName } = await (async () => {
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
	})()
	const { stdout: remoteUrl } = await execa('git', ['remote', 'get-url', remoteName])

	const {
		groups: { owner, name },
	} = remoteUrl.match(/[:/](?<owner>.*?)\/(?<name>.*)$/u)

	return {
		branchName,
		remoteName,
		remoteUrl,
		owner,
		name,
	}
}

export const projectInfo = await getProjectInfo()

/**
 * @typedef {(arg1: { project: ProjectInfo }) => Promise<{ description: string, shouldFix: () => Promise<boolean>, fix: () => Promise<void>}>} RuleMaker
 */

/**
 * @param {RuleMaker} ruleMaker
 * @returns {Promise<{ applied: boolean }>}
 */
export async function makeRule(ruleMaker) {
	// if (typeof ruleMaker !== 'function') {
	// 	ruleMaker = ruleMaker.fn
	// 	for (const dep of (deps ?? [])) {
	// 		if (!dep.applied) {
	// 			console.info(`DEPENDENCY FAILED: ${dep.description}`)
	// 		}
	// 	}
	// }
	const { id, description, shouldFix, fix } = await ruleMaker({ project: projectInfo })


	if (await shouldFix()) {
		console.info(`ASSERTION FAILED: ${description}`)

		if (typeof fix === 'function') {
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			})
			const input = await rl.question(`Would you like to fix this? `)
			if (yn(input)) {
				await fix()

				return { applied: true, description }
			}
			rl.close()
		} else {
			console.log(chalk.red(`No fix available`))
		}

		return { applied: false, description }
	}

	return { applied: true, description }
}
