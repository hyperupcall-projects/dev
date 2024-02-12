import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists, pkgRoot } from '../../../util.js'

/** @type {import('../../../../index.js').CreateRules} */
export const createRules = async function createRules({ project }) {
	const configFile = 'LICENSE'
	const configPath = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
	const configContent = await fs.readFile(configPath, 'utf-8')

	return [
		{
			id: 'readme-exists',
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
		},
		{
			id: 'readme-has-title',
			deps: [() => fileExists(configFile)],
			async shouldFix() {
				// TODO
				if (await fileExists('README.md')) {
					return !(await fs.readFile('README.md', 'utf-8')).match(`^# ${project.name}`)
				}
			},
		},
	]
}
