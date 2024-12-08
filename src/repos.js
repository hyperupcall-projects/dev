import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as util from 'node:util'
import * as os from 'node:os'
import * as readline from 'node:readline/promises'

import { minimatch } from 'minimatch'
import { execa } from 'execa'
import untildify from 'untildify'
import yn from 'yn'
import chalk from 'chalk'

import { fileExists, octokit } from '#common'

/**
 * @import { Octokit } from 'octokit'
 * @import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'
 * @typedef {GetResponseDataTypeFromEndpointMethod<typeof octokit.rest.repos.get>} GitHubRepository
 *
 * @import { CommandReposOptions } from "../index.js";
 *
 * @typedef Config
 * @property {string} organizationsDir
 * @property {string[]} ignored
 */

export async function run(
	/** @type {CommandReposOptions} */ values,
	/** @type {string[]} */ positionals,
) {
	const config = {
		organizationsDir: untildify('~/.dev/.data/managed-repositories'),
		ignored: [
			// Skip cloning from the following organizations:
			'eshsrobotics/*',
			'hackclub/*',
			'bpkg/*',
			'replit-discord/*',
			'gamedevunite-at-smc/*',
			'foxium-browser/*',
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
	if (positionals[0] === 'sync') {
		await syncRepositories({ octokit, config })
	} else if (positionals[0] === 'run') {
		for (let orgEntry of await fs.readdir(config.organizationsDir, {
			withFileTypes: true,
		})) {
			for (let repoEntry of await fs.readdir(
				path.join(orgEntry.parentPath, orgEntry.name),
				{
					withFileTypes: true,
				},
			)) {
				const repoPath = path.join(repoEntry.parentPath, repoEntry.name)

				{
					let str = '\n\n\n'
					str += chalk.magenta.bold(repoPath) + chalk.reset() + '\n'
					str += '='.repeat(process.stdout.columns) + '\n'
					process.stdout.write(str)
				}

				const cmdName = positionals[1]
				const cmdArgs = positionals.slice(2)
				if (!cmdName) {
					console.error(`Failed determine command name`)
					process.exit(1)
				}
				const res = await execa(cmdName, cmdArgs, {
					cwd: repoPath,
					stdin: 'inherit',
					stdout: 'inherit',
					stderr: 'inherit',
				}).catch(() => {})
				if (res.exitCode > 1) {
					process.exit(1)
				}
			}
		}
	} else {
		console.error(`Unknown command: ${positionals[0]}`)
		process.exit(1)
	}
}

/**
 * @typedef SyncRepositoriesParams
 * @property {Octokit} octokit
 * @property {Config} config
 *
 * @param {SyncRepositoriesParams} options
 */
export async function syncRepositories({ octokit, config }) {
	{
		if (
			(await fs.lstat(config.organizationsDir)).isSymbolicLink() &&
			!(await fileExists(config.organizationsDir))
		) {
			process.stderr.write(
				`${chalk.red('Error:')} Symbolic link is broken: "${config.organizationsDir}"\n`,
			)
			process.exit(1)
		}
	}
	await fs.mkdir(config.organizationsDir, { recursive: true })

	/** @type {Record<string, GitHubRepository[]>} */
	const Repositories = {}
	function isValidRepository(
		/** @type {string} */ ownerName,
		/** @type {string} */ repoName,
	) {
		if (!(ownerName in Repositories)) {
			return false
		}

		for (const repository of Repositories[ownerName]) {
			if (repository.name === repoName) {
				return true
			}
		}

		return false
	}

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
			Repositories[orgName] = joinedOrganizationsData[i].filter((repository) => {
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

		Repositories[currentGitHubUser] = repos
	}

	// Check that no directories are empty
	{
		for (let orgStat of await fs.readdir(config.organizationsDir, {
			withFileTypes: true,
		})) {
			if (
				orgStat.isDirectory() &&
				(await fs.readdir(path.join(orgStat.parentPath, orgStat.name))).length === 0
			) {
				console.error(`❌ Expected a non-empty directory: ${orgStat.name}`)
			}
		}
	}

	// Check that each repository directory has a corresponding GitHub repository.
	{
		for (let orgEntry of await fs.readdir(config.organizationsDir, {
			withFileTypes: true,
		})) {
			for (let repoEntry of await fs.readdir(
				path.join(orgEntry.parentPath, orgEntry.name),
				{
					withFileTypes: true,
				},
			)) {
				if (!repoEntry.isDirectory()) {
					console.error(`❌ Expected a directory: ${orgEntry.name}${repoEntry.name}`)
				}

				if (!isValidRepository(orgEntry.name, repoEntry.name)) {
					console.error(
						`❌ Not on GitHub (but directory exists) (was repo newly hidden?): ${orgEntry.name}/${repoEntry.name}`,
					)
				}
			}
		}
	}

	// Check that each GitHub repository has a corresponding cloned repository directory.
	{
		for (let orgName in Repositories) {
			const repos = Repositories[orgName]
			for (let repo of repos) {
				let repoDir = path.join(config.organizationsDir, orgName, repo.name)

				if (!existsSync(repoDir)) {
					console.log(`❌ Not cloned: ${orgName}/${repo.name}`)
					const rl = readline.createInterface({
						input: process.stdin,
						output: process.stdout,
					})
					const input = await rl.question('Clone? (y/n): ')
					rl.close()
					if (yn(input)) {
						await execa('git', ['clone', `gh:${orgName}/${repo.name}`, repoDir], {
							stdin: 'inherit',
							stdout: 'inherit',
							stderr: 'inherit',
						})
					}
				}
			}
		}
	}

	// Check that each cloned GitHub repository is up to date
	{
		for (let orgName in Repositories) {
			const repos = Repositories[orgName]
			for (let repo of repos) {
				let repoDir = path.join(config.organizationsDir, orgName, repo.name)
				console.log(`Checking if ${orgName}/${repo.name} needs updates`)

				async function uptoDate(/** @type {string} */ repoDir) {
					await execa('git', ['-C', repoDir, 'fetch', '--all'])
					const result = await execa('git', [
						'-C',
						repoDir,
						'status',
						'--short',
						'--branch',
					])
					return !result.stdout.trim().includes('behind')
				}
				if (!(await uptoDate(repoDir))) {
					console.log(`❌ Not up to date: ${orgName}/${repo.name}`)
					const rl = readline.createInterface({
						input: process.stdin,
						output: process.stdout,
					})
					const input = await rl.question('Pull? (y/n): ')
					rl.close()
					if (yn(input)) {
						await execa('git', ['-C', repoDir, 'pull'], {
							stdin: 'inherit',
							stdout: 'inherit',
							stderr: 'inherit',
						})
					}
				}
			}
		}
	}

	// Check that each cloned organization directory has a corresponding GitHub organization.
	{
		for (let orgName of await fs.readdir(config.organizationsDir)) {
			if (!(orgName in Repositories)) {
				console.log(`❌ Organization not on GitHub: ${orgName}`)
			}
		}
	}

	// Check that there are no empty organization directories
	{
		for (let orgEntry of await fs.readdir(config.organizationsDir, {
			withFileTypes: true,
		})) {
			const children = await fs.readdir(path.join(orgEntry.parentPath, orgEntry.name))
			if (children.length === 0) {
				console.log(`❌ Organization directory should not be empty ${orgEntry.name}`)
			}
		}
	}
}
