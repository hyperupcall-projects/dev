import * as fs from 'node:fs/promises'
import path from 'node:path'

import detectIndent from 'detect-indent'

import { pkgRoot } from '../../util/util.js'
import { octokit } from '../../util/octokit.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../util/util.js').CreateRules} */
export async function createRules() {
	let packageJsonText = await fs.readFile('./package.json', 'utf-8')
		/** @type {import('type-fest').PackageJson} */
	let packageJson = JSON.parse(packageJsonText)

	const formatString1 = 'prettier --check .'
	const formatString2 = 'eslint .'

	return [
		{
			id: 'package-json-must-have-format-property',
			async shouldFix() {
				return packageJson?.scripts?.format !== formatString1
			},
			async fix() {
				let packageJsonText = await fs.readFile('./package.json', 'utf-8')
				let packageJson = JSON.parse(packageJsonText)

				let packageJsonModified = {
					...packageJson,
					scripts: {
						...packageJson.scripts,
						format: formatString1,
					},
				}
				await fs.writeFile(
					'package.json',
					JSON.stringify(
						packageJsonModified,
						null,
						detectIndent(packageJsonText).indent || '\t',
					),
				)
			},
		},
		{
			id: 'package-json-must-have-format-property',
			async shouldFix() {
				return packageJson?.scripts?.lint !== formatString2
			},
			async fix() {
				let packageJsonText = await fs.readFile('./package.json', 'utf-8')
				let packageJson = JSON.parse(packageJsonText)

				let packageJsonModified = {
					...packageJson,
					scripts: {
						...packageJson.scripts,
						lint: formatString2,
					},
				}
				await fs.writeFile(
					'package.json',
					JSON.stringify(
						packageJsonModified,
						null,
						detectIndent(packageJsonText).indent || '\t',
					),
				)
			},
		}
	]
}

// 	return
// 	const { data } = await octokit.rest.repos.get({
// 		owner: project.owner,
// 		repo: project.name,
// 	})

// 	await makeRule(async () => {
// 		const packageJsonText = await fs.readFile('package.json', 'utf-8')
// 		/** @type {import('type-fest').PackageJson} */
// 		const packageJson = JSON.parse(packageJsonText)

// 		return {
// 			description: 'package.json must have accurate: description',
// 			async shouldFix() {
// 				return data.description !== packageJson.description
// 			},
// 			async fix() {
// 				let packageJsonModified = {
// 					...packageJson,
// 					description: data.description,
// 				}
// 				await fs.writeFile(
// 					'package.json',
// 					JSON.stringify(
// 						packageJsonModified,
// 						null,
// 						detectIndent(packageJsonText).indent || '\t',
// 					),
// 				)
// 			},
// 		}
// 	})

// 	await makeRule(async () => {
// 		const packageJsonText = await fs.readFile('package.json', 'utf-8')
// 		/** @type {import('type-fest').PackageJson} */
// 		const packageJson = JSON.parse(packageJsonText)
// 		const author = 'Edwin Kofler <edwin@kofler.dev> (https://edwinkofler.com)'

// 		return {
// 			description: 'package.json must have accurate: author',
// 			async shouldFix() {
// 				return packageJson.author !== author
// 			},
// 			async fix() {
// 				let packageJsonModified = {
// 					...packageJson,
// 					author,
// 				}
// 				await fs.writeFile(
// 					'package.json',
// 					JSON.stringify(
// 						packageJsonModified,
// 						null,
// 						detectIndent(packageJsonText).indent || '\t',
// 					),
// 				)
// 			},
// 		}
// 	})

// 	await makeRule(async () => {
// 		const packageJsonText = await fs.readFile('package.json', 'utf-8')
// 		/** @type {import('type-fest').PackageJson} */
// 		const packageJson = JSON.parse(packageJsonText)

// 		// TODO: check license is the same
// 		return {
// 			description: 'package.json must have accurate: license',
// 			async shouldFix() {
// 				return !packageJson.license
// 			},
// 		}
// 	})

// 	await makeRule(async () => {
// 		const packageJsonText = await fs.readFile('package.json', 'utf-8')
// 		/** @type {import('type-fest').PackageJson} */
// 		const packageJson = JSON.parse(packageJsonText)
// 		const bugsUrl = `https://github.com/${project.owner}/${project.name}/issues`

// 		return {
// 			description: 'package.json must have accurate: bugs.url',
// 			async shouldFix() {
// 				return packageJson?.bugs?.url != bugsUrl
// 			},
// 			async fix() {
// 				let packageJsonModified = {
// 					...packageJson,
// 					bugs: {
// 						url: bugsUrl,
// 					},
// 				}
// 				await fs.writeFile(
// 					'package.json',
// 					JSON.stringify(
// 						packageJsonModified,
// 						null,
// 						detectIndent(packageJsonText).indent || '\t',
// 					),
// 				)
// 			},
// 		}
// 	})

// 	await makeRule(async () => {
// 		const packageJsonText = await fs.readFile('package.json', 'utf-8')
// 		/** @type {import('type-fest').PackageJson} */
// 		const packageJson = JSON.parse(packageJsonText)
// 		const gitUrl = `https://github.com/${project.owner}/${project.name}.git`

// 		return {
// 			description: 'package.json must have accurate: repository',
// 			async shouldFix() {
// 				return packageJson?.repository?.url !== gitUrl
// 			},
// 			async fix() {
// 				let packageJsonModified = {
// 					...packageJson,
// 					repository: {
// 						type: 'git',
// 						url: gitUrl,
// 					},
// 				}
// 				await fs.writeFile(
// 					'package.json',
// 					JSON.stringify(
// 						packageJsonModified,
// 						null,
// 						detectIndent(packageJsonText).indent || '\t',
// 					),
// 				)
// 			},
// 		}
// 	})

// 	await makeRule(async () => {
// 		const packageJsonText = await fs.readFile('package.json', 'utf-8')
// 		/** @type {import('type-fest').PackageJson} */
// 		const packageJson = JSON.parse(packageJsonText)

// 		return {
// 			description: 'package.json must not have empty: keywords',
// 			async shouldFix() {
// 				return !Array.isArray(packageJson.keywords) || packageJson.keywords.length === 0
// 			},
// 		}
// 	})
// }
