import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists, pkgRoot } from '../../../../fix/util.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues({ project }) {
	const configFile = 'LICENSE'
	const configPath = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
	const configContent = await fs.readFile(configPath, 'utf-8')


	if (!fileExists('README.md') && !fileExists('readme.md')) {
		yield {
			title: 'Readme must exist',
			fix: () => fs.writeFile('README.md', `# ${project.name}\n`)
		}
	}

	const content = await fs.readFile('README.md', 'utf-8')
	if (!(content).match(`^# ${project.name}`)) {
		yield {
			title: 'Readme must have title'
		}
	}
}
