import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import util, { styleText } from 'node:util'
import * as os from 'node:os'
import * as readline from 'node:readline/promises'
import { octokit } from '#common'
import untildify from 'untildify'
import { minimatch } from 'minimatch'

/**
 * @import { Octokit } from 'octokit'
 * @import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'
 * @typedef {GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.repos.get>} GitHubRepository
 */

// type RepositoryGroup = {
// 	name: string
// 	repositories: string[]
// }

export async function getRepositoryConfig() {
	const config = {
		// The following directories are associated with repositories. They either
		// contain cloned repositories or Git worktrees to cloned repositories.
		cloneDir: untildify('~/.dev/.data/managed-repositories'),
		repositoriesDir: untildify('~/Documents/Repositories'),
		machineRepositoriesDir: untildify('~/.dev/.data/machine-repositories'),
		ignored: [
			// Skip cloning from the following organizations:
			'eshsrobotics/*',
			'hackclub/*',
			// 'bpkg/*',
			'replit-discord/*',
			'gamedevunite-at-smc/*',
			// 'foxium-browser/*',
			'cs-club-smc/*',
			'ecc-cs-club/*',
			'quasipanacea/*',
			'semantic-hotkeys/*',
			'fox-archives/*',
			'fox-templates/*',
			'fox-forks/*',
			'asdf-contrib-hyperupcall/*',
			'fix-js/*',
			'big-blocks/*',
			'GameDevUniteAtECC/*',
			'swallowjs/*',
			'EpicGames/*',
			// Skip cloning from the following repositories:
			'SchemaStore/json-validator',
			'hyperupcall/hidden',
			'hyperupcall/secrets',
		],
	}
	const repositories = await collectGitHubRepositories(config)
	const /** @type {string[]} */ repositoryFullnames = []
	for (const orgName in repositories) {
		for (const repo of repositories[orgName]) {
			repositoryFullnames.push(repo.full_name)
		}
	}
	console.log(repositoryFullnames)
	function matchAndTake(/** @type {string[]} */ globs) {
		const taken = []
		for (const fullname of Array.from(repositoryFullnames)) {
			const matches = globs.every((glob) => minimatch(fullname, glob, { dot: true }))
			if (matches) {
				const idx = repositoryFullnames.findIndex((m) => m === fullname)
				repositoryFullnames.splice(idx, 1)
				taken.push(fullname)
			}
		}
		return taken
	}
	return {
		repositoryGroups: [
			{
				name: 'bpkg',
				repositories: matchAndTake(['bpkg/*']),
			},
			// {
			// 	name: 'Foxium Browser',
			// 	repositories: ['foxium-browser/*'],
			// },
			{
				name: 'hacks.guide',
				repositories: matchAndTake(['hacks-guide/*']),
			},
			{
				name: 'Bash Bastion',
				repositories: matchAndTake(['bash-bastion/*']),
			},
			{
				name: 'SchemaStore',
				repositories: matchAndTake(['SchemaStore/*', '!SchemaStore/json-validator']),
			},
			{
				name: 'El Camino Computing Club',
				repositories: matchAndTake(['ecc-computing-club/*']),
			},
			{
				name: 'Language Language',
				repositories: matchAndTake(['language-language/*']),
			},
			{
				name: 'Version Manager',
				repositories: matchAndTake(['version-manager/*']),
			},
			{
				name: 'Fox Lists',
				repositories: matchAndTake(['fox-lists/*']),
			},
			{
				name: 'Fox Configuration',
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
				repositories: matchAndTake(['fox-self/vscode-*', 'fox-projects/vscode-*']),
			},
			{
				name: 'Other',
				repositories: repositoryFullnames,
			},
		],
	}
}

export function setupRepositoryGroup(repositoryGroup) {}

export async function collectGitHubRepositories(config) {
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
					console.info(`Ignoring org "${membership.organization.login}" (not active)`)
					continue
				}

				if (
					config.ignored.some(
						(pattern) => `${membership.organization.login}/*` === pattern,
					)
				) {
					console.info(`Ignoring org "${membership.organization.login}"`)
					continue
				}

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
					console.info(`Ignoring "${repository.full_name} (archived)"`)
					return false
				}

				for (const pattern of config.ignored) {
					if (minimatch(repository.full_name, pattern)) {
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
				if (config.ignored.some((pattern) => minimatch(repository.full_name, pattern))) {
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
