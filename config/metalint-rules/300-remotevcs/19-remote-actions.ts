import type { Issues } from '#types'
import { filesMustHaveContent } from '#utilities/metalint-utils.ts'
import { octokit, pkgRoot } from '#utilities/util.ts'
import path from 'node:path'
import fs from 'node:fs/promises'

export const issues: Issues = async function* issues({ project }) {
	if (project.type !== 'with-remote-url') {
		throw new Error(`Expected project to be associated with a remote forge`)
	}

	yield* filesMustHaveContent('github-actions-website', {
		'.github/workflows/website.yaml': await fs.readFile(
			path.join(pkgRoot(), 'config/gh-actions-website.yaml'),
			'utf-8',
		),
	})

	const pages = await octokit.rest.repos
		.getPages({ owner: project.owner, repo: project.name })
		.catch((error) => {
			if (error.status !== 404) {
				throw error
			}
			return undefined
		})

	if (pages?.data.build_type !== 'workflow') {
		yield {
			id: 'github-pages-must-use-actions',
			message: [
				'Expected GitHub Pages to build using GitHub Actions',
				pages
					? `But, GitHub Pages has build type "${pages.data.build_type}"`
					: 'But, GitHub Pages is not enabled',
			],
			fix: async () => {
				if (pages) {
					await octokit.rest.repos.updateInformationAboutPagesSite({
						owner: project.owner,
						repo: project.name,
						build_type: 'workflow',
					})
				} else {
					await octokit.rest.repos.createPagesSite({
						owner: project.owner,
						repo: project.name,
						build_type: 'workflow',
					})
				}
			},
		}
	}
}
