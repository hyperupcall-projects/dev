import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	getNpmLatestVersion,
	pkgRoot,
	filesMustHaveShape,
	filesMustHaveContent,
} from '../../../common.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	// Check that there is only one configuration file.
	{
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

		yield *filesMustHaveShape({
			'package.json': {
				'prettier': '@hyperupcall/scripts-nodejs/prettier-config.js'
			},
		})
	}

	// Check that all the necessary dependencies are installed.
	{
		const [version] = await getNpmLatestVersion(['@hyperupcall/scripts-nodejs'])
		yield *filesMustHaveShape({
			'package.json': {
				scripts: {
					format: 'hyperupcall-scripts-nodejs format',
				},
				devDependencies: {
					'@hyperupcall/scripts-nodejs': `${version}`
				},
			},
		})
		const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'))
		const dependencyKeys = ['dependencies', 'devDependencies', 'peerDependencies', 'peerDependenciesMeta', 'bundleDependencies', 'optionalDependencies']
		for (const dependencyKey in dependencyKeys) {
			for (const dependencyName in packageJson[dependencyKey] ?? {}) {
				if (dependencyObject.includes('prettier')) {
					yield {
						message: ['Expected to find no dependencies that included the string "prettier"', `But, found "${dependencyName}"`],
					}
				}
			}
		}
	}
}
