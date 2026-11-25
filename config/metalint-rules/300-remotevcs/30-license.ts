import * as fs from 'node:fs/promises'
import spdxLicenseList from 'spdx-license-list/full.js'
import type { Issues } from '#types'
import { writeLicense } from '#utilities/license.ts'
import { globby } from 'globby'
import { remark } from 'remark'

/**
 * Check that the repository has at least one license.
 *
 * See more: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
 */

export const issues: Issues = async function* issues({ project }) {
	if (project.type !== 'with-remotevcs') {
		throw new Error(`Expected project to be associated with a remote forge`)
	}

	// Check that the number and names of licenses are correct
	{
		const files = await globby(['*license*'], { caseSensitiveMatch: false })
		if (files.length === 0) {
			yield {
				id: 'must-have-license-file',
				message: [
					'Expected to find a license file',
					'But, found no license file was found',
				],
				fix: writeLicense,
			}
		} else if (files.length === 1) {
			if (files[0] !== 'LICENSE') {
				yield {
					id: 'must-have-license-file',
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
					id: 'must-have-license-file',
					message: [
						'For multiple license files, expected to find all of their names prefixed with "LICENSE-"',
						'But, found at least one without that prefix',
					],
				}
			}

			for (const file of files) {
				if (!file.startsWith('LICENSE-')) continue

				const licenseId = file.slice('LICENSE-'.length)
				if (!Object.hasOwn(spdxLicenseList, licenseId)) {
					yield {
						id: 'must-have-valid-spdx-identifier',
						message: [
							'For license files that include a SPDX identifier, expected each filename to end with a valid SPDX license identifier',
							`But, license file "${file}" has an invalid identifier of "${licenseId}"`,
						],
					}
				}
			}

			const readmeContent = await fs.readFile('README.md', 'utf-8').catch((err) => {
				if (err.code === 'ENOENT') return ''
				throw err
			})
			const hasLicenseSection = remark()
				.parse(readmeContent)
				.children.some(
					(node) =>
						node.type === 'heading' &&
						node.children.length === 1 &&
						node.children[0].type === 'text' &&
						node.children[0].value === 'License',
				)
			if (!hasLicenseSection) {
				yield {
					id: 'must-have-readme-license-section',
					message: [
						'For multiple license files, expected README.md to have a "License" section explaining how the licenses apply',
						'But, no "License" section was found',
					],
				}
			}
		}
	}

	// Check that the contents of the license files are correct
	{
		const files = await globby(['*license*'], { caseSensitiveMatch: false })
		for (const file of files) {
			const content = await fs.readFile(file, 'utf-8')
			if (content.length === 0) {
				yield {
					id: 'must-have-content',
					message: [
						'Expected to find all license files with content',
						`But, found license file "${file}" with no content`,
					],
				}
			}
		}
	}
}
