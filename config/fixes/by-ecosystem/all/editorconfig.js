// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { fileExists, pkgRoot } from '../../../../fix/util.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const configFile = '.editorconfig'
	const configPath = path.join(pkgRoot('@hyperupcall/configs'), configFile)
	const configContent = await fs.readFile(configPath, 'utf-8')

	if (!await fileExists(configFile)) {
		yield {
			title: `EditorConfig file "${configFile}" must exist`,
			fix: () => fs.writeFile(configFile, configContent)
		}
	}


	const content = await fs.readFile(configFile, 'utf-8')
	if (content.length === 0) {
		yield {
			title: `EditorConfig file "${configFile}" must not be empty`,
			fix: () => fs.writeFile(configFile, configContent)
		}
	}
}
