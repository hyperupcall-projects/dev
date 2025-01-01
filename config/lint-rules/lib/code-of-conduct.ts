// SPDX-License-Identifier: MPL-2.0
import { findCodeOfConductFiles } from '#common'

// TODO: What to do with this file?

/**
 * Check if the repository does not have a code of conduct file. If the repository is on GitHub,
 * then the code of conduct file should be defined in the organization's ".github" repository. But,
 * if the repository is not on Github, then there should be no code of conduct files.
 *
 * See more: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-a-code-of-conduct-to-your-project
 * See more: https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
 */

/** @type {import('../../../index.ts').Issues} */
export const issues = async function* issues() {
	const files = await findCodeOfConductFiles()

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
