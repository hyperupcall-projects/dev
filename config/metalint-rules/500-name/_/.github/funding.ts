// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'
import YAML from 'yaml'
import { fileExists } from '#utilities/util.ts'
import {
	filesMustHaveContent,
	skipHyperupcallFunding,
} from '#utilities/metalint-utils.ts'

import type { Issues } from '#types'
export const issues: Issues = async function* issues({ project, config }) {
	const fundingFile = 'FUNDING.yml'
	if (project.type !== 'with-remotevcs') {
		throw new Error('Expected project to be associated with a remote forge')
	}

	if (!skipHyperupcallFunding.includes(project.owner)) {
		const fundingFileContents = YAML.stringify(
			{ github: config.manifest.funding_yml_github },
			{ defaultKeyType: 'PLAIN', defaultStringType: 'QUOTE_SINGLE' },
		)

		if (!(await fileExists(fundingFile))) {
			yield {
				id: 'must-exist',
				message: ['Expected funding file to exist'],
				fix: () => fs.writeFile(fundingFile, fundingFileContents),
			}
		}

		yield* filesMustHaveContent('github-funding', {
			[fundingFile]: fundingFileContents,
		})
	}
}
