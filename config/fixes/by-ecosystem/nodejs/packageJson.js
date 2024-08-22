import * as fs from 'node:fs/promises'

import { octokit } from '../../../../fix/util.js'
import detectIndent from 'detect-indent'
import { filesMustHaveShape } from '../../../../fix/rules.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues({ project }) {
	const bugsUrl = `https://github.com/${project.owner}/${project.name}/issues`
	const gitUrl = `https://github.com/${project.owner}/${project.name}.git`

	let packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	let packageJson = JSON.parse(packageJsonText)
	if (typeof packageJson?.private !== 'boolean') {
		yield {
			message: ['"private" field must be specified in package.json'],
			fix
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
	if (packageJson.private === true) {
		yield *filesMustHaveShape({
			'package.json': {
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

	yield* filesMustHaveShape({
		'package.json': {
			author: 'Edwin Kofler <edwin@kofler.dev> (https://edwinkofler.com)',
			bugs: {
				url: bugsUrl,
			},
			repository: {
				type: 'git',
				url: gitUrl,
			},
		},
	})

	packageJsonText = await fs.readFile('package.json', 'utf-8')
	packageJson = JSON.parse(packageJsonText)

	if (
		!packageJson?.private &&
		(!Array.isArray(packageJson.keywords) || packageJson.keywords.length === 0)
	) {
		yield {
			message: ["Must not have empty keywords if public"]
		}
	}
}
