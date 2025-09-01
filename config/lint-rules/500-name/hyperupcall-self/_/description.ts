import * as fs from 'node:fs/promises'

import { remark } from 'remark'
import { reporter } from 'vfile-reporter'
import { lintRule } from 'unified-lint-rule'

import type { Heading, Root } from 'remark'

export const issues = async function* issues() {
	return []

	const readmeText = await fs.readFile('README.md', 'utf-8')
	const file: Root = await remark()
		.use(
			lintRule(
				{
					origin: 'dev:must-content',
				},
				function (tree: Root, file) {
					const title: Heading = tree.children[0]
					if (
						title.children.length !== 1 ||
						title.children[0].type !== 'text' ||
						title.children[0].value !== project.name
					) {
						file.message('Title is not name of repository')
					}

					const description: Heading = tree.children[1]
					if (!description?.children[0]?.value?.startsWith("Edwin's ")) {
						file.message("Description must begin with Edwin's ")
					}
					if (!description.children.some((item) => item.type === 'link')) {
						file.message('Description must include link')
					}
					if (!description.children.at(-1)?.value?.endsWith('.')) {
						file.message('Description must end with period')
					}

					const installHeading: Heading = tree.children[2]
					if (
						installHeading?.children?.length !== 1 ||
						installHeading.children[0].type !== 'text' ||
						installHeading.children[0].value !== 'Install'
					) {
						file.message('Install section is not in proper place')
					}

					const usageHeading: Heading = tree.children[4]
					if (
						usageHeading?.children?.length !== 1 ||
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
