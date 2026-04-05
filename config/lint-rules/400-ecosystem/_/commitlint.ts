import {
	filesMustHaveContent,
	filesMustHaveName,
	pkgRoot,
} from '#common'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	// Check that there is only one configuration file.
	{
		// https://commitlint.js.org/reference/configuration.html#config-via-file
		yield* filesMustHaveName({
			'.commitlintrc.yaml': ['.commitlintrc.yml']
		})
		yield* filesMustHaveContent('commitlint', {
			'.commitlintrc': null,
			'.commitlintrc.json': null,
			'.commitlintrc.js': null,
			'.commitlintrc.cjs': null,
			'.commitlintrc.mjs': null,
			'.commitlintrc.ts': null,
			'.commitlintrc.cts': null,
			'.commitlintrc.mts': null,
			'commitlint.config.js': null,
			'commitlint.config.cjs': null,
			'commitlint.config.mjs': null,
			'commitlint.config.ts': null,
			'commitlint.config.cts': null,
			'commitlint.config.mts': null,
		})
	}

	yield* filesMustHaveContent('commitlint', {
		'.commitlintrc.yaml': await fs.readFile(
			path.join(pkgRoot(), 'config/.commitlintrc.yaml'), 'utf-8',
		),
	})
}
