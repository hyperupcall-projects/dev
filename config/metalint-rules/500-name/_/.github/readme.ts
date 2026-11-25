// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { remark } from 'remark'
import { visit } from 'unist-util-visit'
import { octokit } from '#utilities/util.ts'
import type { Issues } from '#types'

/**
 * Check that README.md links to every repository owned by this account.
 **/
export const issues: Issues = async function* issues({ project }) {
	if (project.type !== 'with-remotevcs') {
		throw new Error('Expected project to be associated with a remote forge')
	}

	const { owner } = project
	const readmeFile = path.join(project.rootDir, 'README.md')
	const content = await fs.readFile(readmeFile, 'utf-8').catch((err) => {
		if (err.code === 'ENOENT') return undefined
		throw err
	})
	if (content === undefined) {
		yield {
			id: 'must-exist',
			message: ['Expected to find a README.md file', 'But, no README.md file was found'],
			fix: async () => {
				const repositories = await getRepositories(owner)
				const links = repositories.map(
					(repository) => `- [${repository.name}](${repository.url})`,
				)
				await fs.writeFile(readmeFile, `${links.join('\n')}\n`)
			},
		}
		return
	}

	const tree = remark().parse(content)
	const definitions = new Map<string, string>()
	visit(tree, 'definition', (node) => {
		if (!definitions.has(node.identifier)) {
			definitions.set(node.identifier, node.url)
		}
	})

	const links = new Set<string>()
	visit(tree, ['link', 'linkReference'], (node) => {
		if (node.type === 'link') {
			links.add(node.url)
		} else if (node.type === 'linkReference') {
			const url = definitions.get(node.identifier)
			if (url) links.add(url)
		}
	})

	const repositories = await getRepositories(owner)
	const missing = repositories.filter((repository) => !links.has(repository.url))
	if (missing.length > 0) {
		yield {
			id: 'must-link-to-all-projects',
			message: [
				`Expected README.md to link to every repository owned by "${owner}"`,
				...missing.map((repository) => `But, no link to "${repository.url}" was found`),
			],
			fix: async () => {
				const currentContent = await fs.readFile(readmeFile, 'utf-8')
				const links = missing.map(
					(repository) => `- [${repository.name}](${repository.url})`,
				)
				await fs.appendFile(
					readmeFile,
					`${currentContent.endsWith('\n') ? '' : '\n'}\n${links.join('\n')}\n`,
				)
			},
		}
	}
}

type Repository = { name: string; url: string }

async function getRepositories(owner: string): Promise<Repository[]> {
	const repositories: Repository[] = []
	let cursor: string | null = null
	while (true) {
		type RepositoryPage = {
			repositoryOwner: {
				repositories: {
					nodes: (Repository | null)[]
					pageInfo: { hasNextPage: boolean; endCursor: string | null }
				}
			} | null
		}
		const response: RepositoryPage = await octokit.graphql<RepositoryPage>(
			`
			query($owner: String!, $cursor: String) {
				repositoryOwner(login: $owner) {
					repositories(
						first: 100,
						after: $cursor,
						ownerAffiliations: [OWNER],
						orderBy: { field: NAME, direction: ASC }
					) {
						nodes { name url }
						pageInfo { hasNextPage endCursor }
					}
				}
			}`,
			{ owner, cursor },
		)
		const repositoryOwner = response.repositoryOwner
		if (!repositoryOwner) {
			throw new Error(`Could not find GitHub account "${owner}"`)
		}
		for (const repository of repositoryOwner.repositories.nodes) {
			if (repository) repositories.push(repository)
		}
		const { hasNextPage, endCursor } = repositoryOwner.repositories.pageInfo
		if (!hasNextPage) break
		if (!endCursor) throw new Error('Expected a cursor for the next repository page')
		cursor = endCursor
	}
	return repositories
}
