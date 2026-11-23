import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	filesMustHaveShape,
	filesMustHaveContent,
	packageJsonMustNotHaveDependencies,
} from '#utilities/metalint-utils.ts'
import type { Issues } from '#types'

export const issues: Issues = async function* issues({ project }) {
	yield* filesMustHaveShape('package-json', {
		'package.json': {
			'markdownlint-cli2': {
				extends: './node_modules/@hyperupcall/scripts-nodejs/.markdownlint.mjs',
			},
		},
	})

	// https://github.com/DavidAnson/markdownlint-cli2#configuration
	yield* filesMustHaveContent('markdownlint', {
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

	yield* packageJsonMustNotHaveDependencies('markdownlint')
}
