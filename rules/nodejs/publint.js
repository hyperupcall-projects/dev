import * as fs from 'node:fs/promises'
import path from 'node:path'

import { pkgRoot } from '../../util/util.js'
import { execa } from 'execa'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export async function createRules() {
	const { stdout, stderr, exitCode } = await execa('npx', ['publint'])
	if (!stdout.includes('All good!')) {
		console.log(stdout)
	}

	return [
		{
			id: 'publint-succeeds',
			async shouldFix() {
				return exitCode !== 0
			},
			async fix() {
				console.log(console.log(stdout))
			},
		},
	]
}
