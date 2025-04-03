// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { fileExists, pkgRoot } from '#common'
import type { Issues } from '#types'

/**
 * Check that the EditorConfig file exists and has the correct content.
 */

export const issues: Issues = async function* issues({ project }) {
	return // TODO
	const configContent = `ls:
  packages/src:
    .dir: 'kebab-case'
    .js: 'kebab-case'
    .ts: 'kebab-case'
ignore:
  - '.git'
  - 'node_modules'\n`

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
