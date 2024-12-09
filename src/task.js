import * as fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import * as readline from 'node:readline/promises'
import * as util from 'node:util'

import { minimatch } from 'minimatch'
import { globby } from 'globby'
import { execa } from 'execa'
import untildify from 'untildify'
import yn from 'yn'

import { forEachRepository } from './util.js'
import { octokit } from '#common'

/**
 * @import { CommandScriptOptions } from '../index.js'
 */

export async function run(
	/** @type {CommandScriptOptions} */ values,
	/** @type {string[]} */ positionals,
) {
	const task = positionals[0]

	const helpText = `script <taskName>
TASKS:

check-license-headers
`
	if (values.help) {
		console.info(helpText)
	}
	if (!task) {
		process.stdout.write(helpText)
		process.exit(1)
	}

	if (task === 'check-license-headers') {
		await checkLicenseHeaders(positionals.slice(1))
	} else if (task === 'symlink-hidden-dirs') {
		await symlinkHiddenDirs(positionals.slice(1))
	} else if (task === 'validate-fox-archives') {
		await validateFoxArchives(positionals.slice(1))
	} else {
		process.stdout.write('Error: Failed to pass task name\n')
		process.exit(1)
	}
}

export async function checkLicenseHeaders(/** @type {string[]} */ args) {
	await forEachRepository(
		config.organizationsDir,
		{ ignores: config.ignoredOrganizations },
		async function run({ orgDir, orgEntry, repoDir, repoEntry }) {
			// Unfortunately, globby is too buggy when finding and using ignore files.
			// Instead, use 'ignore-walk', which does require a few hacks.
			const walker = new walk.Walker({
				path: repoDir,
				ignoreFiles: ['.gitignore', '.ignore', '__custom_ignore__'],
			})
			walker.ignoreRules['__custom_ignore__'] = ['.git'].map(
				(dirname) =>
					new minimatch.Minimatch(`**/${dirname}/*`, {
						dot: true,
						flipNegate: true,
					}),
			)
			walker.on('done', async (files) => {
				for (const file of files) {
					const filepath = path.join(repoDir, file)
					await onFile(filepath)
				}
			})
			walker.on('error', (err) => {
				if (err) {
					throw err
				}
			})
			walker.start()
		},
	)

	async function onFile(/** @type {string} */ filepath) {
		const filename = path.basename(filepath)

		if (
			micromatch.isMatch(
				filename,
				[
					'*.{js{,x},{m,c}js,ts{,x},{m,c}ts,svelte,vue,java,kt,gradle,groovy,properties,rs,c,h,cc,cpp,hpp,go}',
				],
				{ dot: true, nocase: true },
			)
		) {
			// console.log('//')
		} else if (
			micromatch.isMatch(
				filename,
				[
					'*.{py,rb,sh,bash,bats,zsh,ksh,fish,elv,nu,ps1,yml,yaml,jsonc,jq,Containerfile,Dockerfile,service,desktop,conf,ini,mk,pl,inc,hcl}',
					'Vagrantfile',
					'meson.build',
					'Containerfile',
					'Dockerfile',
					'.*ignore',
					'.gitattributes',
					'.editorconfig',
					'.gemspec',
					'makefile',
				],
				{ dot: true, nocase: true },
			)
		) {
			// console.log('#')
		} else if (
			minimatch(filename, '*.{xml,html,md,toml,pro}', {
				dot: true,
				nocase: true,
			})
		) {
			// console.log('<!-- -->')
		} else if (
			minimatch(filename, '*.{css,scss,sass,less,styl}', {
				dot: true,
				nocase: true,
			})
		) {
			// console.log('/* */')
		} else if (
			minimatch(filename, '*.{1,2,3,4,5,6,7,8,9,njk,m4,ml,hbs,rst}', {
				dot: true,
				nocase: true,
			})
			// .\"
		) {
		} else if (
			minimatch(
				filename,
				[
					[
						'*.{json,sublime-snippet,webmanifest,code-snippets,map,gradlew,webp,bat,jar,woff,woff2,png,jpg,jpeg,ttf,eot,svg,ico,gif,lock,zip,7z,gz,content,bin,asc,gpg,snap,txt,sum,work,test,log,emu,parsed,patch,diff,flattened,pdf,csv}',
						'*.a*',
						'*.so*',
						'*.env*',
						'*.txt',
						'*.test',
						'1.*',
						'CNAME',
						'go.mod',
					],
					'*LICENSE*',
					'*COPYING*',
					'bake',
				],
				{ dot: true, nocase: true },
			) ||
			path.parse(filepath).ext === ''
		) {
			// skip
		} else {
			// console.log(`Not recognized: ${filepath}`)
		}
	}
}

export async function symlinkHiddenDirs(/** @type {string[]} */ args) {
	await forEachRepository(
		config.organizationsDir,
		async function run({ orgDir, orgEntry, repoDir, repoEntry }) {
			const oldHiddenDir = path.join(repoDir, '.hidden')
			const newHiddenDir = path.join(config.hiddenDirsRepositoryDir, repoEntry.name)
			const newHiddenDirPretty = path.join(
				path.basename(path.dirname(newHiddenDir)),
				path.basename(newHiddenDir),
			)

			let oldHiddenDirStat
			let newHiddenDirStat
			const restat = async function restat() {
				try {
					oldHiddenDirStat = await fs.lstat(oldHiddenDir)
				} catch (err) {
					if (err.code !== 'ENOENT') {
						throw err
					}
				}

				try {
					newHiddenDirStat = await fs.lstat(newHiddenDir)
				} catch (err) {
					if (err.code !== 'ENOENT') {
						throw err
					}
				}
			}
			await restat()

			if (
				oldHiddenDirStat &&
				!oldHiddenDirStat.isSymbolicLink() &&
				!oldHiddenDirStat.isDirectory()
			) {
				console.error(`Error: Hidden directory must be a directory: ${oldHiddenDir}`)
				process.exit(1)
			}

			if (
				newHiddenDirStat &&
				!newHiddenDirStat.isSymbolicLink() &&
				!newHiddenDirStat.isDirectory()
			) {
				console.error(`Error: Hidden directory must be a directory: ${newHiddenDir}`)
				process.exit(1)
			}

			// The 'newHiddenDir' now is either a directory or does not exist.
			if (
				!newHiddenDirStat &&
				oldHiddenDirStat &&
				!oldHiddenDirStat.isSymbolicLink() &&
				oldHiddenDirStat.isDirectory()
			) {
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout,
				})
				const input = await rl.question(`Move? ${newHiddenDirPretty} (y/n): `)
				rl.close()
				if (yn(input)) {
					await fs.mkdir(path.dirname(newHiddenDir), {
						recursive: true,
						mode: 0o755,
					})
					await fs.rename(oldHiddenDir, newHiddenDir)
					await restat()
				}
			}

			await fs.rm(oldHiddenDir, { force: true })
			if (newHiddenDirStat) {
				await fs.symlink(newHiddenDir, oldHiddenDir)
			}
		},
	)
}

async function validateFoxArchives(/** @type {string} */ args) {
	for await (const { data: repositories } of octokit.paginate.iterator(
		octokit.rest.repos.listForOrg,
		{
			org: 'fox-archives',
		},
	)) {
		for (const repository of repositories) {
			if (repository.name === '.github') {
				continue
			}
			console.log(`Checking ${repository.name}`)

			if (!repository.archived) {
				console.error(`Error: Repository is not archived: ${repository.name}`)
				process.exit(1)
			}
		}
	}
}
