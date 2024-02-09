import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'
import { execa } from 'execa'

import { fileExists, pkgRoot } from '../../../util/util.js'
import { octokit } from '../../../util/octokit.js'

/** @type {import('../../../index.js').CreateRules} */
export const createRules = async function createRules({ project }) {
	const configFile = '.gitattributes'

	return []
}
