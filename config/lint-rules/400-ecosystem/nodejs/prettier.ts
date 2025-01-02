import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	getNpmLatestVersion,
	pkgRoot,
	filesMustHaveShape,
	filesMustHaveContent,
} from '#common'
import type { Issues } from '#types'

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
				prettier: '@hyperupcall/scripts-nodejs/config-prettier.ts',
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
				if (dependencyName.includes('prettier')) {
					yield {
						message: [
							'Expected to find no dependencies that included the string "prettier"',
							`But, found "${dependencyName}"`,
						],
					}
				}
			}
		}
	}
}
