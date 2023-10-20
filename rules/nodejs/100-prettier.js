import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import { makeRule, pkgRoot } from '../../util/util.js'

export async function rule() {
	const prettierFile = path.join(pkgRoot('@hyperupcall/configs'), '.prettierrc.json')
	const prettierConfig = await fs.readFile(prettierFile, 'utf-8')

	await makeRule(
		'File must exist: .prettierrc.json',
		() => {
			return fs
				.stat('.prettierrc.json')
				.then(() => false)
				.catch(() => true)
		},
		async () => {
			await fs.writeFile('.prettierrc.json', prettierConfig)
		},
	)

	await makeRule(
		'File must have the correct text: .prettierrc.json',
		async () => {
			return (await fs.readFile('.prettierrc.json', 'utf-8')) !== prettierConfig
		},
		async () => {
			await fs.writeFile('.prettierrc.json', prettierConfig)
		}
	)

	const packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	const packageJson = JSON.parse(packageJsonText)
	await makeRule(
		'package.json missing dependencies for: prettier',
		async () => {
			const prettierDeps = ['prettier', '@hyperupcall/prettier-config', 'prettier-plugin-pkg']
			const devDependencies = Object.keys(packageJson.devDependencies)

			return devDependencies.length !== devDependencies.concat(prettierDeps).length
		},
		async () => {
			const packageJsonModified = structuredClone(packageJson)
			packageJsonModified.devDependencies = {
				...packageJsonModified.devDependencies,
				prettier: '^3.0.3',
				'@hyperupcall/prettier-config': '^0.7.0',
				'prettier-plugin-pkg': '^0.18.0'
			}
			await fs.writeFile(
				'package.json',
				JSON.stringify(packageJsonModified, null, detectIndent(packageJsonText).indent || '\t')
			)
			console.log(`Now, run: 'npm i`)
		}
	)
}
