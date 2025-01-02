// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { fileExists, pkgRoot } from '#common'
import type { Issues } from '#types'

/**
 * Check that the EditorConfig file exists and has the correct content.
 */

export const issues: Issues = async function* issues({ project }) {
	const configFile = '.ls-lint.yml'
	const configPath = path.join(pkgRoot(), 'config', configFile)
	const configContent = await fs.readFile(configPath, 'utf-8')

	if (!(await fileExists(configFile))) {
		yield {
			message: [`Expected ls-lint file "${configFile}" to exist`],
			fix: () => fs.writeFile(configFile, configContent),
		}
	}

	const content = await fs.readFile(configFile, 'utf-8')
	if (content.length === 0) {
		yield {
			message: [`Expected ls-lint file "${configFile}" to not be empty`],
			fix: () => fs.writeFile(configFile, configContent),
		}
	}
}
