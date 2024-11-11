import * as fs from 'node:fs/promises'
import path from 'node:path'

import { pkgRoot } from '../../../common.js'
import { globby } from 'globby'

/**
 * Check if the repository has at least one license.
 *
 * See more: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
 */

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const configPath = path.join(pkgRoot(), 'assets/LICENSE-MPL-2.0')

	// Check that the number and names of licenses are correct
	{
		const files = await globby(['*license*'], { caseSensitiveMatch: false })
		if (files.length === 0) {
			yield {
				message: [
					'Expected to find a license file',
					'But, found no license file was found',
				],
				fix: () => fs.copyFile(configPath, 'LICENSE'),
			}
		} else if (files.length === 1) {
			if (files[0] !== 'LICENSE') {
				yield {
					message: [
						'For a single license file, expected the file to have a name of "LICENSE"',
						`But, found license file with name of "${files[0]}"`,
					],
					fix: () => fs.rename(files[0], 'LICENSE'),
				}
			}
		} else if (files.length > 1) {
			if (files.some((file) => !file.startsWith('LICENSE-'))) {
				yield {
					message: [
						'For multiple license files, expected to find all of their names prefixed with "LICENSE-"',
						'But, found at least one without that prefix',
					],
				}
			}

			// TODO: Check that each license file ends with a valid SPDX license identifier
			// TODO: Check that there is a "# License" section in the README to explain the multiple licenses
		}
	}

	// Check that the contents of the license files are correct
	{
		const files = await globby(['*license*'], { caseSensitiveMatch: false })
		for (const file of files) {
			const content = await fs.readFile(file, 'utf-8')
			if (content.length === 0) {
				yield {
					message: [
						'Expected to find all license files with content',
						`But, found license file "${file}" with no content`,
					],
				}
			}

			// TODO: Check that the content of each license file has the EXACT text of some SPDX license (if not, user should opt-out of this check)
		}
	}
}
