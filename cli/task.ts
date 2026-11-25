import * as path from 'node:path'
import * as os from 'node:os'

import { minimatch } from 'minimatch'
import micromatch from 'micromatch'
import yn from 'yn'

import { forEachRepository, prompt } from '#utilities/util.ts'
import { octokit } from '#utilities/util.ts'
import { createVSCodeDesktopApplication, toggleEditorTools } from '#utilities/ide.ts'

import type { PackageJson } from 'type-fest'
import * as fs from 'node:fs'
import process from 'node:process'
import walk from 'ignore-walk'
import { getDevConfig } from '#utilities/dev-config.ts'
import type { Config } from '#types'

type TaskConfig = {
	organizationsDir: string
	ignoredOrganizations: string[]
	hiddenDirsRepositoryDir: string
}

async function getTaskConfig(): Promise<TaskConfig> {
	const devConfig = await getDevConfig()
	return {
		organizationsDir: devConfig.paths.managedRepositories,
		ignoredOrganizations: [
			'ecc-cs-club',
			'quasipanacea',
			'semantic-hotkeys',
			'hyperupcall-archives',
			'hyperupcall-templates',
			'hyperupcall-forks',
			'fix-js',
			'big-blocks',
			'swallowjs',
			'SchemaStore/json-validator',
		],
		hiddenDirsRepositoryDir:
			devConfig.paths.hiddenDirsRepositoryDir ??
			path.join(path.dirname(devConfig.paths.managedRepositories), 'hidden-dirs'),
	}
}

export async function runCheckLicenseHeaders() {
	const config = await getTaskConfig()
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
			walker.onReadIgnoreFile('__custom_ignore__', '**/.git/*', () => {})
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

	async function onFile(filepath: string) {
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
			micromatch.isMatch(
				filename,
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

export async function runSymlinkHiddenDirs() {
	const config = await getTaskConfig()
	await forEachRepository(
		config.organizationsDir,
		{},
		async function run({ orgDir, orgEntry, repoDir, repoEntry }) {
			const oldHiddenDir = path.join(repoDir, '.hidden')
			const newHiddenDir = path.join(config.hiddenDirsRepositoryDir, repoEntry.name)
			const newHiddenDirPretty = path.join(
				path.basename(path.dirname(newHiddenDir)),
				path.basename(newHiddenDir),
			)

			let oldHiddenDirStat: fs.Stats | undefined
			let newHiddenDirStat: fs.Stats | undefined
			const restat = async function restat() {
				try {
					oldHiddenDirStat = fs.lstatSync(oldHiddenDir)
				} catch (err: any) {
					if (err.code !== 'ENOENT') {
						throw err
					}
				}

				try {
					newHiddenDirStat = fs.lstatSync(newHiddenDir)
				} catch (err: any) {
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
				const input = await prompt(`Move? ${newHiddenDirPretty} (y/n): `)
				if (!yn(input)) {
					// Keep the hidden directory where it is.
					return
				}

				fs.mkdirSync(path.dirname(newHiddenDir), {
					recursive: true,
					mode: 0o755,
				})
				fs.renameSync(oldHiddenDir, newHiddenDir)
				await restat()
			}

			fs.rmSync(oldHiddenDir, { force: true, recursive: true })
			if (newHiddenDirStat) {
				fs.symlinkSync(newHiddenDir, oldHiddenDir)
			}
		},
	)
}

export async function runValidateHyperupcallArchives() {
	for await (const { data: repositories } of octokit.paginate.iterator(
		octokit.rest.repos.listForOrg,
		{
			org: 'hyperupcall-archives',
		},
	)) {
		for (const repository of repositories) {
			if (repository.name === '.github') {
				continue
			}
			console.info(`Checking ${repository.name}`)

			if (!repository.archived) {
				console.error(`Error: Repository is not archived: ${repository.name}`)
				process.exit(1)
			}
		}
	}
}

export async function runCreateVSCodeLaunchers({ config }: { config: Config }) {
	const publisher = config.manifest.package_json_publisher
	const extensions: { dirname: string; packageJson: PackageJson }[] = await (
		await fetch(
			`https://raw.githubusercontent.com/hyperupcall-projects/vscode-hyperupcall-packs/refs/heads/main/extension-list.json`,
		)
	).json()

	for (const { dirname, packageJson } of extensions) {
		if (
			!dirname.startsWith('pack-ecosystem-') ||
			dirname === 'pack-ecosystem-all' ||
			dirname === 'pack-ecosystem-other'
		) {
			continue
		}

		const variantId = dirname.slice('pack-ecosystem-'.length)
		const variantName =
			typeof packageJson.displayName === 'string'
				? packageJson.displayName.split(':')[1]?.trimStart()
				: undefined
		if (!variantId || !variantName) {
			throw new Error(`Invalid ecosystem extension metadata: ${dirname}`)
		}

		await createVSCodeDesktopApplication({
			variantId,
			variantName,
			extensions: [
				`${publisher}.vscode-hyperupcall-pack-base`,
				`${publisher}.vscode-hyperupcall-pack-bundled-themes`,
				`${publisher}.vscode-hyperupcall-pack-icons`,
				`${publisher}.vscode-hyperupcall-pack-markdown`,
				`${publisher}.${packageJson.name}`,
			],
		})
	}

	await createVSCodeDesktopApplication({
		variantId: 'devdotfiles',
		variantName: 'devdotfiles',
		extensions: [
			`${publisher}.vscode-hyperupcall-pack-base`,
			`${publisher}.vscode-hyperupcall-pack-bundled-themes`,
			`${publisher}.vscode-hyperupcall-pack-icons`,
			`${publisher}.vscode-hyperupcall-pack-markdown`,
			`${publisher}.vscode-hyperupcall-pack-unix`,
			`${publisher}.vscode-hyperupcall-pack-python`,
			`${publisher}.vscode-hyperupcall-pack-rust`,
			`${publisher}.vscode-hyperupcall-pack-web`,
		],
	})

	const configDir = (process.env.XDG_CONFIG_HOME ?? '').startsWith('/')
		? (process.env.XDG_CONFIG_HOME ?? '')
		: path.join(os.homedir(), '.config')

	await createVSCodeDesktopApplication({
		variantId: 'vscode',
		variantName: 'vscode',
		overrides: {
			datadir: path.join(configDir, 'Code'),
			extdir: path.join(os.homedir(), '.vscode/extensions'),
		},
		extensions: [
			`${publisher}.vscode-hyperupcall-pack-base`,
			`${publisher}.vscode-hyperupcall-pack-bundled-themes`,
			`${publisher}.vscode-hyperupcall-pack-icons`,
			`${publisher}.vscode-hyperupcall-pack-markdown`,
			`${publisher}.vscode-hyperupcall-pack-unix`,
			`${publisher}.vscode-hyperupcall-pack-python`,
			`${publisher}.vscode-hyperupcall-pack-rust`,
			`${publisher}.vscode-hyperupcall-pack-web`,
			`${publisher}.vscode-hyperupcall-pack-cpp`,
			`${publisher}.vscode-hyperupcall-pack-go`,
		],
	})

	console.info(`Be sure to open "Window Rules" application and hit apply.`)
}

export async function runToggleTools() {
	await toggleEditorTools()
}
