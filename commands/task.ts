import * as path from 'node:path'
import * as os from 'node:os'

import { minimatch } from 'minimatch'
import micromatch from 'micromatch'
import yn from 'yn'

import { forEachRepository, mergeJSONWithComments } from '#utilities/util.ts'
import { octokit, pkgRoot } from '#common'

import type { CommandScriptOptions } from '#types'
import { execa } from 'execa'
import type { PackageJson } from 'type-fest'
import * as fs from 'node:fs'
import { styleText } from 'node:util'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import walk from 'ignore-walk'
import * as jsonc from 'jsonc-parser'
import { parseJSON } from 'jsonc-eslint-parser'

export async function run(
	options: CommandScriptOptions,
	positionals: string[],
) {
	const task = positionals[0]

	const helpText = `script <taskName>
TASKS:

check-license-headers
symlink-hidden-dirs
validate-hyperupcall-archives
create-vscode-launchers
toggletools
`
	if (options.help) {
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
	} else if (task === 'validate-hyperupcall-archives') {
		await validateHyperupcallArchives(positionals.slice(1))
	} else if (task === 'create-vscode-launchers') {
		await createVSCodeLaunchers(positionals.slice(1))
	} else if (task === 'toggletools') {
		await toggleTools(positionals.slice(1))
	} else {
		process.stdout.write('Error: Failed to pass task name\n')
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
			const newHiddenDir = path.join(
				config.hiddenDirsRepositoryDir,
				repoEntry.name,
			)
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
				console.error(
					`Error: Hidden directory must be a directory: ${oldHiddenDir}`,
				)
				process.exit(1)
			}

			if (
				newHiddenDirStat &&
				!newHiddenDirStat.isSymbolicLink() &&
				!newHiddenDirStat.isDirectory()
			) {
				console.error(
					`Error: Hidden directory must be a directory: ${newHiddenDir}`,
				)
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
					fs.mkdirSync(path.dirname(newHiddenDir), {
						recursive: true,
						mode: 0o755,
					})
					fs.renameSync(oldHiddenDir, newHiddenDir)
					await restat()
				}
			}

			fs.rmSync(oldHiddenDir, { force: true })
			if (newHiddenDirStat) {
				fs.symlinkSync(newHiddenDir, oldHiddenDir)
			}
		},
	)
}

async function validateHyperupcallArchives(positionals: string[]) {
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
				console.error(
					`Error: Repository is not archived: ${repository.name}`,
				)
				process.exit(1)
			}
		}
	}
}

async function createVSCodeLaunchers(positionals: string[]) {
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

		await createVSCodeDesktopApplication({
			variantId: dirname.split('-').at(-1),
			variantName: (packageJson.displayName ?? '')
				.split(':')[1]
				.trimStart(),
			extensions: [
				'edwinkofler.vscode-hyperupcall-pack-base',
				'edwinkofler.vscode-hyperupcall-pack-bundled-themes',
				"edwinkofler.vscode-hyperupcall-pack-icons",
				'edwinkofler.vscode-hyperupcall-pack-markdown',
				`edwinkofler.${packageJson.name}`,
			]
		})
	}

	await createVSCodeDesktopApplication({
		variantId: 'devdotfiles',
		variantName: 'devdotfiles',
		extensions: [
			'edwinkofler.vscode-hyperupcall-pack-base',
			'edwinkofler.vscode-hyperupcall-pack-bundled-themes',
			"edwinkofler.vscode-hyperupcall-pack-icons",
			'edwinkofler.vscode-hyperupcall-pack-markdown',
			'edwinkofler.vscode-hyperupcall-pack-unix',
			'edwinkofler.vscode-hyperupcall-pack-python',
			'edwinkofler.vscode-hyperupcall-pack-rust',
			'edwinkofler.vscode-hyperupcall-pack-web'
		]
	})

	console.info(`Be sure to open "Window Rules" application and hit apply.`)

}

async function createVSCodeDesktopApplication({ variantId, variantName, extensions }: { variantId: string, variantName: string, extensions: string[] }) {
	const configDir = (process.env.XDG_CONFIG_HOME ?? '').startsWith('/')
		? (process.env.XDG_CONFIG_HOME ?? '')
		: path.join(os.homedir(), '.config')
	const dataDir = (process.env.XDG_DATA_HOME ?? '').startsWith('/')
		? (process.env.XDG_DATA_HOME ?? '')
		: path.join(os.homedir(), '.config')
	const vscodeDataDir = path.join(
		os.homedir(),
		'.dotfiles/.data/vscode-datadirs',
		`hyperupcall-pack-${variantId}`,
	)
	const vscodeExtDir = path.join(
		os.homedir(),
		'.dotfiles/.data/vscode-extensions',
		`hyperupcall-pack-${variantId}`,
	)

	const desktopFile = path.join(
		dataDir,
		`applications/vscode-hyperupcall-pack-${variantId}.desktop`,
	)
	const iconFile = path.join(
		dataDir,
		`icons/hicolor/512x512/vscode-hyperupcall-pack-${variantId}.png`,
	)

	fs.writeFileSync(
		desktopFile,
		`[Desktop Entry]
Name=VSCode: ${variantName}
Comment=Code Editing. Redefined.
GenericName=Text Editor
Exec=code --user-data-dir ${vscodeDataDir} --extensions-dir ${vscodeExtDir} %F
Icon=${iconFile}
Type=Application
StartupNotify=false
StartupWMClass=code-${variantId}
Categories=TextEditor;Development;IDE;
MimeType=application/x-code-workspace;
Actions=new-empty-window;
Keywords=vscode;

[Desktop Action new-empty-window]
Name=New Empty Window: ${variantName}
Exec=code --user-data-dir ${vscodeDataDir} --extensions-dir ${vscodeExtDir} --new-window %F
Icon=${iconFile}`,
		'utf-8',
	)
	fs.copyFileSync(
		path.join(
			os.homedir(),
			'.devresources/ecosystem-icons/output/vscode-desktop',
			`${variantId}.png`,
		),
		iconFile,
	)
	fs.chmodSync(desktopFile, 0o755)
	console.info(`${styleText('blue', variantName + ':')} Created desktop entry`)

	for (const filename of [
		'keybindings.json',
		'settings.json',
		'snippets',
	]) {
		const source = path.join(configDir, 'Code/User', filename)
		const target = path.join(vscodeDataDir, 'User', filename)
		let targetStat = null
		try {
			targetStat = fs.lstatSync(target)
		} catch (err) {
			if (err.code !== 'ENOENT') {
				throw err
			}
		}
		if (!targetStat) {
			fs.mkdirSync(path.dirname(target), { recursive: true })
			fs.symlinkSync(source, target)
		} else if (targetStat.isSymbolicLink()) {
			fs.unlinkSync(target)
			fs.symlinkSync(source, target)
		}
	}
	console.info(`${styleText('blue', variantName + ':')} Symlinked keybindings, settings, and snippets`)


	console.info(`${styleText('blue', variantName + ':')} Installing...`)
	spawnSync(
		'code',
		[
			'--user-data-dir',
			vscodeDataDir,
			'--extensions-dir',
			vscodeExtDir,
			'--force',
			...extensions.flatMap(ext => ['--install-extension', ext]),
		],
		{ stdio: 'inherit' },
	)
	console.info(`${styleText('blue', variantName + ':')} Installed extensions`)

	{
		const extensionListUrl = 'https://raw.githubusercontent.com/hyperupcall-projects/vscode-hyperupcall-packs/refs/heads/main/extension-list.json'
		const extensionList: { dirname: string; packageJson: PackageJson & { extensionPack?: string[] } }[] = await (await fetch(extensionListUrl)).json()

		const extensionPackMap = new Map<string, string[]>()
		for (const { packageJson } of extensionList) {
			if (packageJson.name && packageJson.extensionPack) {
				extensionPackMap.set(packageJson.name, packageJson.extensionPack)
			}
		}

		const getAllDependencies = (extensionId: string, visited = new Set<string>()): Set<string> => {
			if (visited.has(extensionId)) {
				return visited
			}
			visited.add(extensionId)

			const packageName = extensionId.split('.')[1]
			const subdeps = extensionPackMap.get(packageName) || extensionPackMap.get(`vscode-hyperupcall-${packageName}`) || []

			for (const subdep of subdeps) {
				getAllDependencies(subdep, visited)
			}

			return visited
		}

		const expectedExtensions = new Set<string>()
		for (const ext of extensions) {
			const allDeps = getAllDependencies(ext)
			for (const dep of allDeps) {
				expectedExtensions.add(dep.toLowerCase())
			}
		}

		const extensionsJsonPath = path.join(vscodeExtDir, 'extensions.json')
		const unnecessaryExtensions: Array<{ id: string; relativeLocation: string }> = []

		const extensionsData = JSON.parse(fs.readFileSync(extensionsJsonPath, 'utf-8'))
		for (const ext of extensionsData) {
			if (ext?.identifier?.id && ext?.relativeLocation) {
				const match = ext.relativeLocation.match(/^([^-]+)-[\d.]+$/)
				if (match) {
					const extensionId = match[1].toLowerCase()
					if (!expectedExtensions.has(extensionId)) {
						unnecessaryExtensions.push({
							id: ext.identifier.id,
							relativeLocation: ext.relativeLocation,
						})
					}
				}
			}
		}

		if (unnecessaryExtensions.length > 0) {
			for (const ext of unnecessaryExtensions) {
				console.warn(
					`${styleText('blue', variantName + ':' )} ${styleText('yellow', `Uninstalling ${ext.id}`)}`,
				)
				spawnSync(
					'code',
					[
						'--user-data-dir',
						vscodeDataDir,
						'--extensions-dir',
						vscodeExtDir,
						'--uninstall-extension',
						ext.id,
					],
					{ stdio: 'inherit' },
				)
			}
		}
		console.info(`${styleText('blue', variantName + ':' )} Pruned ${unnecessaryExtensions.length} extensions(s)`)
	}

	{
		await writeRule(
			'Description',
			'Generated rules for ecosystem ' + variantName,
		)
		await writeRule('desktopfile', desktopFile)
		await writeRule('desktopfilerule', '2')
		await writeRule('title', `(${variantId})`)
		await writeRule('titlematch', '2')
		await writeRule('wmclass', 'code Code')
		await execa`kwriteconfig6 --notify --file ${path.join(configDir, 'kwinrulesrc')} --group ${
			'vscode-hyperupcall-pack-' + variantId
		} --key wmclasscomplete true --type boolean`
		await writeRule('wmclassmatch', '1')

		const [{ stdout: count }, { stdout: rules }] = await Promise.all([
			execa`kreadconfig6 --file ${path.join(
				configDir,
				'kwinrulesrc',
			)} --group General --key count`,
			execa`kreadconfig6 --file ${path.join(
				configDir,
				'kwinrulesrc',
			)} --group General --key rules`,
		])
		if (!rules.includes('vscode-hyperupcall-pack-' + variantId)) {
			await writeRule('count', String(Number(count) + 1), 'General')
			await writeRule(
				'rules',
				`${rules},${'vscode-hyperupcall-pack-' + variantId}`,
				'General',
			)
		}

		async function writeRule(
			key: string,
			value: string,
			group = 'vscode-hyperupcall-pack-' + variantId,
		) {
			await execa`kwriteconfig6 --notify --file ${path.join(
				configDir,
				'kwinrulesrc',
			)} --group ${group} --key ${key} ${value}`
		}
	}
}

async function toggleTools(positionals: string[]) {
	{
		const settingsPath = '.vscode/settings.json'
		if (!fs.existsSync(settingsPath)) {
			fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
			fs.writeFileSync(settingsPath, '{}\n')
		}
		const settingsText = fs.readFileSync(settingsPath, 'utf-8')
		const ast = parseJSON(settingsText)

		let toolFile = null
		// TODO
		if (settingsText.includes('"yaml.format.enable": true')) {
			toolFile = path.join(pkgRoot(), 'config/vscode-tool-disable.jsonc')
		} else {
			toolFile = path.join(pkgRoot(), 'config/vscode-tool-enable.jsonc')
		}
		const output = mergeJSONWithComments(
			settingsText,
			ast,
			jsonc.parse(
				fs.readFileSync(toolFile, 'utf-8'),
			)
		)
		fs.writeFileSync(settingsPath, output)
	}

	// ZED
	{
		const settingsPath = '.zed/settings.json'
		if (!fs.existsSync(settingsPath)) {
			fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
			fs.writeFileSync(settingsPath, '{}\n')
		}
		const settingsText = fs.readFileSync(settingsPath, 'utf-8')
		const ast = parseJSON(settingsText)

		let toolFile = null
		// TODO
		if (settingsText.includes('"format_on_save": "on"')) {
			toolFile = path.join(pkgRoot(), 'config/zed-tool-disable.jsonc')
		} else {
			toolFile = path.join(pkgRoot(), 'config/zed-tool-enable.jsonc')
		}
		const output = mergeJSONWithComments(
			settingsText,
			ast,
			jsonc.parse(
				fs.readFileSync(toolFile, 'utf-8'),
			)
		)
		fs.writeFileSync(settingsPath, output)
	}
}
