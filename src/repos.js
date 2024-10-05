import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as readline from 'node:readline/promises'

import { minimatch } from 'minimatch'
import { globby } from 'globby'
import { execa } from 'execa'
import untildify from 'untildify'
import yn from 'yn'
import chalk from 'chalk'

import { fileExists, octokit } from '../config/common.js'

/**
 * @typedef {import('octokit').Octokit} Octokit
 *
 * @typedef Config
 * @property {string} organizationsDir
 * @property {string[]} ignored
 */

export async function run(/** @type {string[]} args */ args) {
	const config = {
		organizationsDir: untildify('~/.hidden/repositories'),
		ignored: [
			'eshsrobotics/*',
			'hackclub/*',
			'bpkg/*',
			'replit-discord/*',
			'gamedevunite-at-smc/*',
			'chesslablab/*',
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
			'fix-lists/*',
			'big-blocks/*',
			'GameDevUniteAtECC/*',
			'swallowjs/*',
			'AdventOfVim/*',
			'aovim/*',
			'SchemaStore/json-validator',
			'hyperupcall/hidden',
			'hyperupcall/secrets',
		],
	}
	await syncRepositories({ octokit, config })
}

/**
 * @typedef FunctionOptions
 * @property {Octokit} octokit
 * @property {Config} config
 *
 * @param {FunctionOptions} options
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

	const githubOwner = (await octokit.rest.users.getAuthenticated()).data.login
	{
		const orgList = []
		for await (const { data: organizations } of octokit.paginate.iterator(
			octokit.rest.orgs.listMembershipsForAuthenticatedUser,
			{
				per_page: 100,
			},
		)) {
			for (const organization of organizations) {
				orgList.push(organization)
			}
		}

		const reposMap = await getOrgRepoMap(octokit, orgList, config)
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

				if (Array.isArray(reposMap.get(repository.owner.login))) {
					reposMap.get(repository.owner.login).push(repository.name)
				} else {
					reposMap.set(repository.owner.login, [repository.name])
				}
			}
		}
		const reposList = []
		for (let [orgName, repos] of reposMap.entries()) {
			for (const repo of repos) {
				reposList.push(`${orgName}/${repo}`)
			}
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

					if (!reposList.includes(`${orgEntry.name}/${repoEntry.name}`)) {
						console.error(
							`❌ Not on GitHub (but directory exists) (was repo newly hidden?): ${orgEntry.name}/${repoEntry.name}`,
						)
					}
				}
			}
		}

		// Check that each GitHub repository has a corresponding cloned repository directory.
		{
			for (let [orgName, repos] of reposMap.entries()) {
				for (let repo of repos) {
					let repoDir = path.join(config.organizationsDir, orgName, repo)

					if (!existsSync(repoDir)) {
						console.log(`❌ Not cloned: ${orgName}/${repo}`)
						const rl = readline.createInterface({
							input: process.stdin,
							output: process.stdout,
						})
						const input = await rl.question('Clone? (y/n): ')
						rl.close()
						if (yn(input)) {
							await execa('git', ['clone', `gh:${orgName}/${repo}`, repoDir], {
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
				const isOnGitHub = orgList.some(
					(orgName2) => orgName2.organization.login === orgName,
				)
				if (!isOnGitHub && orgName !== githubOwner) {
					console.log(`❌ Not on GitHub: ${orgName}`)
				}
			}
		}

		// Check that each GitHub organization has a corresponding cloned organization directory.
		{
			// if (repos.length === 0) {
			// 	let orgDir = path.join(config.organizationsDir, orgName)
			// 	let exist = existsSync(orgDir)
			// 	if (!exist) {
			// 		console.log(`❌ No directory for organization: ${orgName}`)
			// 	}
			// }
		}

		// Check that there are no empty directories that correspond to GitHub organizations.
		{
			for (let orgEntry of await fs.readdir(config.organizationsDir, {
				withFileTypes: true,
			})) {
				const children = await fs.readdir(path.join(orgEntry.path, orgEntry.name))
				if (children.length === 0) {
					console.log(`❌ No repositories for organization: ${orgEntry.name}`)
				}
			}
		}
	}
}

/**
 * @param {Octokit} octokit
 * @param {GetResponseDataTypeFromEndpointMethod<typeof Octokit. orgs.listMembershipsForAuthenticatedUser>} allOrganizations
 * @param {Config} config
 */
async function getOrgRepoMap(octokit, allOrganizations, config) {
	const filteredOrgs = allOrganizations
		.map((item) => item.organization.login)
		.filter((orgName) => {
			for (const pattern of config.ignored) {
				if (minimatch(`${orgName}/*`, pattern)) {
					console.log(`Ignoring "${orgName}"`)
					return false
				}
			}
			return true
		})
	const filteredRepos = await Promise.all(
		filteredOrgs.map((orgName) => {
			return octokit
				.request('GET /orgs/{org}/repos', {
					org: orgName,
					headers: {
						'X-GitHub-Api-Version': '2022-11-28',
					},
				})
				.then((res) => {
					return res.data.map((item) => item.name)
				})
		}),
	)

	const map = new Map()
	for (let i = 0; i < filteredRepos.length; ++i) {
		let org = filteredOrgs[i]
		let repos = filteredRepos[i]

		map.set(org, repos)
	}

	return map
}
