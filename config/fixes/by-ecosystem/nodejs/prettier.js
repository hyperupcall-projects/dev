import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../../../fix/util.js'
import {
	filesMustHaveShape,
	ruleCheckPackageJsonDependencies2,
	filesMustHaveContent,
} from '../../../../fix/rules.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const prettierConfig = '@hyperupcall/prettier-config'

	yield *filesMustHaveShape({
		'package.json': {
			prettier: prettierConfig,
		},
	})

	// https://prettier.io/docs/en/configuration.html
	yield *filesMustHaveContent({
		'.prettierrc': null,
		'.prettierrc.json': null,
		'.prettierrc.yml': null,
		'.prettierrc.yaml': null,
		'.prettierrc.json5': null,
		'.prettierrc.js': null,
		'prettier.config.js': null,
		'.prettierrc.mjs': null,
		'prettier.config.mjs': null,
		'.prettierrc.cjs': null,
		'prettier.config.cjs': null,
		'.prettierrc.toml': null,
	})

	yield *ruleCheckPackageJsonDependencies2({
		packages: {
			prettier: null,
			'prettier-plugin-pkg': null,
			'@hyperupcall/prettier-config': null,
		},
	})
}
