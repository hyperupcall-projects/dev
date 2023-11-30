import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import {
	pkgRoot,
} from '../../util/util.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../util/util.js').CreateRules} */
export async function createRules() {
	const configContent = `assert_lefthook_installed = true\n`

	return [
		{
			fix: 'lefthook-config-exists',
			async shouldFix() {

			}
		}
	]
}
