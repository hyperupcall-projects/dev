import * as fs from 'node:fs/promises'
import path from 'node:path';

import {unified} from 'unified'
import { remark } from 'remark'
import remarkParse from 'remark-parse'
import detectIndent from 'detect-indent'
import {reporter} from 'vfile-reporter'
import {lintRule} from 'unified-lint-rule'
import {visit} from 'unist-util-visit'

import { makeRule, pkgRoot } from "../../util/util.js";
import { octokit } from '../../util/octokit.js';

/** @type {import('../../util/util.js').RuleMaker} */
export async function rule({ project }) {
	await makeRule(async () => {
		const readmeText = await fs.readFile('README.md', 'utf-8')
		/**
		 * @typedef {import('mdast').Root} Root
		*/
		const file = await remark()
			.use(lintRule(
				{
					origin: 'repository-lint:must-content',
				},
				/**
				 * @param {Root} tree
				 *   Tree.
				 * @returns {undefined}
				 *   Nothing.
				 */
				function (tree, file) {
					/** @type {import('mdast').Heading} */
					const title = tree.children[0]
					if (title.children.length !== 1 || title.children[0].type !== 'text' || title.children[0].value !== project.name) {
						file.message('Title is not name of repository')
					}

					/** @type {import('mdast').Heading} */
					const description = tree.children[1]
					if (!description?.children[0]?.value?.startsWith("Edwin's ")) {
						file.message("Description must begin with Edwin's ")
					}
					if (!description.children.some((item) => item.type === 'link')) {
						file.message("Description must include link")
					}
					if (!description.children.at(-1)?.value?.endsWith('.')) {
						file.message("Description must end with period")
					}

					/** @type {import('mdast').Heading} */
					const installHeading = tree.children[2]
					if (installHeading?.children?.length !== 1 || installHeading.children[0].type !== 'text' || installHeading.children[0].value !== 'Install') {
						file.message('Install section is not in proper place')
					}

					/** @type {import('mdast').Heading} */
					const usageHeading = tree.children[4]
					if (usageHeading?.children?.length !== 1 || usageHeading.children[0].type !== 'text' || usageHeading.children[0].value !== 'Usage') {
						file.message('Usage section is not in proper place')
					}
				}
			))
			.process(readmeText)


		console.log(reporter(file))

		return {
			description: 'README.md must be consistent',
			async shouldFix() {

			}
		}
	})
}
