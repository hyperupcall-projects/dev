import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot, filesMustHaveShape, filesMustHaveContent } from '#common'

export const skip = true

/** @type {import('../../../../index.ts').Issues} */
export const issues = async function* issues() {
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
