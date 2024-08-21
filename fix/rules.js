import * as fs from 'node:fs/promises'
import detectIndent from 'detect-indent'
import { execa } from 'execa'
import * as util from 'node:util'
import * as _ from 'lodash-es'
import { fileExists } from './util.js'

/**
 * @typedef {import('../index.js')} Rule
 */

/**
 * @param {Record<string, null | string>} mapping
 * @returns {AsyncGenerator<Rule>}
 */
export async function* filesMustHaveContent(mapping) {
	for (let file in mapping) {
		const expectedContent = mapping[file]

		if (file.slice(0, 2) === './') {
			file = file.slice(2)
		}

		if (expectedContent === null) {
			yield {
				title: `File "${file}" must not exist`,
				fix: () => fs.rm(file)
			}
		} else {
			const content = await fs.readFile(file, 'utf-8')
			if (content !== expectedContent) {
				yield {
					title: `File "${file}" must have content: "${expectedContent}"`,
					fix: () => fs.writeFile(file, expectedContent)
				}
			}
		}
	}
}

/**
 * @param {Record<string, Record<string, unknown>>} mapping
 * @returns {AsyncGenerator<Rule>}
 */
export async function* filesMustHaveShape(mapping) {
	for (let file in mapping) {
		const shape = mapping[file]

		if (file.slice(0, 2) === './') {
			file = file.slice(2)
		}

		/**
		 * @param {Record<string, Record<string, unknown>>} object
		 * @param {Record<string, unknown>} shape
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

		yield {
			async issues() {
				return !util.isDeepStrictEqual(expectedObject, actualObject)
			},
			printInfo() {
				console.log(`File "${file}" must have the correct shape`)
			},
			async fix() {
				await fs.writeFile(
					file,
					JSON.stringify(expectedObject, null, detectIndent(content).indent || '\t'),
				)
			},
		}
	}
}

/**
 * @typedef ruleCheckPackageJsonDependenciesParam
 * @property {string[]} packages
 *
 * @param {ruleCheckPackageJsonDependenciesParam} param0
 * @returns {AsyncGenerator<Rule>}
 */
export async function* ruleCheckPackageJsonDependencies({ packages }) {
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

	let shouldFix = false
	for (const packageName of packages) {
		if (!packageJson?.devDependencies?.[packageName]) {
			shouldFix = true
		}
	}

	for (let i = 0; i < packages.length; ++i) {
		const packageName = packages[i]
		// TODO: ^, etc. is not always guaranteed
		if (packageJson?.devDependencies?.[packageName].slice(1) !== latestVersions[i]) {
			shouldFix = true
		}
	}


	if (shouldFix) {
		yield {
			title: `File 'package.json' is missing dependencies for package`,
			fix
		}
	}

	async function fix() {
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
	}
}

/**
 * @typedef ruleCheckPackageJsonDependenciesParam2
 * @property {string} mainPackageName
 * @property {Record<string, string | null>} packages
 *
 * @param {ruleCheckPackageJsonDependenciesParam2} param0
 * @returns {AsyncGenerator<Rule>}
 */
export async function* ruleCheckPackageJsonDependencies2({ mainPackageName, packages }) {
	const packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	const packageJson = JSON.parse(packageJsonText)

	let shouldFix = false
	for (const [packageName, packageValue] of Object.entries(packages)) {
		if (!packageJson?.devDependencies?.[packageName] && packageValue !== null) {
			shouldFix = true
		}
	}

	for (const [packageName, packageValue] of Object.entries(packages)) {
		if (packageJson?.devDependencies?.[packageName] && packageValue === null) {
			shouldFix = true
		}
	}

	if (shouldFix) {
		yield {
			title: `File 'package.json' is missing dependencies2 for package: ${mainPackageName}`
		}
	}
}
