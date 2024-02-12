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
export const createRules = async function createRules({ metadata }) {
	return []
}
