import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../../util/util.js'
import {
	filesMustNotExist,
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
	ruleJsonFileMustHaveShape,
} from '../../../util/rules.js'

/** @type {import('../../../index.js').CreateRules} */
export const createRules = async function createRules() {
	const prettierConfig = '@hyperupcall/prettier-config'

	return [
		await ruleJsonFileMustHaveShape({
			file: 'package.json',
			shape: {
				prettier: prettierConfig,
			},
		}),
		await filesMustNotExist({
			id: 'prettier-files-must-not-exist',
			// https://prettier.io/docs/en/configuration.html
			files: [
				'.prettierrc',
				'.prettierrc.json',
				'.prettierrc.yml',
				'.prettierrc.yaml',
				'.prettierrc.json5',
				'.prettierrc.js',
				'prettier.config.js',
				'.prettierrc.mjs',
				'prettier.config.mjs',
				'.prettierrc.cjs',
				'prettier.config.cjs',
				'.prettierrc.toml',
			],
		}),
		{
			id: 'prettier-has-dependencies',
			...(await ruleCheckPackageJsonDependencies({
				mainPackageName: 'prettier',
				packages: ['prettier', 'prettier-plugin-pkg', '@hyperupcall/prettier-config'],
			})),
		},
	]
}
