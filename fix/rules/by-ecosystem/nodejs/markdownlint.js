import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../../util.js'
import {
	filesMustNotExist,
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
	ruleJsonFileMustHaveShape,
} from '../../rules/rules.js'

/** @type {import('../../../../index.js').CreateRules} */
export const createRules = async function createRules() {
	const markdownlintConfig = {
		extends: './node_modules/@hyperupcall/markdownlint-config/.markdownlint.json',
	}

	return [
		await ruleJsonFileMustHaveShape({
			file: 'package.json',
			shape: {
				'markdownlint-cli2': markdownlintConfig,
			},
		}),
		await filesMustNotExist({
			id: 'markdownlint-files-must-not-exist',
			// https://github.com/DavidAnson/markdownlint-cli2#configuration
			files: [
				'.markdownlint-cli2.jsonc',
				'.markdownlint-cli2.yaml',
				'.markdownlint-cli2.cjs',
				'.markdownlint-cli2.mjs',
				'.markdownlint.jsonc',
				'.markdownlint.json',
				'.markdownlint.yaml',
				'.markdownlint.yml',
				'.markdownlint.cjs',
				'.markdownlint.mjs',
			],
		}),
		{
			id: 'markdownlint-has-dependencies',
			...(await ruleCheckPackageJsonDependencies({
				mainPackageName: 'markdownlint',
				packages: ['markdownlint', '@hyperupcall/markdownlint-config'],
			})),
		},
	]
}
