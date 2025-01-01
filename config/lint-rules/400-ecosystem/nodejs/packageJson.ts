import * as fs from 'node:fs/promises'

import { octokit } from '#common'
import detectIndent from 'detect-indent'
import { filesMustHaveShape } from '#common'

/** @type {import('../../../../index.ts').Issues} */
export const issues = async function* issues({ project }) {
	let packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	let packageJson = JSON.parse(packageJsonText)
	if (typeof packageJson?.private !== 'boolean') {
		yield {
			message: ['"private" field must be specified in package.json'],
			fix,
		}
	}

	async function fix() {
		const packageJsonText = await fs.readFile('package.json', 'utf-8')
		/** @type {import('type-fest').PackageJson} */
		const packageJson = JSON.parse(packageJsonText)

		packageJson.private = true
		await fs.writeFile(
			'package.json',
			JSON.stringify(packageJson, null, detectIndent(packageJsonText).indent),
		)
	}

	packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
	if (packageJson.private) {
		yield* filesMustHaveShape({
			'package.json': {
				author: { __delete: null },
				bugs: { __delete: null },
				repository: { __delete: null },
			},
		})
	} else {
		yield* filesMustHaveShape({
			'package.json': {
				author: 'Edwin Kofler <edwin@kofler.dev> (https://edwinkofler.com)',
				bugs: {
					url: `https://github.com/${project.owner}/${project.name}/issues`,
				},
				repository: {
					type: 'git',
					url: `https://github.com/${project.owner}/${project.name}`,
				},
			},
		})
	}

	packageJsonText = await fs.readFile('package.json', 'utf-8')
	packageJson = JSON.parse(packageJsonText)
	if (
		!packageJson?.private &&
		(Array.isArray(packageJson.keywords) ? packageJson.keywords.length === 0 : false)
	) {
		yield {
			message: ['Must not have empty keywords if public'],
		}
	}
}
