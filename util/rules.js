import * as fs from 'node:fs/promises'
import detectIndent from 'detect-indent'
import { execa } from 'execa'
import * as util from 'node:util'
import _ from 'lodash'
import { fileExists } from './util.js'

export async function filesMustNotExist({ id, files }) {
	return {
		id,
		async shouldFix() {
			return (
				await Promise.all(
					files.map((file) => {
						return fs
							.stat(file)
							.then(() => true)
							.catch(() => false)
					}),
				)
			).some((item) => item)
		},
		async fix() {
			return await Promise.all(
				files.map((file) => {
					return fs.rm(file)
				}),
			).catch((err) => {
				if (err.code === 'ENOENT') {
					return
				}
				throw err
			})
		},
	}
}

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
 *
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
			const newJson = _.merge(structuredClone(oldJson), shape)

			return !util.isDeepStrictEqual(oldJson, newJson)
		},
		async fix() {
			const content = await fs.readFile(file, 'utf-8')
			const newJson = _.merge(JSON.parse(content), shape)

			await fs.writeFile(
				file,
				JSON.stringify(newJson, null, detectIndent(content).indent || '\t'),
			)
		},
	}
}

/**
 * @typedef ruleJsonFileMustHaveShape2Param
 * @property {string} file
 * @property {Record<string, Record<string, unknown>>} shape
 *
 * @param {ruleJsonFileMustHaveShape2Param} param0
 */
export async function ruleJsonFileMustHaveShape2({ file, shape }) {
	if (file.slice(0, 2) === './') {
		file = file.slice(2)
	}

	/**
	 * @param {Record<string, Record<string, unknown>>} object
	 * @param {Record<string, Record<string, unknown>>} shape
	 * @returns {Record<string, unknown>}
	 */
	function merge(object, shape) {
		for (const [propChain, propValue] of Object.entries(shape)) {
			if (Object.hasOwn(propValue, '__delete')) {
				object = _.omit(object, propChain)
			} else if (Object.hasOwn(propValue, '__replace')) {
				_.set(object, propChain, propValue)
			} else {
				// __merge, the default.
				const obj = _.get(object, propChain)
				if (obj === undefined) {
					_.set(object, propChain, propValue)
				} else {
					_.merge(obj, propValue)
				}
			}
		}

		return object
	}

	const content = await fs.readFile(file, 'utf-8')
	const actualObject = JSON.parse(content)
	const expectedObject = merge(structuredClone(actualObject), shape)

	return {
		id: `file-${file}-has-shape2`,
		async shouldFix() {
			return !util.isDeepStrictEqual(expectedObject, actualObject)
		},
		async fix() {
			await fs.writeFile(
				file,
				JSON.stringify(expectedObject, null, detectIndent(content).indent || '\t'),
			)
		},
	}
}

/**
 * @typedef ruleCheckPackageJsonDependenciesParam
 * @property {string} mainPackageName
 * @property {string[]} packages
 *
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
