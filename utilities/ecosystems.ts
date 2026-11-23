import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { globby } from 'globby'
import toml from 'smol-toml'

import { fileExists } from '#utilities/util.ts'
import { mergeTOML } from './util.ts'

export type VersionUpdate = {
	relativePath: string
	oldVersion: string
}

type VersionReplacement = {
	output: string
	oldVersion: string
}

export type EcosystemDefinition = {
	label: string
	ecosystemInDir: (ctx: { rootDir: string }) => Promise<boolean>
	lintFileGlobs: () => Promise<string[]>
	updateVersion: (
		rootDir: string,
		newVersion: string,
		{ dryRun }: { dryRun: boolean },
	) => Promise<VersionUpdate[]>
	vscodePackId?: string
	templates: Record<string, { name: string }>
}

export const ecosystems = {
	nodejs: {
		label: 'Node.js',
		async ecosystemInDir(ctx) {
			return await fileExists(path.join(ctx.rootDir, 'package.json'))
		},
		vscodePackId: 'vscode-hyperupcall-pack-web',
		templates: {
			'hello-world': {
				name: 'Hello World',
			},
			cli: {
				name: 'CLI',
			},
			'web-server-express': {
				name: 'Web Server (Express)',
			},
		},
		async lintFileGlobs() {
			return ['400-ecosystem/nodejs/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateJsonVersion(rootDir, 'package.json', newVersion, { dryRun })
		},
	},
	'vscode-extension': {
		label: 'VS Code Extension',
		templates: {},
		async ecosystemInDir(ctx) {
			const filepath = path.join(ctx.rootDir, 'package.json')
			if (!(await fileExists(filepath))) {
				return false
			}

			try {
				const content: { displayName?: unknown } = JSON.parse(
					await fs.readFile(filepath, 'utf-8'),
				)
				return Boolean(content.displayName)
			} catch (err) {
				if (err instanceof SyntaxError) {
					return false
				}
				throw err
			}
		},
		async lintFileGlobs() {
			return ['400-ecosystem/vscode-extension/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateJsonVersion(rootDir, 'package.json', newVersion, { dryRun })
		},
	},
	deno: {
		label: 'Deno',
		async ecosystemInDir(ctx) {
			return (
				(await fileExists(path.join(ctx.rootDir, 'deno.jsonc'))) ||
				(await fileExists(path.join(ctx.rootDir, 'deno.json')))
			)
		},
		vscodePackId: 'vscode-hyperupcall-pack-web',
		templates: {
			webframework: {
				name: 'Web Framework',
			},
		},
		async lintFileGlobs() {
			return ['400-ecosystem/deno/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			const modified: VersionUpdate[] = []
			for (const relativeJsonFile of ['deno.json', 'deno.jsonc']) {
				modified.push(
					...(await updateJsonVersion(rootDir, relativeJsonFile, newVersion, { dryRun })),
				)
			}

			return modified
		},
	},
	c: {
		label: 'C',
		templates: {},
		async ecosystemInDir(ctx) {
			if ((await globby('*.c', { cwd: ctx.rootDir })).length > 0) {
				return true
			}

			return (await getCmakeLanguage(ctx.rootDir)) === 'C'
		},
		vscodePackId: 'vscode-hyperupcall-pack-cpp',
		async lintFileGlobs() {
			return ['400-ecosystem/c/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateCFamilyVersion(rootDir, newVersion, { dryRun })
		},
	},
	python: {
		label: 'Python',
		templates: {},
		async ecosystemInDir(ctx) {
			return (
				(await fileExists(path.join(ctx.rootDir, 'pyproject.toml'))) ||
				(await globby('*.py', { cwd: ctx.rootDir })).length > 0
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/python/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			const pyproject = 'pyproject.toml'
			const pyprojectPath = path.join(rootDir, pyproject)
			if (await fileExists(pyprojectPath)) {
				let oldVersion: string | undefined
				for (const section of ['project', 'tool.poetry']) {
					oldVersion =
						(await mergeTomlVersion(pyprojectPath, section, newVersion, { dryRun })) ||
						oldVersion
				}

				if (oldVersion) {
					return [{ relativePath: pyproject, oldVersion }]
				}
			}

			const setupCfg = 'setup.cfg'
			const setupCfgPath = path.join(rootDir, setupCfg)
			if (await fileExists(setupCfgPath)) {
				const text = await fs.readFile(setupCfgPath, 'utf-8')
				const { output, oldVersion } = replaceIniValue(
					text,
					'metadata',
					'version',
					newVersion,
				)
				if (output !== text) {
					if (!dryRun) {
						await fs.writeFile(setupCfgPath, output)
					}
					return [{ relativePath: setupCfg, oldVersion }]
				}
			}

			const setupPy = 'setup.py'
			const setupPyPath = path.join(rootDir, setupPy)
			if (await fileExists(setupPyPath)) {
				const text = await fs.readFile(setupPyPath, 'utf-8')
				const regex = /(\bversion\s*=\s*)(['"])([^'"]*)\2/
				const output = text.replace(regex, `$1$2${newVersion}$2`)
				if (output !== text) {
					if (!dryRun) {
						await fs.writeFile(setupPyPath, output)
					}
					return [{ relativePath: setupPy, oldVersion: regex.exec(text)![3]! }]
				}
			}

			return []
		},
	},
	cpp: {
		label: 'C++',
		async ecosystemInDir(ctx) {
			return (await getCmakeLanguage(ctx.rootDir)) === 'CXX'
		},
		vscodePackId: 'vscode-hyperupcall-pack-cpp',
		templates: {
			cmake: {
				name: 'cpp-cmake',
			},
			'hello-world': {
				name: 'Hello World',
			},
			playground: {
				name: 'Playground',
			},
		},
		async lintFileGlobs() {
			return ['400-ecosystem/cpp/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateCFamilyVersion(rootDir, newVersion, { dryRun })
		},
	},
	bash: {
		label: 'Bash',
		templates: {},
		async ecosystemInDir(ctx) {
			return await fileExists(path.join(ctx.rootDir, 'basalt.toml'))
		},
		async lintFileGlobs() {
			return ['400-ecosystem/bash/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateTomlVersion(rootDir, 'basalt.toml', 'package', newVersion, {
				dryRun,
			})
		},
	},
	'woof-plugin': {
		label: 'Woof Plugin',
		templates: {},
		async ecosystemInDir(ctx) {
			return (
				(await fileExists(path.join(ctx.rootDir, 'manifest.ini'))) &&
				(await fileExists(path.join(ctx.rootDir, 'tools')))
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/woof-plugin/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			const relative = 'manifest.ini'
			const filepath = path.join(rootDir, relative)
			if (!(await fileExists(filepath))) {
				return []
			}

			const text = await fs.readFile(filepath, 'utf-8')
			const { output, oldVersion } = replaceIniTopLevelValue(text, 'version', newVersion)
			if (output === text) {
				return []
			}

			if (!dryRun) {
				await fs.writeFile(filepath, output)
			}
			return [{ relativePath: relative, oldVersion }]
		},
	},
	'zed-extension': {
		label: 'Zed Extension',
		templates: {},
		async ecosystemInDir(ctx) {
			return await fileExists(path.join(ctx.rootDir, 'extension.toml'))
		},
		async lintFileGlobs() {
			return ['400-ecosystem/zed-extension/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateTomlVersion(rootDir, 'extension.toml', null, newVersion, {
				dryRun,
			})
		},
	},
	java: {
		label: 'Java',
		templates: {},
		async ecosystemInDir(ctx) {
			return (
				(await fileExists(path.join(ctx.rootDir, 'gradlew'))) ||
				(await fileExists(path.join(ctx.rootDir, 'build.gradle'))) ||
				(await fileExists(path.join(ctx.rootDir, 'build.gradle.kts')))
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/java/*']
		},
		// Handles both Gradle and Maven so a later `java-gradle` / `java-maven` split
		// can reuse the same updater.
		async updateVersion(rootDir, newVersion, { dryRun }) {
			const modified: VersionUpdate[] = []

			const gradleProperties = 'gradle.properties'
			const gradlePropertiesPath = path.join(rootDir, gradleProperties)
			if (await fileExists(gradlePropertiesPath)) {
				const text = await fs.readFile(gradlePropertiesPath, 'utf-8')
				const match = /^([ \t]*version[ \t]*=[ \t]*)([^\s#;]+)([ \t]*(?:[#;].*)?)$/m.exec(
					text,
				)
				if (match && isLiteralVersion(match[2]!)) {
					const output =
						text.slice(0, match.index) +
						`${match[1]}${newVersion}${match[3]}` +
						text.slice(match.index + match[0].length)
					if (!dryRun) {
						await fs.writeFile(gradlePropertiesPath, output)
					}
					modified.push({
						relativePath: gradleProperties,
						oldVersion: match[2]!,
					})
				}
			}

			for (const relative of ['build.gradle', 'build.gradle.kts']) {
				const filepath = path.join(rootDir, relative)
				if (!(await fileExists(filepath))) {
					continue
				}

				const text = await fs.readFile(filepath, 'utf-8')
				let match =
					/^([ \t]*version[ \t]*=[ \t]*)(['"])([^'"]*)\2([ \t]*(?:\/\/.*)?)$/m.exec(text)
				if (!match) {
					match = /^([ \t]*version[ \t]+)(['"])([^'"]*)\2([ \t]*(?:\/\/.*)?)$/m.exec(text)
				}

				if (match && isLiteralVersion(match[3]!)) {
					const output =
						text.slice(0, match.index) +
						`${match[1]}${match[2]}${newVersion}${match[2]}${match[4]}` +
						text.slice(match.index + match[0].length)
					if (!dryRun) {
						await fs.writeFile(filepath, output)
					}
					modified.push({ relativePath: relative, oldVersion: match[3]! })
				}
			}

			const pom = 'pom.xml'
			const pomPath = path.join(rootDir, pom)
			if (await fileExists(pomPath)) {
				const text = await fs.readFile(pomPath, 'utf-8')
				const { output, oldVersion } = replacePomVersion(text, newVersion)
				if (output !== text) {
					if (!dryRun) {
						await fs.writeFile(pomPath, output)
					}
					modified.push({ relativePath: pom, oldVersion })
				}
			}

			return modified
		},
	},
	rust: {
		label: 'Rust',
		async ecosystemInDir(ctx) {
			return await fileExists(path.join(ctx.rootDir, 'Cargo.toml'))
		},
		templates: {
			'hello-world': {
				name: 'Hello World',
			},
			cli: {
				name: 'CLI',
			},
			gui: {
				name: 'GUI',
			},
		},
		async lintFileGlobs() {
			return ['400-ecosystem/rust/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateCargoVersion(rootDir, newVersion, { dryRun })
		},
	},
	webext: {
		label: 'Web Extension',
		templates: {},
		async ecosystemInDir(ctx) {
			const filepath = path.join(ctx.rootDir, 'manifest.json')
			if (!(await fileExists(filepath))) {
				return false
			}

			try {
				const content: { manifest_version?: unknown } = JSON.parse(
					await fs.readFile(filepath, 'utf-8'),
				)
				return (
					content !== null && typeof content === 'object' && 'manifest_version' in content
				)
			} catch (err) {
				if (err instanceof SyntaxError) {
					return false
				}
				throw err
			}
		},
		async lintFileGlobs() {
			return ['400-ecosystem/webext/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			return await updateJsonVersion(rootDir, 'manifest.json', newVersion, { dryRun })
		},
	},
	go: {
		label: 'Go',
		async ecosystemInDir(ctx) {
			return (
				(await fileExists(path.join(ctx.rootDir, 'go.mod'))) ||
				(await globby('*.go', { cwd: ctx.rootDir })).length > 0
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/go/*']
		},
		async updateVersion(rootDir, newVersion, { dryRun }) {
			// Go module versions come from Git tags. If the project keeps an explicit
			// VERSION file, keep that in sync as well.
			const relative = 'VERSION'
			const filepath = path.join(rootDir, relative)
			if (!(await fileExists(filepath))) {
				return []
			}

			const text = await fs.readFile(filepath, 'utf-8')
			const output = `${newVersion}${text.endsWith('\n') ? '\n' : ''}`
			if (output === text) {
				return []
			}

			if (!dryRun) {
				await fs.writeFile(filepath, output)
			}
			return [{ relativePath: relative, oldVersion: text.trim() }]
		},
		templates: {
			'hello-world': {
				name: 'Hello World',
			},
			cli: {
				name: 'CLI',
			},
			'web-server': {
				name: 'Web Server',
			},
		},
	},
} satisfies Record<string, EcosystemDefinition>

export type EcosystemId = keyof typeof ecosystems

export async function detectEcosystem({
	rootDir,
}: {
	rootDir: string
}): Promise<EcosystemId[]> {
	const detected: EcosystemId[] = []

	for (const [id, definition] of Object.entries(ecosystems) as [
		EcosystemId,
		EcosystemDefinition,
	][]) {
		if (definition.ecosystemInDir && (await definition.ecosystemInDir({ rootDir }))) {
			detected.push(id)
		}
	}

	return detected
}

// https://cmake.org/cmake/help/latest/command/project.html
async function getCmakeLanguage(rootDir: string): Promise<string | undefined> {
	const filepath = path.join(rootDir, 'CMakeLists.txt')
	if (!(await fileExists(filepath))) {
		return undefined
	}

	const content = await fs.readFile(filepath, 'utf-8')
	const language = content.match(
		/project\((?:.*? (?<lang>[a-zA-Z]+)\)|.*?LANGUAGES[ \t]+(?<lang>[a-zA-Z]+))/,
	)
	const lang = language?.groups?.lang
	if (!lang) {
		throw new Error('CMakeLists.txt should have language defined in project()')
	}

	return lang
}

async function updateJsonVersion(
	rootDir: string,
	relativeJsonFile: string,
	newVersion: string,
	{ dryRun }: { dryRun: boolean },
): Promise<VersionUpdate[]> {
	const filepath = path.join(rootDir, relativeJsonFile)
	if (!(await fileExists(filepath))) {
		return []
	}

	const text = await fs.readFile(filepath, 'utf-8')
	const regex = /"version"\s*:\s*"([^"]*)"/
	const output = text.replace(regex, `"version": "${newVersion}"`)
	if (output === text) {
		return []
	}

	if (!dryRun) {
		await fs.writeFile(filepath, output)
	}
	return [{ relativePath: relativeJsonFile, oldVersion: regex.exec(text)![1]! }]
}

async function updateTomlVersion(
	rootDir: string,
	relative: string,
	section: string | null,
	newVersion: string,
	{ dryRun }: { dryRun: boolean },
): Promise<VersionUpdate[]> {
	const filepath = path.join(rootDir, relative)
	if (!(await fileExists(filepath))) {
		return []
	}

	const oldVersion = await mergeTomlVersion(filepath, section, newVersion, { dryRun })
	return oldVersion ? [{ relativePath: relative, oldVersion }] : []
}

type CargoManifest = {
	package?: { name?: unknown; version?: unknown }
	workspace?: {
		members?: unknown
		exclude?: unknown
		package?: { version?: unknown }
		dependencies?: Record<string, unknown>
	}
	[key: string]: unknown
}

const cargoDependencyTables = ['dependencies', 'dev-dependencies', 'build-dependencies']

// Updates the version of a Cargo package or workspace. For a workspace, this
// bumps `[workspace.package].version`, every member with a literal version, the
// version requirements of path dependencies between members (both in
// `[workspace.dependencies]` and in each member's dependency tables), and the
// entries of the members in the shared Cargo.lock.
async function updateCargoVersion(
	rootDir: string,
	newVersion: string,
	{ dryRun }: { dryRun: boolean },
): Promise<VersionUpdate[]> {
	const rootManifestPath = path.join(rootDir, 'Cargo.toml')
	if (!(await fileExists(rootManifestPath))) {
		return []
	}
	const rootManifest = toml.parse(
		await fs.readFile(rootManifestPath, 'utf-8'),
	) as CargoManifest

	const modified = new Map<string, VersionUpdate>()
	// Package name -> version before the update, for every package whose version was bumped.
	const bumped = new Map<string, string>()

	const workspaceVersion = rootManifest.workspace?.package?.version
	const workspaceVersionBumped =
		typeof workspaceVersion === 'string' &&
		isLiteralVersion(workspaceVersion) &&
		workspaceVersion !== newVersion
	if (workspaceVersionBumped) {
		if (
			await mergeTomlVersion(rootManifestPath, 'workspace.package', newVersion, {
				dryRun,
			})
		) {
			modified.set('Cargo.toml', {
				relativePath: 'Cargo.toml',
				oldVersion: workspaceVersion,
			})
		}
	}

	const memberDirs = ['.']
	if (rootManifest.workspace) {
		memberDirs.push(...(await getCargoWorkspaceMembers(rootDir, rootManifest)))
	}

	const memberManifests = new Map<string, CargoManifest>()
	for (const memberDir of memberDirs) {
		const relative = path.join(memberDir, 'Cargo.toml')
		const manifestPath = path.join(rootDir, relative)
		const manifest =
			memberDir === '.'
				? rootManifest
				: (toml.parse(await fs.readFile(manifestPath, 'utf-8')) as CargoManifest)
		memberManifests.set(memberDir, manifest)

		const pkg = manifest.package
		if (typeof pkg?.name !== 'string') {
			continue
		}

		if (typeof pkg.version === 'string') {
			if (!isLiteralVersion(pkg.version) || pkg.version === newVersion) {
				continue
			}
			if (await mergeTomlVersion(manifestPath, 'package', newVersion, { dryRun })) {
				modified.set(relative, {
					relativePath: relative,
					oldVersion: pkg.version,
				})
				bumped.set(pkg.name, pkg.version)
			}
		} else if (isCargoWorkspaceInherited(pkg.version) && workspaceVersionBumped) {
			bumped.set(pkg.name, workspaceVersion)
		}
	}

	if (bumped.size === 0) {
		return [...modified.values()]
	}

	// Files that only reference a bumped package have no version of their own to report.
	const bumpedFrom = bumped.values().next().value!

	// Update version requirements of path dependencies that point to bumped members.
	if (rootManifest.workspace?.dependencies) {
		const override = cargoDependencyOverride(
			rootManifest.workspace.dependencies,
			bumped,
			newVersion,
		)
		if (
			override &&
			(await mergeTomlOverride(
				rootManifestPath,
				{ workspace: { dependencies: override } },
				{ dryRun },
			)) &&
			!modified.has('Cargo.toml')
		) {
			modified.set('Cargo.toml', {
				relativePath: 'Cargo.toml',
				oldVersion: bumpedFrom,
			})
		}
	}
	for (const [memberDir, manifest] of memberManifests) {
		const override: Record<string, any> = {}
		for (const table of cargoDependencyTables) {
			const deps = cargoDependencyOverride(manifest[table], bumped, newVersion)
			if (deps) {
				override[table] = deps
			}
		}
		if (manifest.target && typeof manifest.target === 'object') {
			for (const [target, targetTable] of Object.entries(
				manifest.target as Record<string, any>,
			)) {
				for (const table of cargoDependencyTables) {
					const deps = cargoDependencyOverride(targetTable?.[table], bumped, newVersion)
					if (deps) {
						override.target ??= {}
						override.target[target] ??= {}
						override.target[target][table] = deps
					}
				}
			}
		}

		const relative = path.join(memberDir, 'Cargo.toml')
		if (
			Object.keys(override).length > 0 &&
			(await mergeTomlOverride(path.join(rootDir, relative), override, { dryRun })) &&
			!modified.has(relative)
		) {
			modified.set(relative, { relativePath: relative, oldVersion: bumpedFrom })
		}
	}

	if (await updateCargoLockVersion(rootDir, bumped, newVersion, { dryRun })) {
		modified.set('Cargo.lock', {
			relativePath: 'Cargo.lock',
			oldVersion: bumpedFrom,
		})
	}

	return [...modified.values()]
}

function isCargoWorkspaceInherited(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === 'object' &&
		(value as { workspace?: unknown }).workspace === true
	)
}

// Returns the member directories (relative to rootDir) of a Cargo workspace,
// excluding the root package itself.
async function getCargoWorkspaceMembers(
	rootDir: string,
	manifest: CargoManifest,
): Promise<string[]> {
	const members = Array.isArray(manifest.workspace?.members)
		? manifest.workspace.members.filter((m): m is string => typeof m === 'string')
		: []
	const exclude = Array.isArray(manifest.workspace?.exclude)
		? manifest.workspace.exclude
				.filter((e): e is string => typeof e === 'string')
				.map((e) => path.normalize(e))
		: []
	if (members.length === 0) {
		return []
	}

	const manifests = await globby(
		members.map((member) => path.posix.join(member, 'Cargo.toml')),
		{ cwd: rootDir, gitignore: false },
	)
	const dirs = new Set<string>()
	for (const manifestPath of manifests) {
		const dir = path.normalize(path.dirname(manifestPath))
		if (dir === '.') {
			continue
		}
		if (exclude.some((e) => dir === e || dir.startsWith(e + path.sep))) {
			continue
		}
		dirs.add(dir)
	}

	return [...dirs].sort()
}

// Given a dependency table, returns an override object that updates the version
// requirement of every path dependency on a bumped package. Returns undefined
// when nothing needs to change.
function cargoDependencyOverride(
	deps: unknown,
	bumped: Map<string, string>,
	newVersion: string,
): Record<string, { version: string }> | undefined {
	if (deps === null || typeof deps !== 'object') {
		return undefined
	}

	const override: Record<string, { version: string }> = {}
	for (const [key, dep] of Object.entries(deps as Record<string, any>)) {
		if (dep === null || typeof dep !== 'object' || typeof dep.path !== 'string') {
			continue
		}
		const name = typeof dep.package === 'string' ? dep.package : key
		if (!bumped.has(name) || typeof dep.version !== 'string') {
			continue
		}

		// Keep the requirement operator (e.g. `=`, `^`, `~`) but replace the version.
		const match = /^(\s*[=^~]?\s*)([^\s,]+)(\s*)$/.exec(dep.version)
		if (!match || !isLiteralVersion(match[2]!)) {
			continue
		}
		const requirement = `${match[1]}${newVersion}${match[3]}`
		if (requirement !== dep.version) {
			override[key] = { version: requirement }
		}
	}

	return Object.keys(override).length > 0 ? override : undefined
}

async function mergeTomlOverride(
	filepath: string,
	override: Record<string, any>,
	{ dryRun }: { dryRun: boolean },
): Promise<boolean> {
	const text = await fs.readFile(filepath, 'utf-8')
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-toml-'))
	try {
		const overridePath = path.join(tmpDir, 'override.toml')
		await fs.writeFile(overridePath, toml.stringify(override))
		const output = await mergeTOML(filepath, overridePath)
		if (output === text) {
			return false
		}
		if (!dryRun) {
			await fs.writeFile(filepath, output)
		}
		return true
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

// Updates the entries of bumped workspace packages in Cargo.lock, along with
// any `dependencies` references that spell out their old version.
async function updateCargoLockVersion(
	rootDir: string,
	bumped: Map<string, string>,
	newVersion: string,
	{ dryRun }: { dryRun: boolean },
): Promise<boolean> {
	const lockPath = path.join(rootDir, 'Cargo.lock')
	if (!(await fileExists(lockPath))) {
		return false
	}

	const lock: any = toml.parse(await fs.readFile(lockPath, 'utf-8'))
	if (!Array.isArray(lock.package)) {
		return false
	}

	// References look like "name", "name version", or "name version (source)".
	// Local (path) packages have no source, so only bare "name version" refer to them.
	const renamedRefs = new Map<string, string>()
	for (const [name, oldVersion] of bumped) {
		renamedRefs.set(`${name} ${oldVersion}`, `${name} ${newVersion}`)
	}

	let changed = false
	const overrides = lock.package.map((pkg: any) => {
		const override: Record<string, unknown> = {}
		if (!pkg.source && bumped.has(pkg.name) && pkg.version !== newVersion) {
			override.version = newVersion
			changed = true
		}
		if (Array.isArray(pkg.dependencies)) {
			const deps = pkg.dependencies.map((dep: string) => renamedRefs.get(dep) ?? dep)
			if (deps.some((dep: string, i: number) => dep !== pkg.dependencies[i])) {
				override.dependencies = deps
				changed = true
			}
		}
		return override
	})
	if (!changed) {
		return false
	}

	// Written by hand so that `dependencies` arrays keep Cargo's multi-line formatting.
	let overrideText = ''
	for (const override of overrides) {
		overrideText += '[[package]]\n'
		if (typeof override.version === 'string') {
			overrideText += `version = ${JSON.stringify(override.version)}\n`
		}
		if (Array.isArray(override.dependencies)) {
			overrideText += 'dependencies = [\n'
			for (const dep of override.dependencies) {
				overrideText += ` ${JSON.stringify(dep)},\n`
			}
			overrideText += ']\n'
		}
		overrideText += '\n'
	}

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-toml-'))
	try {
		const overridePath = path.join(tmpDir, 'override.toml')
		await fs.writeFile(overridePath, overrideText)
		if (!dryRun) {
			await fs.writeFile(lockPath, await mergeTOML(lockPath, overridePath))
		}
		return true
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

// Shared by C and C++. Probes CMake, autoconf, Meson, and Make instead of
// assuming one build system, so `c-cmake` / `c-autoconf` / `c-meson` / `c-make`
// can reuse it.
async function updateCFamilyVersion(
	rootDir: string,
	newVersion: string,
	{ dryRun }: { dryRun: boolean },
): Promise<VersionUpdate[]> {
	const candidates: [string, (text: string) => VersionReplacement][] = [
		['CMakeLists.txt', (text) => replaceCmakeVersion(text, newVersion)],
		['configure.ac', (text) => replaceAutoconfVersion(text, newVersion)],
		['configure.in', (text) => replaceAutoconfVersion(text, newVersion)],
		['meson.build', (text) => replaceMesonVersion(text, newVersion)],
		['GNUmakefile', (text) => replaceMakefileVersion(text, newVersion)],
		['Makefile', (text) => replaceMakefileVersion(text, newVersion)],
		['makefile', (text) => replaceMakefileVersion(text, newVersion)],
	]

	for (const [relative, transform] of candidates) {
		const filepath = path.join(rootDir, relative)
		if (!(await fileExists(filepath))) {
			continue
		}

		const text = await fs.readFile(filepath, 'utf-8')
		const { output, oldVersion } = transform(text)
		if (output !== text) {
			if (!dryRun) {
				await fs.writeFile(filepath, output)
			}
			return [{ relativePath: relative, oldVersion }]
		}
	}

	return []
}

// Merges `version` into an existing literal version using the comment-preserving
// TOML merge. Missing or non-literal versions are left alone.
async function mergeTomlVersion(
	filepath: string,
	section: string | null,
	newVersion: string,
	{ dryRun }: { dryRun: boolean },
): Promise<string | undefined> {
	const text = await fs.readFile(filepath, 'utf-8')
	const keys = section === null ? [] : section.split('.')
	let table: any = toml.parse(text)
	for (const key of keys) {
		table = table?.[key]
	}
	if (typeof table?.version !== 'string' || !isLiteralVersion(table.version)) {
		return undefined
	}
	if (table.version === newVersion) {
		return undefined
	}

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-toml-'))
	try {
		const overridePath = path.join(tmpDir, 'override.toml')
		const header =
			section === null ? '' : `[${keys.map((k) => JSON.stringify(k)).join('.')}]\n`
		await fs.writeFile(overridePath, `${header}version = ${JSON.stringify(newVersion)}\n`)
		const output = await mergeTOML(filepath, overridePath)
		if (output === text) {
			return undefined
		}
		if (!dryRun) {
			await fs.writeFile(filepath, output)
		}
		return table.version
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

function replaceIniValue(
	text: string,
	section: string,
	key: string,
	value: string,
): VersionReplacement {
	const newline = text.includes('\r\n') ? '\r\n' : '\n'
	const lines = text.split(/\r?\n/)
	let inSection = false

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!
		const header = /^\s*\[([^\]]+)\]\s*(?:[#;].*)?$/.exec(line)
		if (header) {
			inSection = header[1]!.trim() === section
			continue
		}

		if (!inSection) {
			continue
		}

		const match = new RegExp(
			`^(\\s*${escapeRegExp(key)}\\s*=\\s*)(.*?)(\\s*(?:[#;].*)?)$`,
		).exec(line)
		if (match && isLiteralVersion(match[2]!)) {
			lines[index] = `${match[1]}${value}${match[3]}`
			return { output: lines.join(newline), oldVersion: match[2]! }
		}
	}

	return { output: text, oldVersion: '' }
}

function replaceIniTopLevelValue(
	text: string,
	key: string,
	value: string,
): VersionReplacement {
	const newline = text.includes('\r\n') ? '\r\n' : '\n'
	const lines = text.split(/\r?\n/)

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!
		if (/^\s*\[/.test(line)) {
			break
		}

		const match = new RegExp(
			`^(\\s*${escapeRegExp(key)}\\s*=\\s*)(.*?)(\\s*(?:[#;].*)?)$`,
		).exec(line)
		if (match && isLiteralVersion(match[2]!)) {
			lines[index] = `${match[1]}${value}${match[3]}`
			return { output: lines.join(newline), oldVersion: match[2]! }
		}
	}

	return { output: text, oldVersion: '' }
}

function replaceCmakeVersion(text: string, newVersion: string): VersionReplacement {
	const project = /\bproject\s*\(([\s\S]*?)\)/.exec(text)
	if (project) {
		const block = project[1]!
		const match = /\bVERSION\s+([^\s)#]+)/.exec(block)
		if (match) {
			const current = match[1]!

			if (isLiteralVersion(current)) {
				const blockStart = project.index + project[0].indexOf(block)
				const valueStart = blockStart + match.index
				return {
					output:
						text.slice(0, valueStart) +
						match[0].replace(current, newVersion) +
						text.slice(valueStart + match[0].length),
					oldVersion: current,
				}
			}

			const variable = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(current)?.[1]
			if (variable) {
				const setMatch = new RegExp(
					`(\\bset\\s*\\(\\s*${escapeRegExp(variable)}\\s+)(["']?)([^"'\\s)]+)\\2`,
					'm',
				).exec(text)
				if (setMatch && isLiteralVersion(setMatch[3]!)) {
					return {
						output:
							text.slice(0, setMatch.index) +
							`${setMatch[1]}${setMatch[2]}${newVersion}${setMatch[2]}` +
							text.slice(setMatch.index + setMatch[0].length),
						oldVersion: setMatch[3]!,
					}
				}
			}
		}
	}

	const setMatch =
		/(\bset\s*\(\s*(?:PROJECT_VERSION|[A-Za-z_][A-Za-z0-9_]*_VERSION)\s+)(["']?)([^"'\s)]+)\2/.exec(
			text,
		)
	if (setMatch && isLiteralVersion(setMatch[3]!)) {
		return {
			output:
				text.slice(0, setMatch.index) +
				`${setMatch[1]}${setMatch[2]}${newVersion}${setMatch[2]}` +
				text.slice(setMatch.index + setMatch[0].length),
			oldVersion: setMatch[3]!,
		}
	}

	return { output: text, oldVersion: '' }
}

function replaceAutoconfVersion(text: string, newVersion: string): VersionReplacement {
	const init = /\bAC_INIT\s*\(([\s\S]*?)\)/.exec(text)
	if (!init) {
		return { output: text, oldVersion: '' }
	}

	const args = init[1]!
	const argsStart = init.index + init[0].indexOf(args)

	const bracketed = /^([\s\S]*?,\s*\[)([^\]]*)(\])/.exec(args)
	if (bracketed) {
		const raw = bracketed[2]!
		const current = raw.trim()
		if (!isLiteralVersion(current)) {
			return { output: text, oldVersion: '' }
		}

		const leading = raw.length - raw.trimStart().length
		const valueStart = argsStart + bracketed.index + bracketed[1]!.length + leading
		return {
			output:
				text.slice(0, valueStart) + newVersion + text.slice(valueStart + current.length),
			oldVersion: current,
		}
	}

	const quoted = /^([\s\S]*?,\s*)(['"])([^'"]*)\2/.exec(args)
	if (!quoted) {
		return { output: text, oldVersion: '' }
	}

	const current = quoted[3]!
	if (!isLiteralVersion(current)) {
		return { output: text, oldVersion: '' }
	}

	const valueStart = argsStart + quoted.index + quoted[1]!.length + 1
	return {
		output:
			text.slice(0, valueStart) + newVersion + text.slice(valueStart + current.length),
		oldVersion: current,
	}
}

function replaceMesonVersion(text: string, newVersion: string): VersionReplacement {
	const project = /\bproject\s*\(([\s\S]*?)\)/.exec(text)
	if (!project) {
		return { output: text, oldVersion: '' }
	}

	const block = project[1]!
	const match = /\bversion\s*:\s*(['"])(.*?)\1/.exec(block)
	if (!match) {
		return { output: text, oldVersion: '' }
	}

	const current = match[2]!
	if (!isLiteralVersion(current)) {
		return { output: text, oldVersion: '' }
	}

	const blockStart = project.index + project[0].indexOf(block)
	const valueStart = blockStart + match.index
	return {
		output:
			text.slice(0, valueStart) +
			match[0].replace(current, newVersion) +
			text.slice(valueStart + match[0].length),
		oldVersion: current,
	}
}

function replaceMakefileVersion(text: string, newVersion: string): VersionReplacement {
	const match =
		/^([ \t]*(?:VERSION|PACKAGE_VERSION)[ \t]*[:?+]?=[ \t]*)(['"]?)([^'"\s#]+)\2([ \t]*(?:#.*)?)$/m.exec(
			text,
		)
	if (!match) {
		return { output: text, oldVersion: '' }
	}

	const current = match[3]!
	if (!isLiteralVersion(current)) {
		return { output: text, oldVersion: '' }
	}

	return {
		output:
			text.slice(0, match.index) +
			`${match[1]}${match[2]}${newVersion}${match[2]}${match[4]}` +
			text.slice(match.index + match[0].length),
		oldVersion: current,
	}
}

function replacePomVersion(text: string, newVersion: string): VersionReplacement {
	const parent = /<parent>[\s\S]*?<\/parent>/.exec(text)
	const start = parent ? parent.index + parent[0].length : 0
	const tail = text.slice(start)
	const match = /<version>([ \t]*)([^<]*?)([ \t]*)<\/version>/.exec(tail)
	if (!match) {
		return { output: text, oldVersion: '' }
	}

	const current = match[2]!.trim()
	if (/^\$\{[^}]+\}$/.test(current)) {
		const property = current.slice(2, -1)
		if (property === 'revision') {
			const revision = /<revision>([ \t]*)([^<]*?)([ \t]*)<\/revision>/.exec(text)
			if (revision) {
				return {
					output:
						text.slice(0, revision.index) +
						`<revision>${revision[1]}${newVersion}${revision[3]}</revision>` +
						text.slice(revision.index + revision[0].length),
					oldVersion: revision[2]!,
				}
			}
		}

		return { output: text, oldVersion: '' }
	}

	const matchStart = start + match.index
	return {
		output:
			text.slice(0, matchStart) +
			`<version>${match[1]}${newVersion}${match[3]}</version>` +
			text.slice(matchStart + match[0].length),
		oldVersion: current,
	}
}

function isLiteralVersion(value: string): boolean {
	return /^[0-9][0-9A-Za-z._+~-]*$/.test(value.trim())
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
