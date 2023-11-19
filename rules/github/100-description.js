import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import detectIndent from 'detect-indent'
import { execa } from 'execa'

import { makeRule, pkgRoot } from '../../util/util.js'
import { octokit } from '../../util/octokit.js'

export async function rule({ github }) {

	const { data } = await octokit.rest.repos.get({
		owner: github.owner,
		repo: github.repo,
	})

	await makeRule(() => {
		return {
			description: 'Repository description must end with a period',
			async shouldFix() {
				return !data.description.endsWith('.')
			},
			// TODO:  use gh repo edit --description
		}
	})
}
