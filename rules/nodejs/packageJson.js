import * as fs from 'node:fs/promises'

import { octokit } from '../../util/octokit.js'
import {
	ruleJsonFileMustHaveHierarchy
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export async function createRules({ project }) {
	const bugsUrl = `https://github.com/${project.owner}/${project.name}/issues`
	const gitUrl = `https://github.com/${project.owner}/${project.name}.git`

	return [
		await ruleJsonFileMustHaveHierarchy({
			file: './package.json',
			hierarchy: {
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
		}),
		{
			id: 'must-not-have-empty-keywords',
			async shouldFix() {
				const packageJsonText = await fs.readFile('package.json', 'utf-8')
				/** @type {import('type-fest').PackageJson} */
				const packageJson = JSON.parse(packageJsonText)

				return !Array.isArray(packageJson.keywords) || packageJson.keywords.length === 0
			}
		},
		// TODO
		// {
		// 	id: 'blah',
		// 	...((async () => {
		// 		const { data } = await octokit.rest.repos.get({
		// 			owner: project.owner,
		// 			repo: project.name,
		// 		})

		// 		return await ruleJsonFileMustHaveHierarchy({
		// 			file: './package.json',
		// 			hierarchy: {
		// 				description: data.description
		// 			}
		// 		})
		// 	})())
		// }
	]
}
