// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2026 Edwin Kofler
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import process from 'node:process'
import { styleText } from 'node:util'
import { execa } from 'execa'
import * as jsonc from 'jsonc-parser'
import { parseJSON } from 'jsonc-eslint-parser'
import type { PackageJson } from 'type-fest'

import { getDevConfig } from '#utilities/dev-config.ts'
import { detectEcosystem } from '#utilities/ecosystems.ts'
import { fileExists, mergeJSONWithComments, pkgRoot } from '#utilities/util.ts'

export async function fixEditorSettings() {
	// Fix editor settings.
	if (await fileExists('.vscode/settings.json')) {
		const configDir = (process.env.XDG_CONFIG_HOME ?? '').startsWith('/')
			? (process.env.XDG_CONFIG_HOME ?? '')
			: path.join(os.homedir(), '.config')
		const userSettingsJsonFile = path.join(configDir, 'Code/User/settings.json')
		const defaultTitle = jsonc.parse(await fsp.readFile(userSettingsJsonFile, 'utf-8'))[
			'window.title'
		]

		const settingsText = await fsp.readFile('.vscode/settings.json', 'utf-8')
		const settingsJson = jsonc.parse(settingsText)
		const ecosystem = (await detectEcosystem({ rootDir: process.cwd() }))[0]
		if (settingsJson['window.title']) {
			const output = settingsText.replace(
				/"window\.title"[ \t]*:[ \t]*".*?"/m,
				`"window.title": "${defaultTitle} (${ecosystem})"`,
			)
			await fsp.writeFile('.vscode/settings.json', output)
		} else if (Object.keys(settingsJson).length === 0) {
			const output = `{
	"window.title": "${defaultTitle} (${ecosystem})"
}`
			await fsp.writeFile('.vscode/settings.json', output)
		} else {
			const output = settingsText.replace(
				/[ \t]*{/m,
				`{\n\t"window.title": "${defaultTitle} (${ecosystem})",`,
			)
			await fsp.writeFile('.vscode/settings.json', output)
		}

		// Merge ESLint config settings from antfu/eslint-config
		await mergeVSCodeESLintSettings('.vscode/settings.json')
	}

	// Fix Zed editor settings
	if (await fileExists('.zed/settings.json')) {
		await mergeZedESLintSettings('.zed/settings.json')
	}
}

export async function mergeVSCodeESLintSettings(settingsPath: string) {
	const settingsText = await fsp.readFile(settingsPath, 'utf-8')
	const ast = parseJSON(settingsText)

	const vscodeConfigPath = path.join(pkgRoot(), 'config/vscode-config.jsonc')
	const settingsToAdd = jsonc.parse(await fsp.readFile(vscodeConfigPath, 'utf-8'))

	const output = mergeJSONWithComments(settingsText, ast, settingsToAdd)
	await fsp.writeFile(settingsPath, output)
}

export async function mergeZedESLintSettings(settingsPath: string) {
	const settingsText = await fsp.readFile(settingsPath, 'utf-8')
	const ast = parseJSON(settingsText)

	const zedConfigPath = path.join(pkgRoot(), 'config/zed-config.jsonc')
	const settingsToMerge = jsonc.parse(await fsp.readFile(zedConfigPath, 'utf-8'))

	const output = mergeJSONWithComments(settingsText, ast, settingsToMerge)
	await fsp.writeFile(settingsPath, output)
}

export async function toggleEditorTools() {
	{
		const settingsPath = '.vscode/settings.json'
		if (!fs.existsSync(settingsPath)) {
			fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
			fs.writeFileSync(settingsPath, '{}\n')
		}
		const settingsText = fs.readFileSync(settingsPath, 'utf-8')
		const ast = parseJSON(settingsText)

		let toolFile = null
		if (settingsText.includes('"yaml.format.enable": true')) {
			toolFile = path.join(pkgRoot(), 'config/vscode-tool-disable.jsonc')
		} else {
			toolFile = path.join(pkgRoot(), 'config/vscode-tool-enable.jsonc')
		}
		const output = mergeJSONWithComments(
			settingsText,
			ast,
			jsonc.parse(fs.readFileSync(toolFile, 'utf-8')),
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
		if (settingsText.includes('"format_on_save": "on"')) {
			toolFile = path.join(pkgRoot(), 'config/zed-tool-disable.jsonc')
		} else {
			toolFile = path.join(pkgRoot(), 'config/zed-tool-enable.jsonc')
		}
		const output = mergeJSONWithComments(
			settingsText,
			ast,
			jsonc.parse(fs.readFileSync(toolFile, 'utf-8')),
		)
		fs.writeFileSync(settingsPath, output)
	}
}

export async function createVSCodeDesktopApplication({
	variantId,
	variantName,
	extensions,
	overrides,
}: {
	variantId: string
	variantName: string
	extensions: string[]
	overrides?: {
		datadir: string
		extdir: string
	}
}) {
	const configDir = (process.env.XDG_CONFIG_HOME ?? '').startsWith('/')
		? (process.env.XDG_CONFIG_HOME ?? '')
		: path.join(os.homedir(), '.config')
	const dataDir = (process.env.XDG_DATA_HOME ?? '').startsWith('/')
		? (process.env.XDG_DATA_HOME ?? '')
		: path.join(os.homedir(), '.config')
	const config = await getDevConfig()
	const vscodeDataDir =
		overrides?.datadir ??
		path.join(config.paths.vscodeDataDirs, `hyperupcall-pack-${variantId}`)
	const vscodeExtDir =
		overrides?.extdir ??
		path.join(config.paths.vscodeExtensions, `hyperupcall-pack-${variantId}`)

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
	fs.copyFileSync(path.join(config.paths.ecosystemIcons, `${variantId}.png`), iconFile)
	fs.chmodSync(desktopFile, 0o755)
	console.info(`${styleText('blue', variantName + ':')} Created desktop entry`)

	for (const filename of ['keybindings.json', 'settings.json', 'snippets']) {
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
	console.info(
		`${styleText('blue', variantName + ':')} Symlinked keybindings, settings, and snippets`,
	)

	console.info(`${styleText('blue', variantName + ':')} Installing...`)
	spawnSync(
		'code',
		[
			'--user-data-dir',
			vscodeDataDir,
			'--extensions-dir',
			vscodeExtDir,
			'--force',
			...extensions.flatMap((ext) => ['--install-extension', ext]),
		],
		{ stdio: 'inherit' },
	)
	console.info(`${styleText('blue', variantName + ':')} Installed extensions`)

	{
		const extensionListUrl =
			'https://raw.githubusercontent.com/hyperupcall-projects/vscode-hyperupcall-packs/refs/heads/main/extension-list.json'
		const extensionList: {
			dirname: string
			packageJson: PackageJson & { extensionPack?: string[] }
		}[] = await (await fetch(extensionListUrl)).json()

		const extensionPackMap = new Map<string, string[]>()
		for (const { packageJson } of extensionList) {
			if (packageJson.name && packageJson.extensionPack) {
				extensionPackMap.set(packageJson.name, packageJson.extensionPack)
			}
		}

		const getAllDependencies = (
			extensionId: string,
			visited = new Set<string>(),
		): Set<string> => {
			if (visited.has(extensionId)) {
				return visited
			}
			visited.add(extensionId)

			const packageName = extensionId.split('.')[1]
			const subdeps =
				extensionPackMap.get(packageName) ||
				extensionPackMap.get(`vscode-hyperupcall-${packageName}`) ||
				[]

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
					`${styleText('blue', variantName + ':')} ${styleText('yellow', `Uninstalling ${ext.id}`)}`,
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
		console.info(
			`${styleText('blue', variantName + ':')} Pruned ${unnecessaryExtensions.length} extensions(s)`,
		)
	}

	{
		await writeRule('Description', 'Generated rules for ecosystem ' + variantName)
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

export async function createCodeWorkspace(
	projects: { name: string; path: string }[],
): Promise<string> {
	const dir = path.join(os.tmpdir(), `dev-project-manager-${randomUUID()}`)
	await fsp.mkdir(dir, { recursive: true })
	const workspacePath = path.join(dir, 'workspace.code-workspace')
	const workspace = {
		folders: projects.map((p) => ({
			name: p.name,
			path: p.path,
		})),
	}
	await fsp.writeFile(workspacePath, JSON.stringify(workspace, null, '\t') + '\n', 'utf8')
	return workspacePath
}
