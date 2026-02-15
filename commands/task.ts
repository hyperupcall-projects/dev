import * as path from 'node:path'
import * as os from 'node:os'

import { minimatch } from 'minimatch'
import micromatch from 'micromatch'
import yn from 'yn'

import { forEachRepository } from '#utilities/util.ts'
import { octokit } from '#common'

import type { CommandScriptOptions } from '#types'
import { execa } from 'execa'
import type { PackageJson } from 'type-fest'
import * as fs from 'node:fs'
import { styleText } from 'node:util'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import walk from 'ignore-walk'

export async function run(options: CommandScriptOptions, positionals: string[]) {
	const task = positionals[0]

	const helpText = `script <taskName>
TASKS:

check-license-headers
symlink-hidden-dirs
validate-fox-archives
create-vscode-launchers
`
	if (options.help) {
		console.info(helpText)
	}
	if (!task) {
		Deno.stdout.write(new TextEncoder().encode(helpText))
		process.exit(1)
	}

	if (task === 'check-license-headers') {
		await checkLicenseHeaders(positionals.slice(1))
	} else if (task === 'symlink-hidden-dirs') {
		await symlinkHiddenDirs(positionals.slice(1))
	} else if (task === 'validate-fox-archives') {
		await validateFoxArchives(positionals.slice(1))
	} else if (task === 'create-vscode-launchers') {
		await createVSCodeLaunchers(positionals.slice(1))
	} else {
		Deno.stdout.write(new TextEncoder().encode('Error: Failed to pass task name\n'))
		process.exit(1)
	}
}

export async function checkLicenseHeaders(positionals: string[]) {
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

export async function symlinkHiddenDirs(positionals: string[]) {
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
					oldHiddenDirStat = fs.lstatSync(oldHiddenDir)
				} catch (err) {
					if (err.code !== 'ENOENT') {
						throw err
					}
				}

				try {
					newHiddenDirStat = fs.lstatSync(newHiddenDir)
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
				const input = await prompt(`Move? ${newHiddenDirPretty} (y/n): `)
				if (yn(input)) {
					Deno.mkdirSync(path.dirname(newHiddenDir), {
						recursive: true,
						mode: 0o755,
					})
					Deno.renameSync(oldHiddenDir, newHiddenDir)
					await restat()
				}
			}

			fs.rmSync(oldHiddenDir, { force: true })
			if (newHiddenDirStat) {
				Deno.symlinkSync(newHiddenDir, oldHiddenDir)
			}
		},
	)
}

async function validateFoxArchives(positionals: string[]) {
	for await (
		const { data: repositories } of octokit.paginate.iterator(
			octokit.rest.repos.listForOrg,
			{
				org: 'fox-archives',
			},
		)
	) {
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

async function createVSCodeLaunchers(positionals: string[]) {
	const extensions: { dirname: string; packageJson: PackageJson }[] = await (await fetch(
		`https://raw.githubusercontent.com/fox-self/vscode-hyperupcall-packs/refs/heads/main/extension-list.json`,
	)).json()

	for (const { dirname, packageJson } of extensions) {
		if (!packageJson.name) {
			throw new Error('packageJson should have field "name"')
		}
		if (!packageJson.displayName || typeof packageJson.displayName !== 'string') {
			throw new Error('packageJson should have field "displayName" and be a string')
		}

		if (
			!dirname.startsWith('pack-ecosystem-') || dirname === 'pack-ecosystem-all' ||
			dirname === 'pack-ecosystem-other'
		) {
			continue
		}

		const extensionNameShort = packageJson.name.slice('vscode-'.length)
		const configDir = (Deno.env.get('XDG_CONFIG_HOME') ?? '').startsWith('/')
			? Deno.env.get('XDG_CONFIG_HOME')
			: path.join(os.homedir(), '.config')
		const dataDir = (Deno.env.get('XDG_DATA_HOME') ?? '').startsWith('/')
			? Deno.env.get('XDG_DATA_HOME')
			: path.join(os.homedir(), '.config')
		const vscodeDataDir = path.join( // TODO
			os.homedir(),
			'.dotfiles/.data/vscode-datadirs',
			extensionNameShort,
		)
		const vscodeExtDir = path.join(
			os.homedir(),
			'.dotfiles/.data/vscode-extensions',
			extensionNameShort,
		)
		const desktopFile = path.join(
			dataDir,
			`applications/${packageJson.name}.desktop`,
		)
		const ecosystemName = dirname.split('-').at(-1)
		const ecosystemNamePretty = (packageJson.displayName ?? '').split(':')[1].trimStart()
		const iconFile = path.join(dataDir, `icons/hicolor/512x512/${packageJson.name}.png`)

		Deno.writeTextFile(
			desktopFile,
			`[Desktop Entry]
Name=VSCode: ${ecosystemNamePretty}
Comment=Code Editing. Redefined.
GenericName=Text Editor
Exec=code --user-data-dir ${vscodeDataDir} --extensions-dir ${vscodeExtDir} %F
Icon=${iconFile}
Type=Application
StartupNotify=false
StartupWMClass=code-${ecosystemName}
Categories=TextEditor;Development;IDE;
MimeType=application/x-code-workspace;
Actions=new-empty-window;
Keywords=vscode;

[Desktop Action new-empty-window]
Name=New Empty Window: ${ecosystemNamePretty}
Exec=code --user-data-dir ${vscodeDataDir} --extensions-dir ${vscodeExtDir} --new-window %F
Icon=${iconFile}`,
		)
		Deno.copyFileSync(
			path.join(
				os.homedir(),
				'.devresources/ecosystem-icons/output/vscode-desktop',
				`${ecosystemName}.png`,
			),
			iconFile,
		)
		Deno.chmodSync(desktopFile, 0o755)
		console.info(`Created desktop entry for "${ecosystemNamePretty}"`)

		for (const filename of ['keybindings.json', 'settings.json', 'snippets']) {
			const source = path.join(configDir, 'Code/User', filename)
			const target = path.join(vscodeDataDir, 'User', filename)
			let targetStat = null
			try {
				targetStat = Deno.lstatSync(target)
			} catch (err) {
				if (!(err instanceof Deno.errors.NotFound)) {
					throw err
				}
			}
			if (!targetStat) {
				Deno.mkdirSync(path.dirname(target), { recursive: true })
				Deno.symlinkSync(source, target)
			} else if (targetStat.isSymlink) {
				fs.unlinkSync(target)
				Deno.symlinkSync(source, target)
			} else {
				console.info(
					`${
						styleText('yellow', 'WARN:')
					} Skipping symlink "${filename}" for "${packageJson.name}" VSCode extension`,
				)
			}
		}

		if (
			!fs.existsSync(vscodeDataDir) || !fs.existsSync(vscodeExtDir) ||
			Array.from(Deno.readDirSync(vscodeExtDir)).length < 2
		) {
			console.info(
				`${styleText('blue', 'NOTE:')} Installing "${packageJson.name}" VSCode extension`,
			)
			spawnSync(
				'code',
				[
					'--user-data-dir',
					vscodeDataDir,
					'--extensions-dir',
					vscodeExtDir,
					'--install-extension',
					`EdwinKofler.${packageJson.name}`,
					'--install-extension',
					`EdwinKofler.vscode-hyperupcall-pack-core`,
				],
				{ stdio: 'inherit' },
			)
		} else {
			console.info(
				`${
					styleText('blue', 'NOTE:')
				} Already installed "${packageJson.name}" VSCode extension`,
			)
		}

		{
			await writeRule('Description', 'Generated rules for ecosystem ' + ecosystemNamePretty)
			await writeRule('desktopfile', desktopFile)
			await writeRule('desktopfilerule', '2')
			await writeRule('title', `(${ecosystemName})`)
			await writeRule('titlematch', '2')
			await writeRule('wmclass', 'code Code')
			await execa`kwriteconfig6 --notify --file ${path.join(configDir, 'kwinrulesrc')} --group ${
				'vscode-hyperupcall-pack-' + ecosystemName
			} --key wmclasscomplete true --type boolean`
			await writeRule('wmclassmatch', '1')

			const [{ stdout: count }, { stdout: rules }] = await Promise.all([
				execa`kreadconfig6 --file ${
					path.join(configDir, 'kwinrulesrc')
				} --group General --key count`,
				execa`kreadconfig6 --file ${
					path.join(configDir, 'kwinrulesrc')
				} --group General --key rules`,
			])
			if (!rules.includes('vscode-hyperupcall-pack-' + ecosystemName)) {
				await writeRule('count', String(Number(count) + 1), 'General')
				await writeRule(
					'rules',
					`${rules},${'vscode-hyperupcall-pack-' + ecosystemName}`,
					'General',
				)
			}

			async function writeRule(
				key: string,
				value: string,
				group = 'vscode-hyperupcall-pack-' + ecosystemName,
			) {
				await execa`kwriteconfig6 --notify --file ${
					path.join(configDir, 'kwinrulesrc')
				} --group ${group} --key ${key} ${value}`
			}
		}
	}
	console.info(`Be sure to open "Window Rules" application and hit apply.`)
}
