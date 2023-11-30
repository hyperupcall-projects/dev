import * as fs from 'node:fs/promises'
import path from 'node:path'

import { makeRule, pkgRoot } from '../../util/util.js'
import { existsSync } from 'node:fs'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule({ project }) {
	await makeRule(() => {
		return {
			description: 'README.md must exist',
			async shouldFix() {
				return !(
					(await fs
						.stat('README.md')
						.then(() => true)
						.catch(() => false)) ||
					(await fs
						.stat('readme.md')
						.then(() => true)
						.catch(() => false))
				)
			},
			async fix() {
				await fs.writeFile('README.md', `# ${project.name}\n`)
			},
		}
	})

	await makeRule(() => {
		return {
			description: 'README.md must begin with # $repo',
			async shouldFix() {
				// TODO
				if (existsSync('README.md')) {
					return !(await fs.readFile('README.md', 'utf-8')).match(`^# ${project.name}`)
				}
			},
		}
	})
}
