import * as util from 'node:util'
import child_process from 'node:child_process'

import { input } from '#utilities/prompt.ts'

import { octokit } from '#common'
import type { Issues } from '#types'

/**
 * Check that various fields of the the GitHub repository metadata conforms
 * to my standards.
 */

export const issues: Issues = async function* issues({ project }) {
	if (project.type !== 'with-remote-url') {
		throw new Error(`Expected project to be associated with a remote`)
	}

	const maxDescriptionLength = 96

	let { data } = await octokit.rest.repos.get({
		owner: project.owner,
		repo: project.name,
	})

	// Check the description.
	if (!data.description || !data.description.trim()) {
		yield {
			message: [
				'Expected GitHub repository to have a description',
				'But, no description was found',
			],
			fix: fixSetDescription,
		}
	}
	if (!data.description) {
		throw new TypeError(`Expected variable "data.description" to not be falsy`)
	}

	if (!data.description.endsWith('.') && !data.description.endsWith('!')) {
		yield {
			message: [
				'Expected GitHub repository description to end with either a period or exclamation mark',
				'But, no period or exclamation mark was found at the end of the description',
			],
			fix: fixSetDescription,
		}
	}

	if (data.description.length > maxDescriptionLength) {
		yield {
			message: [
				`Expected GitHub repository description to have at most ${maxDescriptionLength} UTF-16 code units`,
				`But, GitHub repository description has ${data.description.length} UTF-16 code units`,
			],
			fix: fixSetDescription,
		}
	}

	async function fixSetDescription() {
		const inputValue = await input({
			message: 'Choose a description',
			default: data.description ?? '',
			validate: (str: string) => {
				if (str.length > maxDescriptionLength) {
					return `Must have at most ${maxDescriptionLength} UTF-16 code units`
				}

				if (!str.endsWith('.') && !str.endsWith('!')) {
					return 'Must end with either a period or exclamation mark'
				}

				return true
			},
		})
		await octokit.rest.repos.update({
			owner: project.owner,
			repo: project.name,
			description: inputValue,
		})
		;({ data } = await octokit.rest.repos.get({
			owner: project.owner,
			repo: project.name,
		}))
	}

	// Check the homepage URL.
	{
		// Keep the trailing slash for consistency; GitHub defaults to adding a trailing slash when
		// deriving the homepage URL from the repository name and owner.
		let expectedURL = `https://${project.owner}.github.io/${project.name}/`
		if (project.name.includes('.')) {
			expectedURL = `https://${project.name}`
		}

		if (!data.homepage) {
			// TODO
			// yield {
			// 	message: [
			// 		'Expected GitHub repository to have a homepage URL',
			// 		'But, no homepage URL was found',
			// 	],
			// 	fix: () =>
			// 		octokit.rest.repos.update({
			// 			owner: project.owner,
			// 			repo: project.name,
			// 			homepage: expectedURL,
			// 		}),
			// }
		} else if (data.homepage !== expectedURL) {
			// TODO: Permissions bug
			// yield {
			// 	message: [
			// 		`Expected GitHub repository to have a homepage URL of "${expectedURL}"`,
			// 		`But, homepage URL of "${data.homepage}" was found`,
			// 	],
			// 	fix: () =>
			// 		octokit.rest.repos.update({
			// 			owner: project.owner,
			// 			repo: project.name,
			// 			homepage: expectedURL,
			// 		}),
			// }
		}
	}

	// TODO: Check that some topics exist; derive the topics that should exist from package.json, repo name, etc.

	// Check that unnecessary features are disabled.
	{
		if (data.has_projects) {
			const res: {
				organization: {
					projectsV2: {
						totalCount: number
						nodes: { id: string; title: string; url: string }[]
					}
				}
			} = await octokit.graphql(
				`
				query($organization: String!) {
					organization(login: $organization) {
						projectsV2(first: 10) {
							totalCount
							nodes {
								id,
								title,
								url
							}
						}
					}
				}`,
				{ organization: project.owner },
			)
			const projects = res.organization.projectsV2
			if (projects.nodes.length === 0) {
				yield {
					id: 'disable-projects-tab',
					message: [
						'Expected GitHub repository to have the "projects" tab disabled',
						'But, the "projects" tab is enabled (and has no projects)',
					],
					fix: () =>
						octokit.rest.repos.update({
							owner: project.owner,
							repo: project.name,
							has_projects: false,
						}),
				}
			} else {
				yield {
					message: [
						'Expected GitHub repository to have the "projects" tab disabled',
						'But, the "projects" tab is enabled and the repository has defined at least one project',
						`See projects at https://github.com/orgs/${project.owner}/projects`,
					],
				}
			}
		}

		if (data.has_wiki) {
			// TODO
			if (!project.owner.match(/^[\w-]+/) || !project.name.match(/^[\w-]+/)) {
				throw new Error(
					`The "owner" or "name" of the GitHub repository contains invalid characters`,
				)
			}

			let shouldDisableWikiTab = false
			try {
				await util.promisify(child_process.exec)(
					`git ls-remote "https://github.com/${project.owner}/${project.name}.wiki.git"`,
					{
						timeout: 3000,
						env: {
							GIT_CONFIG_NOSYSTEM: '1',
							GIT_CONFIG: '/dev/null',
							GIT_TERMINAL_PROMPT: '0',
						},
					},
				)
				// If we get a valid response, then the wiki repository exists (and has content). Therefore,
				// we should not automatically disable the wiki tab and let the user decide what to do.
			} catch (err) {
				if (!err.killed && err.stderr.includes('fatal: could not read Username')) {
					// We attempt to access the wiki repository. As per security best practices, GitHub will
					// ask for authentication, if either the wiki repository either does not exist, or is private.
					// At this point, we can safely assume that both the wiki and the repository are not private.
					// Because, if they were, then the first "repos.get" call would have thrown an error. Therefore,
					// at this point, we know that the wiki repository does not exist (despite the "wiki" tab being enabled).
					shouldDisableWikiTab = true
				} else {
					throw err
				}
			}

			if (shouldDisableWikiTab) {
				yield {
					message: [
						'Expected GitHub repository to have the "wiki" tab disabled',
						'But, the "wiki" tab is enabled and the wiki repository does not exist',
					],
					fix: () =>
						octokit.rest.repos.update({
							owner: project.owner,
							repo: project.name,
							has_wiki: false,
						}),
				}
			} else {
				yield {
					message: [
						'Expected GitHub repository to have the "wiki" tab disabled',
						'But, the "wiki" tab is enabled and the wiki repository does exist (and may have content)',
					],
				}
			}
		}

		if (data.has_discussions) {
			yield {
				message: [
					'Expected GitHub repository to have the "discussions" tab disabled',
					'But, the "discussions" tab is enabled',
				],
			}
		}
	}

	// TODO: check that github pages is properly configured

	if (data.default_branch !== 'main') {
		yield {
			id: 'default-branch-main',
			message: [
				'Expected GitHub repository to have a default branch of "main"',
				`But, default branch of "${data.default_branch}" was found`,
			],
		}
	}
}
