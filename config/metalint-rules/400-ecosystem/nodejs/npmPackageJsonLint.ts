import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { filesMustHaveShape, filesMustHaveContent } from '#utilities/metalint-utils.ts'
import { pkgRoot } from '#utilities/util.ts'
import type { Issues } from '#types'

export const issues: Issues = async function* issues({ project }) {
	yield* filesMustHaveShape('package-json', {
		'package.json': {
			npmpackagejsonlint: {
				extends: '@hyperupcall/scripts-nodejs/config-npmpackagejsonlint.js',
			},
		},
	})

	// https://npmpackagejsonlint.org/docs/configuration#config-sources
	yield* filesMustHaveContent('npmPackageJsonLint', {
		'.npmpackagejsonlintrc': null,
		'.npmpackagejsonlintrc.json': null,
		'npmpackagejsonlint.config.ts': null,
	})
}
