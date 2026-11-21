import type { Issues } from '#types'
import { fileExists } from '#utilities/util.ts'
import * as fs from 'node:fs/promises'

// https://github.com/google/yamlfmt/blob/main/docs/command-usage.md#configuration-file
const yamlfmtConfigFiles = [
	'.yamlfmt',
	'.yamlfmt.yaml',
	'.yamlfmt.yml',
	'yamlfmt.yaml',
	'yamlfmt.yml',
]

/**
 * Check that the project does not have any yamlfmt configuration files.
 */
export const issues: Issues = async function* issues() {
	const existingFiles: string[] = []
	for (const file of yamlfmtConfigFiles) {
		if (await fileExists(file)) {
			existingFiles.push(file)
		}
	}

	if (existingFiles.length > 0) {
		yield {
			id: 'yamlfmt-must-not-have-config-files',
			message: [
				'Expected to find no yamlfmt configuration files',
				`But, found ${existingFiles.length} yamlfmt files: ${existingFiles
					.map((file) => `"${file}"`)
					.join(', ')}`,
			],
			fix: async () => {
				await Promise.all(existingFiles.map((file) => fs.rm(file)))
			},
		}
	}
}
