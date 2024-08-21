import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../../../fix/util.js'
import {
	filesMustHaveContent,
	ruleCheckPackageJsonDependencies,
} from '../../../../fix/rules.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const configFile = path.join(pkgRoot('@hyperupcall/configs'), '.eslintrc.json')
	const configContent = await fs.readFile(configFile, 'utf-8')

	yield *filesMustHaveContent({
		'.eslintrc.json': configContent,
	})

	yield *ruleCheckPackageJsonDependencies({
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
		]
	})
}
