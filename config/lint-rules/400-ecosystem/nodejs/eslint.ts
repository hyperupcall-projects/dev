import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	getNpmLatestVersion,
	pkgRoot,
	filesMustHaveContent,
	filesMustHaveShape,
} from '#common'

/** @type {import('../../../../index.ts').Issues} */
export const issues = async function* issues() {
	// Check that there is only one configuration file.
	{
		// TODO: Move to @hyperupcall/configs
		const configContent = `export { default } from '@hyperupcall/scripts-nodejs/config-eslint.ts'\n`

		// https://eslint.org/docs/latest/use/configure/configuration-files-deprecated
		// https://eslint.org/docs/latest/use/configure/configuration-files
		yield* filesMustHaveContent({
			'.eslintrc.ts': null,
			'.eslintrc.cjs': null,
			'.eslintrc.yaml': null,
			'eslintrc.yml': null,
			'.eslintrc.json': null,
			'eslint.config.ts': configContent,
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

		const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
		for (const dependencyKey of [
			'dependencies',
			'devDependencies',
			'peerDependencies',
			'peerDependenciesMeta',
			'bundleDependencies',
			'optionalDependencies',
		]) {
			for (const dependencyName in packageJson[dependencyKey] ?? {}) {
				if (dependencyName.includes('eslint')) {
					yield {
						message: [
							'Expected to find no dependencies that included the string "eslint"',
							`But, found "${dependencyName}"`,
						],
					}
				}
			}
		}
	}
}
