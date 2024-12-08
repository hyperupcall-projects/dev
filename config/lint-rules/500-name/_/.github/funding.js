// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'
import { fileExists, filesMustHaveContent, skipHyperupcallFunding } from '#common'

/** @type {import('../../../../../index.js').Issues} */
export const issues = async function* issues({ project }) {
	const fundingFile = 'FUNDING.yml'

	if (!skipHyperupcallFunding.includes(project.owner)) {
		const fundingFileContents = `github: 'hyperupcall'\n`

		if (!(await fileExists(fundingFile))) {
			yield {
				message: ['Expected funding file to exist'],
				fix: () => fs.writeFile(fundingFile, fundingFileContents),
			}
		}

		yield* filesMustHaveContent({
			[fundingFile]: fundingFileContents,
		})
	}
}
