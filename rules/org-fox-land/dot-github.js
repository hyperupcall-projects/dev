import * as fs from 'node:fs/promises'
import path from 'node:path'

import { unified } from 'unified'
import { remark } from 'remark'
import remarkParse from 'remark-parse'
import detectIndent from 'detect-indent'
import { reporter } from 'vfile-reporter'
import { lintRule } from 'unified-lint-rule'
import { visit } from 'unist-util-visit'

import { makeRule, pkgRoot } from '../../util/util.js'
import { octokit } from '../../util/octokit.js'
import {
	ruleCheckPackageJsonDependencies,
	ruleFileMustExistAndHaveContent,
} from '../../util/rules.js'

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule({ project }) {
	// TODO: conditional rules, dependent rules
	if (project.owner === 'fox-land' && project.name === '.github') {
		console.log('dot-github matches')

		const links = []
		const orgRepos = await octokit.rest.repos.listForOrg({
			org: project.owner,
			per_page: 100
		})
		if (orgRepos.data.length >= 100) throw new Error('should not be 100')

		await makeRule(async () => {
			const readmeText = await fs.readFile('./profile/README.md', 'utf-8')
			/**
			 * @typedef {import('mdast').Root} Root
			 */
			const file = await remark()
				.use(
					function myRemarkPlugin(options) {
						return function (tree, file) {
							visit(tree, 'link', function (node, index, parent) {
								links.push({
									text: node?.children?.[0]?.value,
									url: node.url,
								})
							})
						}
					}
				)
				.process(readmeText)



			for (const orgRepo of orgRepos.data) {
				if (orgRepo.html_url.includes('.github')) {
					continue
				}

				if (!links.some((item) => item.url === orgRepo.html_url)) {
					console.info(`README missing link to: ${orgRepo.html_url}`)
				}
			}
			for (const link of links) {
				if (link.url.includes('.github')) {
					continue
				}
				if (!orgRepos.data.some((item) => item.html_url === link.url)) {
					console.info(`README link should be removed: ${link.url}`)
				}
			}

			return {
				description: 'README.md must be consistent',
				async shouldFix() {},
			}
		})
	}
}
