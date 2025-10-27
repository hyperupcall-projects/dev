import { fileExists, filesMustHaveContent, pkgRoot } from '#common'
import type { Issues } from '#types'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export const issues: Issues = async function* issues() {
	// Check if formatter.xml exists, if not copy it from config
	if (!(await fileExists('formatter.xml'))) {
		const sourceFormatterPath = path.join(pkgRoot(), 'config', 'formatter.xml')
		const formatterContent = await fs.readFile(sourceFormatterPath, 'utf-8')

		// This is a strict rule - only runs when --strict flag is passed
		for await (
			const issue of filesMustHaveContent({
				'formatter.xml': formatterContent,
			})
		) {
			yield {
				...issue,
				strict: true,
			}
		}
	}
}
