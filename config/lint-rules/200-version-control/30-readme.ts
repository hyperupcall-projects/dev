import * as fs from 'node:fs/promises'
import { globby } from 'globby'
import * as clack from '@clack/prompts'

import type { Issues } from '#types'

/**
 * Check if the existing README file conforms to my rules.
 *
 * If the project is tracked with Git, it should have a README file.
 *
 * There must be a single README file, located at `README.md`.
 *
 * See more: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes
 */
export const issues: Issues = async function* issues({ project }) {
	if (project.type === 'only-directory') {
		throw new Error(`Expected project to be associated with a Git repository`)
	}

	// Checks for the ".github" directory
	{
		const files = await globby('.github/*readme*', {
			caseSensitiveMatch: false,
		})
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
				id: 'must-exist',
				message: [
					'Expected to find a single readme file',
					'But, found no readme files',
				],
				fix: () => fs.writeFile('README.md', `# ${project.name}\n`),
			}
		} else if (files.length === 1) {
			if (files[0] !== 'README.md') {
				yield {
					id: 'must-be-uppercase',
					message: [
						'Expected readme file with name of "README.md"',
						`But, found readme file with name of "${files[0]}"`,
					],
					fix: () => fs.rename(files[0], 'README.md'),
				}
			}
		} else if (files.length > 1) {
			yield {
				id: 'must-exist',
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

	let content = await fs.readFile('README.md', 'utf-8').catch((err) => {
		if (err.code === 'ENOENT') return ''
		throw err
	})
	content = content.replace(/^[ \t]*<!--.*?-->[ \t]*\n/s, '');
	const firstLine = content.slice(0, content.indexOf('\n'))
	if (!firstLine.match('^# ')) {
		yield {
			id: 'must-have-matching-title',
			message: [
				'Expected readme file to have a title matching the project name',
				'But, no title was found',
			],
		}
	}
	if (
		!firstLine.toLowerCase().replaceAll(' ', '-').slice(2).match(
			`^(@[a-zA-Z0-9-_]+/)?${project.name}`,
		)
	) {
		yield {
			id: 'must-have-title-that-includes-project-name',
			message: [
				'Expected readme file to have a title that includes the project name',
				'But, no title was found with this name',
			],
			fix: async () => {
				const content = await fs.readFile('README.md', 'utf-8')
				const lines = content.split('\n')

				const newTitle = await clack.text({
					message: 'Enter title:',
					placeholder: lines[0],
					initialValue: lines[0],
				})

				if (clack.isCancel(newTitle)) {
					throw new Error('User cancelled the prompt')
				}

				lines[0] = newTitle
				await fs.writeFile('README.md', lines.join('\n'))
			},
		}
	}
}
