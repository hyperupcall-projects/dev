import type { Issues } from '#types'
import { fileExists } from '#utilities/util.ts'
import * as fs from 'node:fs/promises'

// https://yamllint.readthedocs.io/en/stable/configuration.html
const yamllintConfigFiles = ['.yamllint', '.yamllint.yaml', '.yamllint.yml']

/**
 * Check that the project does not have any yamllint configuration files.
 */
export const issues: Issues = async function* issues() {
	const existingFiles: string[] = []
	for (const file of yamllintConfigFiles) {
		if (await fileExists(file)) {
			existingFiles.push(file)
		}
	}

	if (existingFiles.length > 0) {
		yield {
			id: 'yamllint-must-not-have-config-files',
			message: [
				'Expected to find no yamllint configuration files',
				`But, found ${existingFiles.length} yamllint files: ${existingFiles
					.map((file) => `"${file}"`)
					.join(', ')}`,
			],
			fix: async () => {
				await Promise.all(existingFiles.map((file) => fs.rm(file)))
			},
		}
	}
}
