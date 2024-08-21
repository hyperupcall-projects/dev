import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'
import { execa } from 'execa'

import { fileExists, pkgRoot, octokit } from '../../../../fix/util.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues({ project }) {
	const configFile = '.gitattributes'

	return []
}
