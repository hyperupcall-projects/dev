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
