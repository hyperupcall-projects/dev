// SPDX-License-Identifier: MPL-2.0
import { globby } from 'globby'

/**
 * Check if the repository does not have a code of conduct file. All code of conduct
 * files should be defined in the organization's ".github" repository.
 *
 * See more: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project
 * See more: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
 */

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const files = await globby(
		['*code_of_conduct*', '.github/*code_of_conduct*', 'docs/*code_of_conduct*'],
		{ caseSensitiveMatch: false },
	)
	if (files.length > 0) {
		yield {
			message: [
				'Expected to find no code of conduct files',
				'But, found at least one',
				`Found files: ${new Intl.ListFormat('en').format(files.map((file) => `"${file}"`))}`,
			],
		}
	}
}
