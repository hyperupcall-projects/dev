import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	pkgRoot,
	filesMustHaveShape,
	filesMustHaveContent,
} from '../../../common.js'

export const skip = true

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const markdownlintConfig = {
		extends: './node_modules/@hyperupcall/markdownlint-config/.markdownlint.json',
	}

	yield *filesMustHaveShape({
		'package.json': {
			'markdownlint-cli2': markdownlintConfig,
		},
	})

	// https://github.com/DavidAnson/markdownlint-cli2#configuration
	yield *filesMustHaveContent({
		'.markdownlint-cli2.jsonc': null,
		'.markdownlint-cli2.yaml': null,
		'.markdownlint-cli2.cjs': null,
		'.markdownlint-cli2.mjs': null,
		'.markdownlint.jsonc': null,
		'.markdownlint.json': null,
		'.markdownlint.yaml': null,
		'.markdownlint.yml': null,
		'.markdownlint.cjs': null,
		'.markdownlint.mjs': null,
	})

	// yield *packageJsonMustHaveDependencies({
	// 	packages: ['markdownlint', '@hyperupcall/markdownlint-config'],
	// })
}
