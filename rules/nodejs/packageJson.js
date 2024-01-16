import * as fs from 'node:fs/promises'

import { octokit } from '../../util/octokit.js'
import detectIndent from 'detect-indent'
import {
	ruleJsonFileMustHaveShape,
	ruleJsonFileMustHaveShape2,
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export const createRules = async function createRules({ project }) {
	const bugsUrl = `https://github.com/${project.owner}/${project.name}/issues`
	const gitUrl = `https://github.com/${project.owner}/${project.name}.git`

	return [
		{
			id: 'private-must-be-specified',
			async shouldFix() {
				const packageJsonText = await fs.readFile('package.json', 'utf-8')
				/** @type {import('type-fest').PackageJson} */
				const packageJson = JSON.parse(packageJsonText)

				return typeof packageJson?.private !== 'boolean'
			},
			async fix() {
				const packageJsonText = await fs.readFile('package.json', 'utf-8')
				/** @type {import('type-fest').PackageJson} */
				const packageJson = JSON.parse(packageJsonText)

				packageJson.private = true
				await fs.writeFile(
					'package.json',
					JSON.stringify(packageJson, null, detectIndent(packageJsonText).indent),
				)
			},
		},
		{
			deps: [() => true],
			...(await (async () => {
				/** @type {import('type-fest').PackageJson} */
				const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
				if (packageJson.private === true) {
					return await ruleJsonFileMustHaveShape2({
						file: 'package.json',
						shape: {
							author: { __delete: null },
							scripts: {
								format: 'prettier --check .',
								lint: 'eslint .',
							},
							bugs: { __delete: null },
							repository: { __delete: null },
						},
					})
				}

				return await ruleJsonFileMustHaveShape({
					file: 'package.json',
					shape: {
						author: 'Edwin Kofler <edwin@kofler.dev> (https://edwinkofler.com)',
						scripts: {
							format: 'prettier --check .',
							lint: 'eslint .',
						},
						bugs: {
							url: bugsUrl,
						},
						repository: {
							type: 'git',
							url: gitUrl,
						},
					},
				})
			})()),
		},
		{
			id: 'must-not-have-empty-keywords-if-public',
			async shouldFix() {
				const packageJsonText = await fs.readFile('package.json', 'utf-8')
				/** @type {import('type-fest').PackageJson} */
				const packageJson = JSON.parse(packageJsonText)

				return (
					!packageJson?.private &&
					(!Array.isArray(packageJson.keywords) || packageJson.keywords.length === 0)
				)
			},
		},
	]
}
