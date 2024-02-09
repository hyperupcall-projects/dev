import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../../util/util.js'
import {
	filesMustNotExist,
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
	ruleJsonFileMustHaveShape,
} from '../../../util/rules.js'

/** @type {import('../../../../index.js').CreateRules} */
export const createRules = async function createRules() {
	const npmPackageJsonLintConfig = {
		extends:
			'./node_modules/@hyperupcall/npm-package-json-lint-config/npmpackagejsonlintrc.json',
	}

	return [
		await ruleJsonFileMustHaveShape({
			file: 'package.json',
			shape: {
				npmpackagejsonlint: {
					extends: 'npm-package-json-lint-config-default',
				},
			},
		}),
		await filesMustNotExist({
			id: 'markdownlint-files-must-not-exist',
			// https://npmpackagejsonlint.org/docs/configuration#config-sources
			files: [
				'.npmpackagejsonlintrc',
				'.npmpackagejsonlintrc.json',
				'npmpackagejsonlint.config.js',
			],
		}),
		{
			id: 'npm-package-json-lint-has-dependencies',
			...(await ruleCheckPackageJsonDependencies({
				mainPackageName: 'npm-package-json-lint',
				packages: ['npm-package-json-lint', 'npm-package-json-lint-config-hyperupcall'],
			})),
		},
	]
}
