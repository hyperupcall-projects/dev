import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	getNpmLatestVersion,
	pkgRoot,
	filesMustHaveShape,
	filesMustHaveContent,
	packageJsonMustNotHaveDependencies,
} from '#common'
import type { Issues } from '#types'
import detectIndent from 'detect-indent'

export const issues: Issues = async function* issues({ project }) {
	// Check that there is only one configuration file.
	{
		// https://prettier.io/docs/en/configuration.html
		yield* filesMustHaveContent({
			'.prettierrc': null,
			'.prettierrc.json': null,
			'.prettierrc.yml': null,
			'.prettierrc.yaml': null,
			'.prettierrc.json5': null,
			'.prettierrc.ts': null,
			'prettier.config.ts': null,
			'.prettierrc.mjs': null,
			'prettier.config.mjs': null,
			'.prettierrc.cjs': null,
			'prettier.config.cjs': null,
			'.prettierrc.toml': null,
		})

		yield* filesMustHaveShape({
			'package.json': {
				prettier: '@hyperupcall/scripts-nodejs/config-prettier.js',
			},
		})
	}

	// Check that all the necessary dependencies are installed.
	{
		const [version] = await getNpmLatestVersion(['@hyperupcall/scripts-nodejs'])
		yield* filesMustHaveShape({
			'package.json': {
				scripts: {
					format: 'hyperupcall-scripts-nodejs format',
				},
				devDependencies: {
					'@hyperupcall/scripts-nodejs': `${version}`,
				},
			},
		})

		yield* packageJsonMustNotHaveDependencies('prettier')
	}
}
