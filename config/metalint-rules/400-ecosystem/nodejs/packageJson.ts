import * as fs from 'node:fs/promises'
import { octokit } from '#utilities/util.ts'
import detectIndent from 'detect-indent'
import { filesMustHaveShape } from '#utilities/metalint-utils.ts'
import type { PackageJson } from 'type-fest'

import type { Issues } from '#types'
export const issues: Issues = async function* issues({ project }) {
	let packageJsonText = await fs.readFile('package.json', 'utf-8')
	let packageJson: PackageJson = JSON.parse(packageJsonText)
	if (typeof packageJson?.private !== 'boolean') {
		yield {
			id: 'must-specify-private',
			message: ['"private" field must be specified in package.json'],
			fix,
		}
	}

	async function fix() {
		const packageJsonText = await fs.readFile('package.json', 'utf-8')
		const packageJson: PackageJson = JSON.parse(packageJsonText)

		packageJson.private = true
		await fs.writeFile(
			'package.json',
			JSON.stringify(packageJson, null, detectIndent(packageJsonText).indent),
		)
	}

	packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
	if (project.type === 'with-remotevcs') {
		if (packageJson.private) {
			yield* filesMustHaveShape('package-json', {
				'package.json': {
					author: { __delete: null },
					bugs: { __delete: null },
					repository: { __delete: null },
				},
			})
		} else {
			yield* filesMustHaveShape('package-json', {
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
	} else {
		yield* filesMustHaveShape('package-json', {
			'package.json': {
				author: { __delete: null },
				bugs: { __delete: null },
				repository: { __delete: null },
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
			id: 'public-package-must-have-keywords',
			message: ['Must not have empty keywords if public'],
		}
	}
}
