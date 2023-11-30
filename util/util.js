import * as fs from 'node:fs/promises'
import * as readline from 'node:readline/promises'
import * as path from 'node:path'
import detectIndent from 'detect-indent'
import yn from 'yn'
import chalk from 'chalk'
import { execa } from 'execa'

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

	const { stdout: remoteUrl } = await execa('git', ['remote', 'get-url', `${remoteName}`])

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

const projectInfo = await getProjectInfo()

/**
 * @typedef {(arg1: { project: ProjectInfo }) => Promise<{ description: string, shouldFix: () => Promise<boolean>, fix: () => Promise<void>}>} RuleMaker
 */

/**
 * @param {RuleMaker} ruleMaker
 */
export async function makeRule(ruleMaker) {
	const { description, shouldFix, fix } = await ruleMaker({ project: projectInfo })
	if (!description) throw new TypeError(`Parameter not passed: description`)
	if (!shouldFix) throw new TypeError(`Parameter not passed: shouldFix`)

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
			}
			rl.close()
		} else {
			console.log(chalk.red(`No fix available`))
		}
	}
}

export async function fileMustExistAndHaveContent({ file, content: shouldContent }) {
	let content
	try {
		content = await fs.readFile(file, 'utf-8')
	} catch {}

	return {
		description: `File '${file}' must have content: '${shouldContent}'`,
		shouldFix() {
			return content !== shouldContent
		},
		async fix() {
			await fs.writeFile(file, shouldContent)
		},
	}
}

export async function checkPackageJsonDependencies({ mainPackageName, packages }) {
	const packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	const packageJson = JSON.parse(packageJsonText)

	const latestVersionsObjects = await Promise.all(
		packages.map((packageName) => execa('npm', ['view', '--json', packageName])),
	)
	const latestVersions = latestVersionsObjects.map((result) => {
		if (result.exitCode !== 0) {
			console.log(result.stderr)
			throw new Error(result)
		}

		const obj = JSON.parse(result.stdout)
		return obj['dist-tags'].latest
	})

	return {
		description: `File 'package.json' is missing dependencies for package: ${mainPackageName}`,
		shouldFix() {
			for (const packageName of packages) {
				if (!packageJson?.devDependencies[packageName]) {
					return true
				}
			}

			for (let i = 0; i < packages.length; ++i) {
				const packageName = packages[i]
				// TODO: ^, etc. is not always guaranteed
				if (packageJson?.devDependencies[packageName].slice(1) !== latestVersions[i]) {
					return true
				}
			}
		},
		async fix() {
			const packageJsonModified = structuredClone(packageJson)
			for (let i = 0; i < packages.length; ++i) {
				const packageName = packages[i]

				// TODO: ^, etc. should not always be done
				packageJsonModified?.devDependencies = {
					...packageJsonModified?.devDependencies,
					[packageName]: `^${latestVersions[i]}`,
				}
			}

			await fs.writeFile(
				'package.json',
				JSON.stringify(
					packageJsonModified,
					null,
					detectIndent(packageJsonText).indent || '\t',
				),
			)
			console.log(`Now, run: 'npm i`)
		},
	}
}
