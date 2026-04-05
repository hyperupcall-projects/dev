import * as fs from 'node:fs/promises'
import path from 'node:path'
import { fileExists } from '#common'
import { globby } from 'globby'
import type { Issues } from '#types'

export const issues: Issues = async function* issues({ project }) {
	if (project.type !== 'with-remote-url') {
		throw new Error(`Expected project to be associated with a remote forge`)
	}

	const workflowsDir = '.github/workflows'

	if (!(await fileExists(workflowsDir))) {
		return
	}

	const yamlFiles = await globby(['*.yml'], { cwd: workflowsDir })

	if (yamlFiles.length > 0) {
		yield {
			message: [
				`Expected GitHub workflow files to use ".yaml" extension`,
				`But, found ${yamlFiles} file with ".yml" extension`,
			],
			fix: () =>
				Promise.all(yamlFiles.map((file) =>
					fs.rename(
						path.join(workflowsDir, file),
						path.join(workflowsDir, file).replace(/\.yml$/, '.yaml'),
					)
				)),
		}
	}
}
