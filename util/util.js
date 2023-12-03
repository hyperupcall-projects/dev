import * as fs from 'node:fs/promises'
import * as readline from 'node:readline/promises'
import * as path from 'node:path'
import detectIndent from 'detect-indent'
import yn from 'yn'
import chalk from 'chalk'
import { execa } from 'execa'

/**
 * @param {string} filepath
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
		return path.dirname(new URL(import.meta.resolve(packageName)).pathname)
	}
}

/**
 * @typedef {object} ProjectInfoPartial1
 * @property {false} gitHasRemote
 * @property {string} branchName
 */

/**
 * @typedef {object} ProjectInfoPartial2
 * @property {true} gitHasRemote
 * @property {string} branchName
 * @property {string} remoteName
 * @property {string} remoteUrl
 * @property {string} owner
 * @property {string} name
 */

/**
 * @typedef {ProjectInfoPartial1 | ProjectInfoPartial2} ProjectInfo
 */

/**
 * @returns {Promise<ProjectInfo | null>}
 */
export async function getProjectInfo() {
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

export const projectInfo = await getProjectInfo()
