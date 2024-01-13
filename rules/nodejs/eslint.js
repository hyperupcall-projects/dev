import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export const createRules = async function createRules() {
	return [
		{
			id: 'eslint-config-exists',
			...(await (async () => {
				const configFile = path.join(pkgRoot('@hyperupcall/configs'), '.eslintrc.json')
				const configContent = await fs.readFile(configFile, 'utf-8')

				return await ruleFileMustExistAndHaveContent({
					file: '.eslintrc.json',
					content: configContent,
				})
			})()),
		},
		{
			id: 'eslint-has-dependencies',
			...(await ruleCheckPackageJsonDependencies({
				mainPackageName: 'eslint',
				packages: [
					'eslint',
					'eslint-config-prettier',
					'@hyperupcall/eslint-config',
					'eslint-plugin-import',
					'eslint-plugin-markdown',
					'eslint-plugin-promise',
					'eslint-plugin-n',
					'eslint-plugin-unicorn',
					'eslint-plugin-security',
					'@eslint-community/eslint-plugin-eslint-comments',
					'eslint-plugin-regexp',
					'eslint-plugin-perfectionist',
					'eslint-plugin-no-unsanitized',
					'eslint-plugin-mdx',
				],
			})),
		},
	]
}
