// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'

import { fileExists } from '../../../util.js'

/** @type {import('../../../../index.js').CreateRules} */
export const createRules = async function createRules() {
	return [
		{
			id: 'code-of-conduct-exists',
			async shouldFix() {
				if (await fileExists('CODE_OF_CONDUCT.md')) {
					const content = await fs.readFile('CODE_OF_CONDUCT.md', 'utf-8')
					if (content.startsWith('\n')) {
						return true
					}

					return false
				}
			},
		},
	]
}
