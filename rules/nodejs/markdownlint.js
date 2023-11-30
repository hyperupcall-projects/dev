import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import {
	makeRule,
	pkgRoot,
} from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'
import { execa } from 'execa'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	await makeRule(async () => {
		const configFile = path.join(pkgRoot('@hyperupcall/configs'), '.markdownlint.json')
		const configContent = await fs.readFile(configFile, 'utf-8')

		return await ruleFileMustExistAndHaveContent({
			file: '.markdownlint.json',
			content: configContent,
		})
	})

	await makeRule(
		async () =>
			await ruleCheckPackageJsonDependencies({
				mainPackageName: 'markdownlint',
				packages: ['markdownlint', '@hyperupcall/markdownlint-config'],
			}),
	)
}
