import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import { makeRule, pkgRoot } from '../../util/util.js'
import { execa } from 'execa'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	const prettierFile = path.join(pkgRoot('@hyperupcall/configs'), '.prettierrc.json')
	const prettierConfig = await fs.readFile(prettierFile, 'utf-8')

	await makeRule(() => {
		return {
			description: 'File must exist: .prettierrc.json',
			async shouldFix() {
				return fs
					.stat('.prettierrc.json')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				await fs.writeFile('.prettierrc.json', prettierConfig)
			}
		}
	})

	await makeRule(() => {
		return {
			description: 'File must have the correct text: .prettierrc.json',
			async shouldFix() {
				return (await fs.readFile('.prettierrc.json', 'utf-8')) !== prettierConfig
			},
			async fix() {
				await fs.writeFile('.prettierrc.json', prettierConfig)
			}
		}
	})

	await makeRule(async () => {
		const packageJsonText = await fs.readFile('package.json', 'utf-8')
		/** @type {import('type-fest').PackageJson} */
		const packageJson = JSON.parse(packageJsonText)
		const latestVersionsRaw = await Promise.all([
			await execa('npm', ['view', '--json', 'prettier']),
			await execa('npm', ['view', '--json', 'prettier-plugin-pkg']),
			await execa('npm', ['view', '--json', '@hyperupcall/prettier-config'])
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
			description: 'package.json missing dependencies for: prettier',
			async shouldFix() {
				if (!packageJson.devDependencies.prettier || !packageJson.devDependencies['prettier-plugin-pkg'] || !packageJson.devDependencies['@hyperupcall/prettier-config']) {
					return true
				}

				if (
					packageJson.devDependencies.prettier.slice(1) !== latestVersions[0] ||
					packageJson.devDependencies['prettier-plugin-pkg'].slice(1) !== latestVersions[1] ||
					packageJson.devDependencies['@hyperupcall/prettier-config'].slice(1) !== latestVersions[2]
				) {
					return true
				}
			},
			async fix() {
				const packageJsonModified = structuredClone(packageJson)
				packageJsonModified.devDependencies = {
					...packageJsonModified.devDependencies,
					prettier: `^${latestVersions[0]}`,
					'prettier-plugin-pkg': `^${latestVersions[1]}`,
					'@hyperupcall/prettier-config': `^${latestVersions[2]}`
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
