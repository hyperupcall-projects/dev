import * as fs from 'node:fs/promises'
import detectIndent from 'detect-indent'
import { execa } from 'execa'
import * as util from 'node:util'
import merge from 'lodash/merge.js'

export async function ruleFileMustExistAndHaveContent({ file, content: shouldContent }) {
	/** @type {string} */
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

/**
 * @typedef ruleJsonFileMustHaveShapeParam
 * @property {string} file
 * @property {Record<string, unknown>} shape
 */

/**
 * @param {ruleJsonFileMustHaveShapeParam} param0
 */
export async function ruleJsonFileMustHaveShape({ file, shape }) {
	if (file.slice(0, 2) === './') {
		file = file.slice(2)
	}
	return {
		id: `file-${file}-has-shape`,
		async shouldFix() {
			const oldJson = JSON.parse(await fs.readFile(file, 'utf-8'))
			const newJson = merge(structuredClone(oldJson), shape)

			return !util.isDeepStrictEqual(oldJson, newJson)
		},
		async fix() {
			const content = await fs.readFile(file, 'utf-8')
			const newJson = merge(JSON.parse(content), shape)

			await fs.writeFile(
				file,
				JSON.stringify(newJson, null, detectIndent(content).indent || '\t'),
			)
		},
	}
}

/**
 * @typedef ruleCheckPackageJsonDependenciesParam
 * @property {string} mainPackageName
 * @property {string[]} packages
 */

/**
 * @param {ruleCheckPackageJsonDependenciesParam} param0
 */
export async function ruleCheckPackageJsonDependencies({ mainPackageName, packages }) {
	async function packageJsonExists() {
		return await fs
			.stat('package.json')
			.then(() => true)
			.catch(() => false)
	}

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
		deps: [packageJsonExists],
		shouldFix() {
			for (const packageName of packages) {
				if (!packageJson?.devDependencies?.[packageName]) {
					return true
				}
			}

			for (let i = 0; i < packages.length; ++i) {
				const packageName = packages[i]
				// TODO: ^, etc. is not always guaranteed
				if (packageJson?.devDependencies?.[packageName].slice(1) !== latestVersions[i]) {
					return true
				}
			}
		},
		async fix() {
			const packageJsonModified = structuredClone(packageJson)
			for (let i = 0; i < packages.length; ++i) {
				const packageName = packages[i]

				// TODO: ^, etc. should not always be done
				packageJsonModified.devDependencies = {
					...packageJsonModified?.devDependencies,
					[packageName]: `^${latestVersions[i]}`,
				}
			}

			await fs.writeFile(
				'package.json',
				JSON.stringify(packageJsonModified, null, detectIndent(packageJsonText).indent),
			)
			console.log(`Now, run: 'npm i`)
		},
	}
}
