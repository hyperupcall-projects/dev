import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'

import {
	fileMustExistAndHaveContent,
	checkPackageJsonDependencies,
	makeRule,
	pkgRoot,
} from '../../util/util.js'
import { execa } from 'execa'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule() {
	// TODO
	// 	await makeRule(async () => {
	// 		const configContent = `assert_lefthook_installed = true
	// `
	// 	return await fileMustExistAndHaveContent({
	// 			file: '.lefthook.toml',
	// 			content: configContent
	// 		})
	// 	})
}
