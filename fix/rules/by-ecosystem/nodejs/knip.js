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
export const createRules = async function createRules({ metadata }) {
	return []
}
