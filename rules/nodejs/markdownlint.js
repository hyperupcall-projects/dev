import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import { makeRule, pkgRoot } from '../../util/util.js'
import { execa } from 'execa'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	await makeRule(() => {
		return {
			description: 'File must exist: .markdownlint.json',
			async shouldFix() {
				return fs
					.stat('.markdownlint.json')
					.then(() => false)
					.catch(() => true)
			},
			async fix() {
				await fs.writeFile('.markdownlint.json', markdownlintConfig)
			}
		}
	})

	const markdownlintFile = path.join(pkgRoot('@hyperupcall/configs'), '.markdownlint.json')
	const markdownlintConfig = await fs.readFile(markdownlintFile, 'utf-8')

	await makeRule(() => {

		return {
			description: 'File must have the correct text: .markdownlint.json',
			async shouldFix() {
				return (await fs.readFile('.markdownlint.json', 'utf-8')) !== markdownlintConfig
			},
			async fix() {
				await fs.writeFile('.markdownlint.json', markdownlintConfig)
			}
		}
	})

	await makeRule(async () => {
		const packageJsonText = await fs.readFile('package.json', 'utf-8')
		/** @type {import('type-fest').PackageJson} */
		const packageJson = JSON.parse(packageJsonText)
		const latestVersionsRaw = await Promise.all([
			await execa('npm', ['view', '--json', 'markdownlint']),
			await execa('npm', ['view', '--json', '@hyperupcall/markdownlint-config'])
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
			description: 'package.json missing dependencies for: markdownlint',
			async shouldFix() {
				if (!packageJson.devDependencies.markdownlint || !packageJson.devDependencies['@hyperupcall/markdownlint-config']) {
					return true
				}

				if (
					packageJson.devDependencies.markdownlint.slice(1) !== latestVersions[0] ||
					packageJson.devDependencies['@hyperupcall/markdownlint-config'].slice(1) !== latestVersions[1]
				) {
					return true
				}
			},
			async fix() {
				const packageJsonModified = structuredClone(packageJson)
				packageJsonModified.devDependencies = {
					...packageJsonModified.devDependencies,
					markdownlint: `^${latestVersions[0]}`,
					'@hyperupcall/markdownlint-config': `^${latestVersions[1]}`
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
