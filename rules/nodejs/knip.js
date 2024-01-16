import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '../../util/util.js'
import {
	filesMustNotExist,
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
	ruleJsonFileMustHaveShape,
} from '../../util/rules.js'

/** @type {import('../../index.js').CreateRules} */
export const createRules = async function createRules({ metadata }) {
	if (metadata.projectSize === 'small') {
		return []
	}

	const knipConfig = {
		entry: [],
	}

	return [
		await ruleJsonFileMustHaveShape({
			file: 'package.json',
			shape: {
				knip: knipConfig,
			},
		}),
		await filesMustNotExist({
			id: 'markdownlint-files-must-not-exist',
			// https://github.com/DavidAnson/markdownlint-cli2#configuration
			files: [
				'knip.json',
				'knip.jsonc',
				'.knip.json',
				'.knip.jsonc',
				'knip.ts',
				'knip.js',
			],
		}),
		{
			id: 'knip-has-dependencies',
			...(await ruleCheckPackageJsonDependencies({
				mainPackageName: 'knip',
				packages: ['knip'],
			})),
		},
	]
}
