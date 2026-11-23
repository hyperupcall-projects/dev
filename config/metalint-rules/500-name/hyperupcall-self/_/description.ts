import * as fs from 'node:fs/promises'

import { remark } from 'remark'
import { reporter } from 'vfile-reporter'
import { lintRule } from 'unified-lint-rule'

import type { Root } from 'mdast'
import type { Issues } from '#types'

export const issues: Issues = async function* issues({ project }) {
	// Keep this unfinished rule disabled.
	const enabled = false
	if (!enabled) return

	const readmeText = await fs.readFile('README.md', 'utf-8')
	const file = await remark()
		.use(
			lintRule(
				{
					origin: 'dev:must-content',
				},
				function (tree: Root, file) {
					const title = tree.children[0]
					if (
						title?.type !== 'heading' ||
						title.children.length !== 1 ||
						title.children[0].type !== 'text' ||
						title.children[0].value !== project.name
					) {
						file.message('Title is not name of repository')
					}

					const description = tree.children[1]
					const first =
						description?.type === 'paragraph' ? description.children[0] : undefined
					const last =
						description?.type === 'paragraph' ? description.children.at(-1) : undefined
					if (first?.type !== 'text' || !first.value.startsWith("Edwin's ")) {
						file.message("Description must begin with Edwin's ")
					}
					if (
						description?.type !== 'paragraph' ||
						!description.children.some((item) => item.type === 'link')
					) {
						file.message('Description must include link')
					}
					if (last?.type !== 'text' || !last.value.endsWith('.')) {
						file.message('Description must end with period')
					}

					const installHeading = tree.children[2]
					if (
						installHeading?.type !== 'heading' ||
						installHeading.children.length !== 1 ||
						installHeading.children[0].type !== 'text' ||
						installHeading.children[0].value !== 'Install'
					) {
						file.message('Install section is not in proper place')
					}

					const usageHeading = tree.children[4]
					if (
						usageHeading?.type !== 'heading' ||
						usageHeading.children.length !== 1 ||
						usageHeading.children[0].type !== 'text' ||
						usageHeading.children[0].value !== 'Usage'
					) {
						file.message('Usage section is not in proper place')
					}
				},
			),
		)
		.process(readmeText)

	console.log(reporter(file))

	return [
		{
			async issues() {},
			printInfo() {
				console.log('Readme description is consistent')
			},
		},
	]
}
