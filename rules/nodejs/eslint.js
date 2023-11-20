import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import { makeRule, pkgRoot } from '../../util/util.js'
import { execa } from 'execa'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	const eslintFile = path.join(pkgRoot('@hyperupcall/configs'), '.eslintrc.json')
	const eslintConfig = await fs.readFile(eslintFile, 'utf-8')

	await makeRule(() => {
		return {
			description: 'File must exist: .eslintrc.json',
			async shouldFix() {
				return fs
					.stat('.eslintrc.json')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				await fs.writeFile('.eslintrc.json', eslintConfig)
			}
		}
	})

	await makeRule(() => {
		return {
			description: 'File must have the correct text: .eslintrc.json',
			async shouldFix() {
				return (await fs.readFile('.eslintrc.json', 'utf-8')) !== eslintConfig
			},
			async fix() {
				await fs.writeFile('.eslintrc.json', eslintConfig)
			}
		}
	})

	await makeRule(async () => {
		const packageJsonText = await fs.readFile('package.json', 'utf-8')
		/** @type {import('type-fest').PackageJson} */
		const packageJson = JSON.parse(packageJsonText)
		const latestVersionsRaw = await Promise.all([
			await execa('npm', ['view', '--json', 'eslint']),
			await execa('npm', ['view', '--json', 'eslint-config-prettier']),
			await execa('npm', ['view', '--json', '@hyperupcall/eslint-config'])
		])
		const latestVersions = latestVersionsRaw.map((item) => {
			if (item.exitCode !== 0) {
				console.error(item.stderr)
				return 'UNKNOWN'
			}

			const obj = JSON.parse(item.stdout)
			return obj['dist-tags'].latest
		})

		return {
			description: 'package.json missing dependencies for: eslint',
			async shouldFix() {
				if (!packageJson.devDependencies.eslint || !packageJson.devDependencies['eslint-config-prettier'] || !packageJson.devDependencies['@hyperupcall/eslint-config']) {
					return true
				}

				if (
					packageJson.devDependencies.eslint.slice(1) !== latestVersions[0] ||
					packageJson.devDependencies['eslint-config-prettier'].slice(1) !== latestVersions[1] ||
					packageJson.devDependencies['@hyperupcall/eslint-config'].slice(1) !== latestVersions[2]
				) {
					return true
				}
			},
			async fix() {
				const packageJsonModified = structuredClone(packageJson)
				packageJsonModified.devDependencies = {
					...packageJsonModified.devDependencies,
					eslint: `^${latestVersions[0]}`,
					'eslint-config-prettier': `^${latestVersions[1]}`,
					'@hyperupcall/eslint-config': `^${latestVersions[2]}`
				}
				await fs.writeFile(
					'package.json',
					JSON.stringify(packageJsonModified, null, detectIndent(packageJsonText).indent || '\t')
				)
				console.log(`Now, run: 'npm i`)
			}
		}
	})
}
