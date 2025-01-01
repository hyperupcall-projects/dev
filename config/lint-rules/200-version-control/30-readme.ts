import * as fs from 'node:fs/promises'
import path from 'node:path'
import { globby } from 'globby'

import { fileExists, pkgRoot } from '#common'

/**
 * Check if the existing README file conforms to my standards.
 *
 * If the project is tracked with Git, it should have a README file.
 *
 * There must be a single README file, located at `README.md`.
 *
 * See more: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
 */

/** @type {import('../../../index.ts').Issues} */
export const issues = async function* issues({ project }) {
	// Checks for the ".github" directory
	{
		const files = await globby('.github/*readme*', { caseSensitiveMatch: false })
		if (files.length > 0) {
			yield {
				message: [
					'Expected to find a single readme file at the root project directory',
					'But, found readme files in the ".github" directory',
				],
			}
		}
	}

	// Checks for the "." (root project) directory
	{
		const files = await globby('*readme*', { caseSensitiveMatch: false })
		if (files.length === 0) {
			yield {
				message: ['Expected to find a single readme file', 'But, found no readme files'],
				fix: () => fs.writeFile('README.md', `# ${project.name}\n`),
			}
		} else if (files.length === 1) {
			if (files[0] !== 'README.md') {
				yield {
					message: [
						'Expected readme file with name of "README.md"',
						`But, found readme file with name of "${files[0]}"`,
					],
					fix: () => fs.rename(files[0], 'README.md'),
				}
			}
		} else if (files.length > 1) {
			yield {
				message: [
					'Expected to find a single readme file',
					'But, found more than one readme file',
				],
			}
		}
	}

	// Checks for the "docs" directory
	{
		// Do not check. If there is documentation, it is okay for its "README.md"
		// to have different contents.
	}

	const content = await fs.readFile('README.md', 'utf-8')
	if (!content.match('^#')) {
		yield {
			message: [
				'Expected readme file to have a title matching the project name',
				'But, no title was found',
			],
		}
	}
	if (!content.toLowerCase().replaceAll(' ', '-').match(`^#-${project.name}`)) {
		yield {
			message: [
				'Expected readme file to have a title matching the project name',
				'But, no title was found with this name',
			],
		}
	}
}
