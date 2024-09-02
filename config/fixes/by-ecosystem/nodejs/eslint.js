import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	getNpmLatestVersion,
	pkgRoot,
	filesMustHaveContent,
	filesMustHaveShape,
} from '../../../common.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	// Check that there is only one configuration file.
	{
		// TODO: Move to @hyperupcall/configs
		const configContent = `export { default } from '@hyperupcall/scripts-nodejs/config-eslint.js'\n`

		// https://eslint.org/docs/latest/use/configure/configuration-files-deprecated
		// https://eslint.org/docs/latest/use/configure/configuration-files
		yield* filesMustHaveContent({
			'.eslintrc.js': null,
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
		yield *filesMustHaveShape({
			'package.json': {
				eslintConfig: { __delete: null },
			}
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
					'@hyperupcall/scripts-nodejs': `${version}`
				}
			}
		})

		const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
		const dependencyKeys = ['dependencies', 'devDependencies', 'peerDependencies', 'peerDependenciesMeta', 'bundleDependencies', 'optionalDependencies']
		for (const dependencyKey in dependencyKeys) {
			for (const dependencyName in packageJson[dependencyKey] ?? {}) {
				if (dependencyObject.includes('eslint')) {
					yield {
						message: ['Expected to find no dependencies that included the string "eslint"', `But, found "${dependencyName}"`],
					}
				}
			}
		}
	}
}
