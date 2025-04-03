import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Issues } from '#types'

import {
	getNpmLatestVersion,
	pkgRoot,
	filesMustHaveContent,
	filesMustHaveShape,
	packageJsonMustNotHaveDependencies,
} from '#common'
import detectIndent from 'detect-indent'

export const issues: Issues = async function* issues({ project }) {
	// Check that there is only one configuration file.
	{
		const configContent = `export { default } from '@hyperupcall/scripts-nodejs/config-eslint.ts'\n`

		// https://eslint.org/docs/latest/use/configure/configuration-files-deprecated
		// https://eslint.org/docs/latest/use/configure/configuration-files
		yield* filesMustHaveContent({
			'.eslintrc.ts': null,
			'.eslintrc.cjs': null,
			'.eslintrc.yaml': null,
			'eslintrc.yml': null,
			'.eslintrc.json': null,
			'eslint.config.js': configContent,
			'eslint.config.mjs': null,
			'eslint.config.cjs': null,
			'eslint.config.ts': null,
			'eslint.config.mts': null,
			'eslint.config.cts': null,
		})
		yield* filesMustHaveShape({
			'package.json': {
				eslintConfig: { __delete: null },
			},
		})
	}

	// Check that all the necessary dependencies are installed.
	{
		const [version] = await getNpmLatestVersion(['@hyperupcall/scripts-nodejs'])
		yield* filesMustHaveShape({
			'package.json': {
				scripts: {
					lint: 'hyperupcall-scripts-nodejs lint',
				},
				devDependencies: {
					'@hyperupcall/scripts-nodejs': `${version}`,
				},
			},
		})

		yield* packageJsonMustNotHaveDependencies('eslint')
	}
}
