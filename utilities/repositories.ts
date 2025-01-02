import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import util, { styleText } from 'node:util'
import * as os from 'node:os'
import * as readline from 'node:readline/promises'
import { fileExists, octokit } from '#common'
import untildify from 'untildify'
import { minimatch } from 'minimatch'

import type { Octokit } from 'octokit'
import type { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'
type GitHubRepository = GetResponseDataTypeFromEndpointMethod<
	typeof octokit.rest.repos.get
>

export async function getCachedRepositoryConfig() {
	const cachePath = path.join(
		import.meta.dirname,
		'../dev-server/static/repositories.json',
	)

	let json
	try {
		json = JSON.parse(await fs.readFile(cachePath, 'utf-8'))
	} catch (err) {
		if (err.code === 'ENOENT') {
			json = await getRepositoryConfig()
			await fs.mkdir(path.dirname(cachePath), { recursive: true })
			await fs.writeFile(cachePath, JSON.stringify(json, null, '\t'))
		} else {
			throw err
		}
	}

	return json
}

export type ClonedReposConfig = {
	cloneDir: string
	symlinkedRepositoriesDir: string
	repositoryGroups: {
		name: string
		id: string
		repositories: string[]
	}[]
}

type OriginalConfig = {
	ignoredRepos: string[]
}

export async function getRepositoryConfig(): Promise<ClonedReposConfig> {
	const config = {
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

	const repositories = await collectGitHubRepositories(config)
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

	return {
		cloneDir: untildify('~/.dev/.data/cloned-repositories'),
		symlinkedRepositoriesDir: untildify('~/Documents/Repositories'),
		repositoryGroups: [
			{
				name: 'Personal',
				id: 'personal',
				repositories: matchAndTake([
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
				name: 'JSON Schema',
				id: 'json-schema',
				repositories: matchAndTake(
					['SchemaStore/*', 'fox-projects/jsonschema-extractor'],
					{
						not: ['SchemaStore/json-validator'],
					},
				),
			},
			{
				name: 'Maintainer',
				id: 'maintainer',
				repositories: matchAndTake(['tj/git-extras']),
			},
			{
				name: 'bpkg',
				id: 'bpkg',
				repositories: matchAndTake(['bpkg/*']),
			},
			// {
			// 	name: 'Foxium Browser',
			// 	repositories: ['foxium-browser/*'],
			// },
			{
				name: 'hacks.guide',
				id: 'hacks-guide',
				repositories: matchAndTake(['hacks-guide/*']),
			},
			{
				name: 'Bash Bastion',
				id: 'bash-bastion',
				repositories: matchAndTake(['bash-bastion/*']),
			},
			{
				name: 'El Camino Computing Club',
				id: 'ecc-computing-club',
				repositories: matchAndTake(['ecc-computing-club/*']),
			},
			{
				name: 'Language Language',
				id: 'language-language',
				repositories: matchAndTake(['language-language/*']),
			},
			{
				name: 'Version Manager',
				id: 'version-manager',
				repositories: matchAndTake(['version-manager/*']),
			},
			{
				name: 'Fox Lists',
				id: 'fox-lists',
				repositories: matchAndTake(['fox-lists/*']),
			},
			{
				name: 'Fox Configuration',
				id: 'configuration-repos',
				repositories: matchAndTake([
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
				name: 'VSCode Extensions',
				id: 'vscode-extensions',
				repositories: matchAndTake(['fox-self/vscode-*', 'fox-projects/vscode-*']),
			},
			{
				name: 'Other',
				id: 'other',
				repositories: allRepositoryFullnames,
			},
		],
	}
}

type GitHubRepository = GetResponseDataTypeFromEndpointMethod<
	typeof octokit.rest.repos.get
>

export async function collectGitHubRepositories(
	config: OriginalConfig,
): Record<string, GitHubRepository[]> {
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

	/** @type {Record<string, GitHubRepository[]>} */
	const repositories = {}

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

				for (const pattern of config.ignoredRepos) {
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
					config.ignoredRepos.some((pattern) => minimatch(repository.full_name, pattern))
				) {
					console.log(`Ignoring "${repository.full_name}"`)
					continue
				}

				repos.push(repository)
			}
		}

		repositories[currentGitHubUser] = repos
	}

	return repositories
}
