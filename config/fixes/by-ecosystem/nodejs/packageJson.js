import * as fs from 'node:fs/promises'

import { octokit } from '../../../../fix/util.js'
import detectIndent from 'detect-indent'
import { filesMustHaveShape } from '../../../../fix/rules.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues({ project }) {
	const bugsUrl = `https://github.com/${project.owner}/${project.name}/issues`
	const gitUrl = `https://github.com/${project.owner}/${project.name}.git`

	const packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	const packageJson = JSON.parse(packageJsonText)
	if (typeof packageJson?.private !== 'boolean') {
		yield {
			title: '"private" field must be specified in package.json',
			fix
		}
	}

	async fix() {
		const packageJsonText = await fs.readFile('package.json', 'utf-8')
		/** @type {import('type-fest').PackageJson} */
		const packageJson = JSON.parse(packageJsonText)

		packageJson.private = true
		await fs.writeFile(
			'package.json',
			JSON.stringify(packageJson, null, detectIndent(packageJsonText).indent),
		)
	}

	/** @type {import('type-fest').PackageJson} */
	const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
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

	const packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	const packageJson = JSON.parse(packageJsonText)

	if (
		!packageJson?.private &&
		(!Array.isArray(packageJson.keywords) || packageJson.keywords.length === 0)
	) {
		yield {
			title: "Must not have empty keywords if public"
		}
	}
}
