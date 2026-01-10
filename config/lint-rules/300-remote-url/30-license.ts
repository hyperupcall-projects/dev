import * as fs from 'node:fs/promises'
import path from 'node:path'
import spdxLicenseList from 'spdx-license-list/full.js'
import * as inquirer from '@inquirer/prompts'

import { pkgRoot } from '#common'
import { globby } from 'globby'

/**
 * Check that the repository has at least one license.
 *
 * See more: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
 */

import type { Issues } from '#types'
import { styleText } from 'node:util'
export const issues: Issues = async function* issues() {
	// Check that the number and names of licenses are correct
	{
		const files = await globby(['*license*'], { caseSensitiveMatch: false })
		if (files.length === 0) {
			yield {
				message: [
					'Expected to find a license file',
					'But, found no license file was found',
				],
				fix: async () => {
					const selectedLicenseId = await inquirer.select(
						{
							message: 'Choose file:',
							choices: [
								{ name: 'ISC License', value: 'ISC' },
								{
									name: 'BSD 3-Clause "New" or "Revised" License',
									value: 'BSD-3-Clause',
								},
								{
									name: 'Mozilla Public License 2.0',
									value: 'MPL-2.0',
								},
								{ name: 'Apache License 2.0', value: 'Apache-2.0' },
								{
									name: 'GNU General Public License v2.0',
									value: 'GPL-2.0-only',
								},
								{
									name: 'GNU General Public License v3.0',
									value: 'GPL-3.0-only',
								},
								{
									name: 'GNU Lesser General Public License v2.1',
									value: 'LGPL-2.1-only',
								},
								{
									name: 'GNU Lesser General Public License v3.0',
									value: 'LGPL-3.0-only',
								},
								{
									name: 'GNU Affero General Public License v3.0',
									value: 'AGPL-3.0-only',
								},
							],
						},
						{ clearPromptOnDone: true },
					)

					const licenseData = spdxLicenseList[selectedLicenseId]
					if (!licenseData) {
						throw new Error(
							`License "${selectedLicenseId}" is not an SPDX license`,
						)
					}

					await fs.writeFile('LICENSE', licenseData.licenseText, 'utf-8')
				},
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
