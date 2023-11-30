import * as fs from 'node:fs/promises'
import path from 'node:path'

import { pkgRoot } from '../../util/util.js'
import { existsSync } from 'node:fs'

/** @type {import('../../util/util.js').CreateRules} */
export async function createRules({ project }) {
	const configFile = 'LICENSE'
	const configPath = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
	const configContent = await fs.readFile(configPath, 'utf-8')

	function fileExists(file) {
		return fs
			.stat(file)
			.then(() => true)
			.catch(() => false)
	}

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
			}
		},
		{
			id: 'readme-has-title',
			deps: [() => fileExists(configFile)],
			async shouldFix() {
				// TODO
				if (existsSync('README.md')) {
					return !(await fs.readFile('README.md', 'utf-8')).match(`^# ${project.name}`)
				}
			}
		}
	]
}
