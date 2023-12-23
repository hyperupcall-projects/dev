import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export async function createRules() {
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
					'eslint-plugin-import',
					'eslint-plugin-markdown',
					'eslint-plugin-promise',
					'eslint-plugin-n',
					'eslint-plugin-unicorn',
					'eslint-plugin-security',
					'@eslint-community/eslint-plugin-eslint-comments',
					'@hyperupcall/eslint-config',
				],
			})),
		},
	]
}
