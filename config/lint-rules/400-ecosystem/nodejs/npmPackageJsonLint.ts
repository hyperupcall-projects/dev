import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot, filesMustHaveShape, filesMustHaveContent } from '#common'
import type { Issues } from '#types'

export const skip = true

export const issues: Issues = async function* issues({ project }) {
	const npmPackageJsonLintConfig = {
		extends:
			'./node_modules/@hyperupcall/npm-package-json-lint-config/npmpackagejsonlintrc.json',
	}

	yield* filesMustHaveShape({
		'package.json': {
			npmpackagejsonlint: {
				extends: 'npm-package-json-lint-config-default',
			},
		},
	})

	// https://npmpackagejsonlint.org/docs/configuration#config-sources
	yield* filesMustHaveContent({
		'.npmpackagejsonlintrc': null,
		'.npmpackagejsonlintrc.json': null,
		'npmpackagejsonlint.config.ts': null,
	})

	// yield *packageJsonMustHaveDependencies({
	// 		packages: ['npm-package-json-lint', '@hyperupcall/npm-package-json-lint-config']
	// })
}
