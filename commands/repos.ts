import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import { styleText } from 'node:util'
import * as os from 'node:os'
import * as readline from 'node:readline/promises'
import { execa } from 'execa'
import untildify from 'untildify'
import yn from 'yn'
import * as inquirer from '@inquirer/prompts'

import { fileExists, octokit } from '#common'
import { collectGitHubRepositories, collectGitHubRepositories2 } from '#utilities/repositories.ts'
import type { Octokit } from 'octokit'
import { getEcosystems } from '../devutils/index.ts'
import process from 'node:process'

type Config = {
	organizationsDir: string
	ignored: string[]
}

export async function run(options: CommandScriptOptions, positionals: string[]) {
	const config = {
		organizationsDir: untildify('~/.dev/.data/managed-repositories'),
		repositoryGroups: [
			{
				name: 'bpkg',
				repositories: ['bpkg/*'],
			},
			// {
			// 	name: 'Foxium Browser',
			// 	repositories: ['foxium-browser/*'],
			// },
			{
				name: 'hacks.guide',
				repositories: ['hacks-guide/*'],
			},
			{
				name: 'Bash Bastion',
				repoitories: ['bash-bastion/*'],
			},
			{
				name: 'SchemaStore',
				repositories: ['SchemaStore/*', '!SchemaStore/json-validator'],
			},
		],
		ignored: [
			// Skip cloning from the following organizations:

			// 'bpkg/*',

			'ecc-cs-club/*',
			'quasipanacea/*',
			'semantic-hotkeys/*',
			'fox-archives/*',
			'fox-templates/*',
			'fox-forks/*',

			'fix-js/*',
			'big-blocks/*',

			'swallowjs/*',

			// Skip cloning from the following repositories:
			'SchemaStore/json-validator',
		],
	}
	if (positionals[0] === 'fetch-repository-data') {
		const Repositories = await collectGitHubRepositories2(
			{
				fromCurrentlyAuthenticatedUser: true, // hyperupcall
				users: [
					'sindresorhus',
					'isaacs',
				],
				organizations: [
					'refined-github',
					'expressjs',
					'hacks-guide',
					'todotxt',
					'pallets',
					'Bash-it',
				],
				ignored: [
					'eshsrobotics/*',
					'hackclub/*',
					'replit-discord/*',
					'gamedevunite-at-smc/*',
					'cs-club-smc/*',
					'hyperupcall-archives/*',
					'fox-forks/*', // TODO
					'foxium-browser/*',
					'hyperupcall-forks/*',
					'asdf-contrib-hyperupcall/*',
					'GameDevUniteAtECC/*',
					'EpicGames/*',
					'hyperupcall/hidden',
				],
			},
		)

		// TODO
		await fs.writeFile(
			path.join(os.homedir(), '.dotfiles/.data/repositories.json'),
			JSON.stringify(Repositories, null, '\t'),
		)
	} else if (positionals[0] === 'tui') {
		const repositories = JSON.parse(
			await fs.readFile(path.join(os.homedir(), '.dotfiles/.data/repositories.json'), 'utf-8'),
		)
		const allRepoNames: string[] = []
		for (const orgName in repositories) {
			for (const repo of repositories[orgName]) {
				allRepoNames.push(`${orgName}/${repo.name}`)
			}
		}

		const repository = await inquirer.search({
			message: 'Select repository',
			source: async (input) => {
				return allRepoNames
					.filter((fullName) => fullName.includes(input ?? ''))
					.map((fullName) => ({
						name: fullName,
						value: fullName,
						description: '',
					}))
			},
		})
		const dir = getRepositoryDestDirectory(repository)
		if (!existsSync(dir)) {
			if (
				await inquirer.confirm({
					message: 'Would you like to clone this repository?',
				})
			) {
				await execa({
					stdout: 'inherit',
					stderr: 'inherit',
				})`git clone git@github.com:${repository} ${dir}`
			}
		}
		const action = await inquirer.select({
			message: 'Choose action',
			choices: [
				{
					name: 'Open in VSCode (Default)',
					value: 'vscode-default',
				},
				{
					name: 'Open in VSCode (Ecosystem)',
					value: 'vscode-ecosystem',
				},
				{
					name: 'Open in VSCode Insiders',
					value: 'vscode-insiders',
				},
				{
					name: 'Open in Zed',
					value: 'zed',
				},
			],
		})
		switch (action) {
			case 'vscode-default':
				await execa({
					stdout: 'inherit',
					stderr: 'inherit',
				})`code ${dir}`
				break
			case 'vscode-ecosystem': {
				let packname = ''
				const ecosystems = await getEcosystems(dir)
				let stop = false
				for (const ecosystem of ecosystems) {
					switch (ecosystem) {
						case 'nodejs':
						case 'deno':
							packname = 'vscode-hyperupcall-pack-web'
							stop = true
							break
						case 'c':
							packname = 'vscode-hyperupcall-pack-cpp'
							stop = true
							break
						case 'cpp':
							packname = 'vscode-hyperupcall-pack-cpp'
							stop = true
							break
					}

					if (stop) {
						break
					}
				}

				if (!packname) {
					console.info(`An ecosystem could not be inferred...`)
					Deno.exit(1) // TODO
				}

				// TODO: put in function
				await execa({
					stdout: 'inherit',
					stderr: 'inherit',
				})`code-with-extension-path EdwinKofler ${packname} --new-window ${dir}`
				break
			}
			case 'vscode-insiders':
				await execa({
					stdout: 'inherit',
					stderr: 'inherit',
				})`code-insiders ${dir}`
				break
			case 'zed':
				await execa({
					stdout: 'inherit',
					stderr: 'inherit',
				})`zed ${dir}`
				break
		}
	} else if (positionals[0] === 'sync') {
		await syncRepositories({ octokit, config })
	} else if (positionals[0] === 'run') {
		for (
			const orgEntry of await fs.readdir(config.organizationsDir, {
				withFileTypes: true,
			})
		) {
			for (
				const repoEntry of await fs.readdir(
					path.join(orgEntry.parentPath, orgEntry.name),
					{
						withFileTypes: true,
					},
				)
			) {
				const repoPath = path.join(repoEntry.parentPath, repoEntry.name)

				{
					let str = '\n\n\n'
					str += styleText(['magenta', 'bold'], repoPath) + styleText('reset', '') + '\n'
					str += '='.repeat(Deno.consoleSize().columns) + '\n'
					Deno.stdout.write(new TextEncoder().encode(str))
				}

				const cmdName = positionals[1]
				const cmdArgs = positionals.slice(2)
				if (!cmdName) {
					console.error(`Failed determine command name`)
					Deno.exit(1)
				}
				const child = await execa(cmdName, cmdArgs, {
					cwd: repoPath,
					stdin: 'inherit',
					stdout: 'inherit',
					stderr: 'inherit',
				}).catch(() => {})
				if (!child || !child.exitCode || child.exitCode > 1) {
					Deno.exit(1)
				}
			}
		}
	} else {
		console.error(`Unknown command: ${positionals[0]}`)
		Deno.exit(1)
	}
}

export async function syncRepositories({
	octokit,
	config,
}: {
	octokit: Octokit
	config: Config
}) {
	{
		if (
			(await fs.lstat(config.organizationsDir)).isSymbolicLink() &&
			!(await fileExists(config.organizationsDir))
		) {
			process.stderr.write(
				`${styleText('red', 'Error:')} Symbolic link is broken: "${config.organizationsDir}"\n`,
			)
			Deno.exit(1)
		}
	}
	await fs.mkdir(config.organizationsDir, { recursive: true })

	const Repositories = await collectGitHubRepositories()
	// Check that no directories are empty
	{
		for (
			const orgStat of await fs.readdir(config.organizationsDir, {
				withFileTypes: true,
			})
		) {
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
		for (
			const orgEntry of await fs.readdir(config.organizationsDir, {
				withFileTypes: true,
			})
		) {
			for (
				const repoEntry of await fs.readdir(
					path.join(orgEntry.parentPath, orgEntry.name),
					{
						withFileTypes: true,
					},
				)
			) {
				if (!repoEntry.isDirectory()) {
					console.error(`❌ Expected a directory: ${orgEntry.name}${repoEntry.name}`)
				}

				function isValidRepository(ownerName: string, repoName: string) {
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
		for (const orgName in Repositories) {
			const repos = Repositories[orgName]
			for (const repo of repos) {
				const repoDir = path.join(config.organizationsDir, orgName, repo.name)

				if (!existsSync(repoDir)) {
					console.info(`❌ Not cloned: ${orgName}/${repo.name}`)
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
		for (const orgName in Repositories) {
			const repos = Repositories[orgName]
			for (const repo of repos) {
				const repoDir = path.join(config.organizationsDir, orgName, repo.name)
				console.info(`Checking if ${orgName}/${repo.name} needs updates`)

				async function uptoDate(repoDir: string) {
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
					console.info(`❌ Not up to date: ${orgName}/${repo.name}`)
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
		for (const orgName of await fs.readdir(config.organizationsDir)) {
			if (!(orgName in Repositories)) {
				console.info(`❌ Organization not on GitHub: ${orgName}`)
			}
		}
	}

	// Check that there are no empty organization directories.
	{
		for (
			const orgEntry of await fs.readdir(config.organizationsDir, {
				withFileTypes: true,
			})
		) {
			const children = await fs.readdir(path.join(orgEntry.parentPath, orgEntry.name))
			if (children.length === 0) {
				console.info(`❌ Organization directory should not be empty ${orgEntry.name}`)
			}
		}
	}
}

function getRepositoryDestDirectory(repository: string) {
	switch (repository) {
		case 'hyperupcall-projects/dev':
			return path.join(os.homedir(), '.dev')
		case 'hyperupcall/dotfiles':
			return path.join(os.homedir(), '.dotfiles')
		default:
			return path.join(os.homedir(), '/Documents/Code', repository)
	}
}
