import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import {
	makeRule,
	pkgRoot,
} from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	await makeRule(async () => {
		const configFile = path.join(pkgRoot('@hyperupcall/configs'), '.prettierrc.json')
		const configContent = await fs.readFile(configFile, 'utf-8')

		return await ruleFileMustExistAndHaveContent({
			file: '.prettierrc.json',
			content: configContent,
		})
	})

	await makeRule(
		async () =>
			await ruleCheckPackageJsonDependencies({
				mainPackageName: 'prettier',
				packages: ['prettier', 'prettier-plugin-pkg', '@hyperupcall/prettier-config'],
			}),
	)
}
