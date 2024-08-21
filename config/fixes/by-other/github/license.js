import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists, pkgRoot } from '../../../../fix/util.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const configFile = 'LICENSE'
	const configPath = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')
	const configContent = await fs.readFile(configPath, 'utf-8')


	if (!(await fileExists(configFile))) {
		yield {
			title: 'License must exist',
			fix: () => fs.writeFile(configFile, configContent)
		}
	}

	const content = await fs.readFile(configFile, 'utf-8')
	if (content.length === 0) {
		yield {
			title: 'License must not be empty',
			fix: () => fs.writeFile(configFile, configContent)
		}
	}
}
