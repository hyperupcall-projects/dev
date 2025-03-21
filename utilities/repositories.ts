import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { octokit } from '#common'
import { minimatch } from 'minimatch'
import * as v from 'valibot'
import untildify from 'untildify'

export const Ctx = {
	cloneDir: untildify('~/.dev/.data/cloned-repositories'),
	symlinkedRepositoriesDir: untildify('~/Documents/Repositories'),
	ignoredRepos: [
		// Skip cloning from the following organizations:
		'eshsrobotics/*',
		'hackclub/*',
		'replit-discord/*',
		'gamedevunite-at-smc/*',
		'cs-club-smc/*',
		'ecc-cs-club/*',
		'GameDevUniteAtECC/*',
		'EpicGames/*',
		'fox-archives/*',
		'fox-templates/*',
		'fox-forks/*',
		'asdf-contrib-hyperupcall/*',
		// Skip cloning from the following repositories:
		'hyperupcall/hidden',
		'hyperupcall/secrets',
		'hyperupcall/dotfiles',
		'fox-incubating/dev',
	],
}

import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'
type GitHubRepository = GetResponseDataTypeFromEndpointMethod<
	typeof octokit.rest.repos.get
>

export type RepoGroupsT = v.InferInput<typeof RepoGroups>
export const RepoGroups = v.array(
	v.object({
		groupName: v.string(),
		groupId: v.string(),
		repos: v.array(v.string()),
	}),
)

export type RepoDetailsT = v.InferInput<typeof RepoDetails>
export const RepoDetails = v.array(
	v.object({
		fullName: v.string(),
		isCloned: v.boolean(),
		// hasUnsavedChanges: true
		// tags: { name: string; isAnnotated: string; ref: string; link: string }[]
		// currentBranch: string
		// localBranches: string[]
		// worktrees: string[]
	}),
)

export type ReposT = v.InferInput<typeof Repos>
export const Repos = v.array(RepoDetails)

export async function getCachedRepositoryGroups(): Promise<RepoGroupsT> {
	const cachePath = path.join(import.meta.dirname, '../.data/repository-groups.json')

	let json
	try {
		json = JSON.parse(await fs.readFile(cachePath, 'utf-8'))
	} catch (err) {
		if (err.code === 'ENOENT') {
			json = await getRepositoryGroups()
			await fs.mkdir(path.dirname(cachePath), { recursive: true })
			await fs.writeFile(cachePath, JSON.stringify(json, null, '\t'))
		} else {
			throw err
		}
	}

	return json
}

export async function getRepositoryGroups(): Promise<RepoGroupsT> {
	const repositories = await collectGitHubRepositories()
	const allRepositoryFullnames: string[] = []
	for (const orgName in repositories) {
		for (const repo of repositories[orgName]) {
			allRepositoryFullnames.push(repo.full_name)
		}
	}

	function matchAndTake(globs: string[], options: { not: string[] } = { not: [] }) {
		const taken = []
		for (const fullname of Array.from(allRepositoryFullnames)) {
			let matches = false
			for (const pattern of globs) {
				if (minimatch(fullname, pattern, { dot: true })) {
					matches = true
					continue
				}
			}
			if (!matches) {
				continue
			}
			for (const pattern of options.not) {
				if (minimatch(fullname, pattern, { dot: true })) {
					matches = false
					continue
				}
			}
			if (matches) {
				const idx = allRepositoryFullnames.findIndex((m) => m === fullname)
				allRepositoryFullnames.splice(idx, 1)
				taken.push(fullname)
			}
		}
		return taken
	}

	return [
		{
			groupName: 'Personal',
			groupId: 'personal',
			repos: matchAndTake([
				'fox-incubating/sauerkraut',
				'fox-incubating/event-horizon',
				'fox-incubating/antarctica',
				'fox-incubating/font-finder',
				'fox-incubating/apfelstrudel',
				'fox-incubating/link-tracker',
				'fox-projects/pick-sticker',
			]),
		},
		{
			groupName: 'JSON Schema',
			groupId: 'json-schema',
			repos: matchAndTake(['SchemaStore/*', 'fox-projects/jsonschema-extractor'], {
				not: ['SchemaStore/json-validator'],
			}),
		},
		{
			groupName: 'Maintainer',
			groupId: 'maintainer',
			repos: matchAndTake(['tj/git-extras']),
		},
		{
			groupName: 'bpkg',
			groupId: 'bpkg',
			repos: matchAndTake(['bpkg/*']),
		},
		// {
		// 	name: 'Foxium Browser',
		// 	repositories: ['foxium-browser/*'],
		// },
		{
			groupName: 'hacks.guide',
			groupId: 'hacks-guide',
			repos: matchAndTake(['hacks-guide/*']),
		},
		{
			groupName: 'Bash Bastion',
			groupId: 'bash-bastion',
			repos: matchAndTake(['bash-bastion/*']),
		},
		{
			groupName: 'El Camino Computing Club',
			groupId: 'ecc-computing-club',
			repos: matchAndTake(['ecc-computing-club/*']),
		},
		{
			groupName: 'Language Language',
			groupId: 'language-language',
			repos: matchAndTake(['language-language/*']),
		},
		{
			groupName: 'Version Manager',
			groupId: 'version-manager',
			repos: matchAndTake(['version-manager/*']),
		},
		{
			groupName: 'Fox Lists',
			groupId: 'fox-lists',
			repos: matchAndTake(['fox-lists/*']),
		},
		{
			groupName: 'Fox Configuration',
			groupId: 'configuration-repos',
			repos: matchAndTake([
				'fox-self/*prettier*',
				'fox-self/*eslint*',
				'fox-self/*stylelint*',
				'fox-self/*lefthook*',
				'fox-self/*markdownlint*',
				'fox-self/hyperupcall-scripts-*',
				'fox-self/hyperupcall-config-utils',
			]),
		},
		{
			groupName: 'VSCode Extensions',
			groupId: 'vscode-extensions',
			repos: matchAndTake(['fox-self/vscode-*', 'fox-projects/vscode-*']),
		},
		{
			groupName: 'Other',
			groupId: 'other',
			repos: allRepositoryFullnames,
		},
	]
}

export async function getCachedRepositoryDetails() {
	const cachePath = path.join(import.meta.dirname, '../.data/repository-details.json')

	let json
	try {
		json = JSON.parse(await fs.readFile(cachePath, 'utf-8'))
	} catch (err) {
		if (err.code === 'ENOENT') {
			json = await getAllRepositoryDetails()
			await fs.mkdir(path.dirname(cachePath), { recursive: true })
			await fs.writeFile(cachePath, JSON.stringify(json, null, '\t'))
		} else {
			throw err
		}
	}

	return json
}

export async function getRepositoryDetails(fullName: string): Promise<RepoDetailsT> {
	return {
		fullName,
		isCloned: await fs
			.stat(path.join(Ctx.cloneDir, fullName))
			.then((stat) => stat.isDirectory())
			.catch((err) => {
				if (err.code === 'ENOENT') return false
				throw err
			}),
	}
}

export async function getAllRepositoryDetails(): Promise<RepoDetailsT[]> {
	const groups = await getCachedRepositoryGroups()
	const details = await Promise.all(
		groups
			.map((group) => {
				return group.repos.map((fullName) => {
					return getRepositoryDetails(fullName)
				})
			})
			.flat(),
	)
	return details
}

export async function collectGitHubRepositories(): Promise<
	Record<string, GitHubRepository[]>
> {
	// TODO
	const orgsToFetch = [
		'refined-github',
		'sindresorhus',
		'expressjs',
		'hacks-guide',
		'nodejs',
		'bash-it',
		'todotxt',
		'isaacs',
		'pallets',
	]

	const repositories: Record<string, GitHubRepository[]> = {}

	// Collect repositories from organizations.
	{
		const joinedOrganizations = []
		for await (const { data: memberships } of octokit.paginate.iterator(
			octokit.rest.orgs.listMembershipsForAuthenticatedUser,
			{
				per_page: 100,
			},
		)) {
			for (const membership of memberships) {
				// If user has joined the organization.
				if (membership.state !== 'active') {
					continue
				}

				// TODO
				// if (
				// 	config.ignored.some(
				// 		(pattern) => `${membership.organization.login}/*` === pattern,
				// 	)
				// ) {
				// 	console.info(`Ignoring org "${membership.organization.login}"`)
				// 	continue
				// }

				joinedOrganizations.push(membership.organization)
			}
		}
		const joinedOrganizationsData = await Promise.all(
			joinedOrganizations.map(async (organization) => {
				return await octokit
					.request('GET /orgs/{org}/repos', {
						org: organization.login,
						headers: {
							'X-GitHub-Api-Version': '2022-11-28',
						},
					})
					.then((res) => {
						return res.data
					})
			}),
		)
		for (let i = 0; i < joinedOrganizations.length; ++i) {
			const orgName = joinedOrganizations[i].login
			repositories[orgName] = joinedOrganizationsData[i].filter((repository) => {
				if (repository.archived) {
					// console.info(`Ignoring "${repository.full_name} (archived)"`)
					return false
				}

				for (const pattern of Ctx.ignoredRepos) {
					if (minimatch(repository.full_name, pattern, { dot: true })) {
						console.info(`Ignoring "${repository.full_name}"`)
						return false
					}
				}

				return true
			})
		}
	}

	// Collect repositories from currently signed-in user.
	{
		const currentGitHubUser = (await octokit.rest.users.getAuthenticated()).data.login
		const repos = []
		for await (const { data: repositories } of octokit.paginate.iterator(
			octokit.rest.repos.listForAuthenticatedUser,
			{
				affiliation: 'owner',
				per_page: 100,
			},
		)) {
			for (const repository of repositories) {
				if (
					Ctx.ignoredRepos.some((pattern) => minimatch(repository.full_name, pattern))
				) {
					console.info(`Ignoring "${repository.full_name}"`)
					continue
				}

				repos.push(repository)
			}
		}

		repositories[currentGitHubUser] = repos
	}

	return repositories
}
