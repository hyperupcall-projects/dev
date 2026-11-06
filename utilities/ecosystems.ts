import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { globby } from 'globby'
import toml from 'smol-toml'

import { mergeTOML } from './util.ts'

export type DetectionContext = Readonly<{
	rootDir: string
}>

export type TemplateDefinition = {
	name: string
}

export type EcosystemDefinition = {
	label: string
	ecosystemInDir: (context: DetectionContext) => Promise<boolean>
	lintFileGlobs: () => Promise<string[]>
	updateVersion: (rootDir: string, version: string) => Promise<string[]>
	vscodePackId?: string
	templates?: Record<string, TemplateDefinition>
}

export const ecosystems = {
	nodejs: {
		label: 'Node.js',
		async ecosystemInDir(context) {
			return await fileExists(path.join(context.rootDir, 'package.json'))
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
		async updateVersion(rootDir, version) {
			return await updateJsonVersion(rootDir, 'package.json', version)
		},
	},
	'vscode-extension': {
		label: 'VS Code Extension',
		async ecosystemInDir(context) {
			const filepath = path.join(context.rootDir, 'package.json')
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
		async updateVersion(rootDir, version) {
			return await updateJsonVersion(rootDir, 'package.json', version)
		},
	},
	deno: {
		label: 'Deno',
		async ecosystemInDir(context) {
			return (
				(await fileExists(path.join(context.rootDir, 'deno.jsonc'))) ||
				(await fileExists(path.join(context.rootDir, 'deno.json')))
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
		async updateVersion(rootDir, version) {
			const modified: string[] = []
			for (const relative of [
				'deno.json',
				'deno.jsonc',
			]) {
				modified.push(...(await updateJsonVersion(rootDir, relative, version)))
			}

			return modified
		},
	},
	c: {
		label: 'C',
		async ecosystemInDir(context) {
			if ((await globby('*.c', { cwd: context.rootDir })).length > 0) {
				return true
			}

			return (await getCmakeLanguage(context.rootDir)) === 'C'
		},
		vscodePackId: 'vscode-hyperupcall-pack-cpp',
		async lintFileGlobs() {
			return ['400-ecosystem/c/*']
		},
		async updateVersion(rootDir, version) {
			return await updateCFamilyVersion(rootDir, version)
		},
	},
	python: {
		label: 'Python',
		async ecosystemInDir(context) {
			return (
				(await fileExists(path.join(context.rootDir, 'pyproject.toml'))) ||
				(await globby('*.py', { cwd: context.rootDir })).length > 0
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/python/*']
		},
		async updateVersion(rootDir, version) {
			const pyproject = 'pyproject.toml'
			const pyprojectPath = path.join(rootDir, pyproject)
			if (await fileExists(pyprojectPath)) {
				let changed = false
				for (const section of ['project', 'tool.poetry']) {
					changed = (await mergeTomlVersion(pyprojectPath, section, version)) || changed
				}

				if (changed) {
					return [pyproject]
				}
			}

			const setupCfg = 'setup.cfg'
			const setupCfgPath = path.join(rootDir, setupCfg)
			if (await fileExists(setupCfgPath)) {
				const text = await fs.readFile(setupCfgPath, 'utf-8')
				const output = replaceIniValue(text, 'metadata', 'version', version)
				if (output !== text) {
					await fs.writeFile(setupCfgPath, output)
					return [setupCfg]
				}
			}

			const setupPy = 'setup.py'
			const setupPyPath = path.join(rootDir, setupPy)
			if (await fileExists(setupPyPath)) {
				const text = await fs.readFile(setupPyPath, 'utf-8')
				const output = text.replace(
					/(\bversion\s*=\s*)(['"])([^'"]*)\2/,
					`$1$2${version}$2`,
				)
				if (output !== text) {
					await fs.writeFile(setupPyPath, output)
					return [setupPy]
				}
			}

			return []
		},
	},
	cpp: {
		label: 'C++',
		async ecosystemInDir(context) {
			return (await getCmakeLanguage(context.rootDir)) === 'CXX'
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
		async updateVersion(rootDir, version) {
			return await updateCFamilyVersion(rootDir, version)
		},
	},
	bash: {
		label: 'Bash',
		async ecosystemInDir(context) {
			return await fileExists(path.join(context.rootDir, 'basalt.toml'))
		},
		async lintFileGlobs() {
			return ['400-ecosystem/bash/*']
		},
		async updateVersion(rootDir, version) {
			return await updateTomlVersion(rootDir, 'basalt.toml', 'package', version)
		},
	},
	'woof-plugin': {
		label: 'Woof Plugin',
		async ecosystemInDir(context) {
			return (
				(await fileExists(path.join(context.rootDir, 'manifest.ini'))) &&
				(await fileExists(path.join(context.rootDir, 'tools')))
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/woof-plugin/*']
		},
		async updateVersion(rootDir, version) {
			const relative = 'manifest.ini'
			const filepath = path.join(rootDir, relative)
			if (!(await fileExists(filepath))) {
				return []
			}

			const text = await fs.readFile(filepath, 'utf-8')
			const output = replaceIniTopLevelValue(text, 'version', version)
			if (output === text) {
				return []
			}

			await fs.writeFile(filepath, output)
			return [relative]
		},
	},
	'zed-extension': {
		label: 'Zed Extension',
		async ecosystemInDir(context) {
			return await fileExists(path.join(context.rootDir, 'extension.toml'))
		},
		async lintFileGlobs() {
			return ['400-ecosystem/zed-extension/*']
		},
		async updateVersion(rootDir, version) {
			return await updateTomlVersion(rootDir, 'extension.toml', null, version)
		},
	},
	java: {
		label: 'Java',
		async ecosystemInDir(context) {
			return (
				(await fileExists(path.join(context.rootDir, 'gradlew'))) ||
				(await fileExists(path.join(context.rootDir, 'build.gradle'))) ||
				(await fileExists(path.join(context.rootDir, 'build.gradle.kts')))
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/java/*']
		},
		// Handles both Gradle and Maven so a later `java-gradle` / `java-maven` split
		// can reuse the same updater.
		async updateVersion(rootDir, version) {
			const modified: string[] = []

			const gradleProperties = 'gradle.properties'
			const gradlePropertiesPath = path.join(rootDir, gradleProperties)
			if (await fileExists(gradlePropertiesPath)) {
				const text = await fs.readFile(gradlePropertiesPath, 'utf-8')
				const match =
					/^([ \t]*version[ \t]*=[ \t]*)([^\s#;]+)([ \t]*(?:[#;].*)?)$/m.exec(text)
				if (match && isLiteralVersion(match[2]!)) {
					const output =
						text.slice(0, match.index) +
						`${match[1]}${version}${match[3]}` +
						text.slice(match.index + match[0].length)
					await fs.writeFile(gradlePropertiesPath, output)
					modified.push(gradleProperties)
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
					match = /^([ \t]*version[ \t]+)(['"])([^'"]*)\2([ \t]*(?:\/\/.*)?)$/m.exec(
						text,
					)
				}

				if (match && isLiteralVersion(match[3]!)) {
					const output =
						text.slice(0, match.index) +
						`${match[1]}${match[2]}${version}${match[2]}${match[4]}` +
						text.slice(match.index + match[0].length)
					await fs.writeFile(filepath, output)
					modified.push(relative)
				}
			}

			const pom = 'pom.xml'
			const pomPath = path.join(rootDir, pom)
			if (await fileExists(pomPath)) {
				const text = await fs.readFile(pomPath, 'utf-8')
				const output = replacePomVersion(text, version)
				if (output !== text) {
					await fs.writeFile(pomPath, output)
					modified.push(pom)
				}
			}

			return modified
		},
	},
	rust: {
		label: 'Rust',
		async ecosystemInDir(context) {
			return await fileExists(path.join(context.rootDir, 'Cargo.toml'))
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
		async updateVersion(rootDir, version) {
			return await updateCargoVersion(rootDir, version)
		},
	},
	webext: {
		label: 'Web Extension',
		async ecosystemInDir(context) {
			const filepath = path.join(context.rootDir, 'manifest.json')
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
		async updateVersion(rootDir, version) {
			return await updateJsonVersion(rootDir, 'manifest.json', version)
		},
	},
	go: {
		label: 'Go',
		async ecosystemInDir(context) {
			return (
				(await fileExists(path.join(context.rootDir, 'go.mod'))) ||
				(await globby('*.go', { cwd: context.rootDir })).length > 0
			)
		},
		async lintFileGlobs() {
			return ['400-ecosystem/go/*']
		},
		async updateVersion(rootDir, version) {
			// Go module versions come from Git tags. If the project keeps an explicit
			// VERSION file, keep that in sync as well.
			const relative = 'VERSION'
			const filepath = path.join(rootDir, relative)
			if (!(await fileExists(filepath))) {
				return []
			}

			const text = await fs.readFile(filepath, 'utf-8')
			const output = `${version}${text.endsWith('\n') ? '\n' : ''}`
			if (output === text) {
				return []
			}

			await fs.writeFile(filepath, output)
			return [relative]
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

export async function detectEcosystem(context: DetectionContext): Promise<EcosystemId[]> {
	const detected: EcosystemId[] = []

	for (const [id, definition] of Object.entries(ecosystems) as [
		EcosystemId,
		EcosystemDefinition,
	][]) {
		if (definition.ecosystemInDir && (await definition.ecosystemInDir(context))) {
			detected.push(id)
		}
	}

	return detected
}

export function getConfigEcosystem(id: EcosystemId): EcosystemDefinition {
	return ecosystems[id]
}

export async function lintEcosystem(id: EcosystemId): Promise<string[]> {
	const definition = getConfigEcosystem(id)
	if (!definition.lintFileGlobs) {
		return []
	}

	return await definition.lintFileGlobs()
}

export async function incrementVersionEcosystem(
	id: EcosystemId,
	rootDir: string,
	version: string,
): Promise<string[]> {
	const definition = getConfigEcosystem(id)
	if (!definition.updateVersion) {
		return []
	}

	return await definition.updateVersion(rootDir, version)
}

async function fileExists(filepath: string): Promise<boolean> {
	return await fs
		.stat(filepath)
		.then(() => true)
		.catch(() => false)
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
	relative: string,
	version: string,
): Promise<string[]> {
	const filepath = path.join(rootDir, relative)
	if (!(await fileExists(filepath))) {
		return []
	}

	const text = await fs.readFile(filepath, 'utf-8')
	const output = text.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${version}"`)
	if (output === text) {
		return []
	}

	await fs.writeFile(filepath, output)
	return [relative]
}

async function updateTomlVersion(
	rootDir: string,
	relative: string,
	section: string | null,
	version: string,
): Promise<string[]> {
	const filepath = path.join(rootDir, relative)
	if (!(await fileExists(filepath))) {
		return []
	}

	return (await mergeTomlVersion(filepath, section, version)) ? [relative] : []
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
async function updateCargoVersion(rootDir: string, version: string): Promise<string[]> {
	const rootManifestPath = path.join(rootDir, 'Cargo.toml')
	if (!(await fileExists(rootManifestPath))) {
		return []
	}
	const rootManifest = toml.parse(await fs.readFile(rootManifestPath, 'utf-8')) as CargoManifest

	const modified = new Set<string>()
	// Package name -> version before the update, for every package whose version was bumped.
	const bumped = new Map<string, string>()

	const workspaceVersion = rootManifest.workspace?.package?.version
	const workspaceVersionBumped =
		typeof workspaceVersion === 'string' &&
		isLiteralVersion(workspaceVersion) &&
		workspaceVersion !== version
	if (workspaceVersionBumped) {
		if (await mergeTomlVersion(rootManifestPath, 'workspace.package', version)) {
			modified.add('Cargo.toml')
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
			if (!isLiteralVersion(pkg.version) || pkg.version === version) {
				continue
			}
			if (await mergeTomlVersion(manifestPath, 'package', version)) {
				modified.add(relative)
				bumped.set(pkg.name, pkg.version)
			}
		} else if (isCargoWorkspaceInherited(pkg.version) && workspaceVersionBumped) {
			bumped.set(pkg.name, workspaceVersion)
		}
	}

	if (bumped.size === 0) {
		return [...modified]
	}

	// Update version requirements of path dependencies that point to bumped members.
	if (rootManifest.workspace?.dependencies) {
		const override = cargoDependencyOverride(rootManifest.workspace.dependencies, bumped, version)
		if (override && (await mergeTomlOverride(rootManifestPath, { workspace: { dependencies: override } }))) {
			modified.add('Cargo.toml')
		}
	}
	for (const [memberDir, manifest] of memberManifests) {
		const override: Record<string, any> = {}
		for (const table of cargoDependencyTables) {
			const deps = cargoDependencyOverride(manifest[table], bumped, version)
			if (deps) {
				override[table] = deps
			}
		}
		if (manifest.target && typeof manifest.target === 'object') {
			for (const [target, targetTable] of Object.entries(manifest.target as Record<string, any>)) {
				for (const table of cargoDependencyTables) {
					const deps = cargoDependencyOverride(targetTable?.[table], bumped, version)
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
			(await mergeTomlOverride(path.join(rootDir, relative), override))
		) {
			modified.add(relative)
		}
	}

	if (await updateCargoLockVersion(rootDir, bumped, version)) {
		modified.add('Cargo.lock')
	}

	return [...modified]
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
	version: string,
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
		const requirement = `${match[1]}${version}${match[3]}`
		if (requirement !== dep.version) {
			override[key] = { version: requirement }
		}
	}

	return Object.keys(override).length > 0 ? override : undefined
}

async function mergeTomlOverride(filepath: string, override: Record<string, any>): Promise<boolean> {
	const text = await fs.readFile(filepath, 'utf-8')
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-toml-'))
	try {
		const overridePath = path.join(tmpDir, 'override.toml')
		await fs.writeFile(overridePath, toml.stringify(override))
		const output = await mergeTOML(filepath, overridePath)
		if (output === text) {
			return false
		}
		await fs.writeFile(filepath, output)
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
	version: string,
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
		renamedRefs.set(`${name} ${oldVersion}`, `${name} ${version}`)
	}

	let changed = false
	const overrides = lock.package.map((pkg: any) => {
		const override: Record<string, unknown> = {}
		if (!pkg.source && bumped.has(pkg.name) && pkg.version !== version) {
			override.version = version
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
		await fs.writeFile(lockPath, await mergeTOML(lockPath, overridePath))
		return true
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

// Shared by C and C++. Probes CMake, autoconf, Meson, and Make instead of
// assuming one build system, so `c-cmake` / `c-autoconf` / `c-meson` / `c-make`
// can reuse it.
async function updateCFamilyVersion(rootDir: string, version: string): Promise<string[]> {
	const candidates: [string, (text: string) => string][] = [
		['CMakeLists.txt', (text) => replaceCmakeVersion(text, version)],
		['configure.ac', (text) => replaceAutoconfVersion(text, version)],
		['configure.in', (text) => replaceAutoconfVersion(text, version)],
		['meson.build', (text) => replaceMesonVersion(text, version)],
		['GNUmakefile', (text) => replaceMakefileVersion(text, version)],
		['Makefile', (text) => replaceMakefileVersion(text, version)],
		['makefile', (text) => replaceMakefileVersion(text, version)],
	]

	for (const [relative, transform] of candidates) {
		const filepath = path.join(rootDir, relative)
		if (!(await fileExists(filepath))) {
			continue
		}

		const text = await fs.readFile(filepath, 'utf-8')
		const output = transform(text)
		if (output !== text) {
			await fs.writeFile(filepath, output)
			return [relative]
		}
	}

	return []
}

// Merges `version` into an existing literal version using the comment-preserving
// TOML merge. Missing or non-literal versions are left alone.
async function mergeTomlVersion(
	filepath: string,
	section: string | null,
	version: string,
): Promise<boolean> {
	const text = await fs.readFile(filepath, 'utf-8')
	const keys = section === null ? [] : section.split('.')
	let table: any = toml.parse(text)
	for (const key of keys) {
		table = table?.[key]
	}
	if (typeof table?.version !== 'string' || !isLiteralVersion(table.version)) {
		return false
	}
	if (table.version === version) {
		return false
	}

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dev-toml-'))
	try {
		const overridePath = path.join(tmpDir, 'override.toml')
		const header = section === null ? '' : `[${keys.map((k) => JSON.stringify(k)).join('.')}]\n`
		await fs.writeFile(overridePath, `${header}version = ${JSON.stringify(version)}\n`)
		const output = await mergeTOML(filepath, overridePath)
		if (output === text) {
			return false
		}
		await fs.writeFile(filepath, output)
		return true
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true })
	}
}

function replaceIniValue(
	text: string,
	section: string,
	key: string,
	value: string,
): string {
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
			return lines.join(newline)
		}
	}

	return text
}

function replaceIniTopLevelValue(text: string, key: string, value: string): string {
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
			return lines.join(newline)
		}
	}

	return text
}

function replaceCmakeVersion(text: string, version: string): string {
	const project = /\bproject\s*\(([\s\S]*?)\)/.exec(text)
	if (project) {
		const block = project[1]!
		const match = /\bVERSION\s+([^\s)#]+)/.exec(block)
		if (match) {
			const current = match[1]!

			if (isLiteralVersion(current)) {
				const blockStart = project.index + project[0].indexOf(block)
				const valueStart = blockStart + match.index
				return (
					text.slice(0, valueStart) +
					match[0].replace(current, version) +
					text.slice(valueStart + match[0].length)
				)
			}

			const variable = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(current)?.[1]
			if (variable) {
				const setMatch = new RegExp(
					`(\\bset\\s*\\(\\s*${escapeRegExp(variable)}\\s+)(["']?)([^"'\\s)]+)\\2`,
					'm',
				).exec(text)
				if (setMatch && isLiteralVersion(setMatch[3]!)) {
					return (
						text.slice(0, setMatch.index) +
						`${setMatch[1]}${setMatch[2]}${version}${setMatch[2]}` +
						text.slice(setMatch.index + setMatch[0].length)
					)
				}
			}
		}
	}

	const setMatch =
		/\bset\s*\(\s*(PROJECT_VERSION|[A-Za-z_][A-Za-z0-9_]*_VERSION)\s+(["']?)([^"'\s)]+)\2/.exec(
			text,
		)
	if (setMatch && isLiteralVersion(setMatch[3]!)) {
		return (
			text.slice(0, setMatch.index) +
			`${setMatch[1]}${setMatch[2]}${version}${setMatch[2]}` +
			text.slice(setMatch.index + setMatch[0].length)
		)
	}

	return text
}

function replaceAutoconfVersion(text: string, version: string): string {
	const init = /\bAC_INIT\s*\(([\s\S]*?)\)/.exec(text)
	if (!init) {
		return text
	}

	const args = init[1]!
	const argsStart = init.index + init[0].indexOf(args)

	const bracketed = /^([\s\S]*?,\s*\[)([^\]]*)(\])/.exec(args)
	if (bracketed) {
		const raw = bracketed[2]!
		const current = raw.trim()
		if (!isLiteralVersion(current)) {
			return text
		}

		const leading = raw.length - raw.trimStart().length
		const valueStart = argsStart + bracketed.index + bracketed[1]!.length + leading
		return text.slice(0, valueStart) + version + text.slice(valueStart + current.length)
	}

	const quoted = /^([\s\S]*?,\s*)(['"])([^'"]*)\2/.exec(args)
	if (!quoted) {
		return text
	}

	const current = quoted[3]!
	if (!isLiteralVersion(current)) {
		return text
	}

	const valueStart = argsStart + quoted.index + quoted[1]!.length + 1
	return text.slice(0, valueStart) + version + text.slice(valueStart + current.length)
}

function replaceMesonVersion(text: string, version: string): string {
	const project = /\bproject\s*\(([\s\S]*?)\)/.exec(text)
	if (!project) {
		return text
	}

	const block = project[1]!
	const match = /\bversion\s*:\s*(['"])(.*?)\1/.exec(block)
	if (!match) {
		return text
	}

	const current = match[2]!
	if (!isLiteralVersion(current)) {
		return text
	}

	const blockStart = project.index + project[0].indexOf(block)
	const valueStart = blockStart + match.index
	return (
		text.slice(0, valueStart) +
		match[0].replace(current, version) +
		text.slice(valueStart + match[0].length)
	)
}

function replaceMakefileVersion(text: string, version: string): string {
	const match =
		/^([ \t]*(?:VERSION|PACKAGE_VERSION)[ \t]*[:?+]?=[ \t]*)(['"]?)([^'"\s#]+)\2([ \t]*(?:#.*)?)$/m.exec(
			text,
		)
	if (!match) {
		return text
	}

	const current = match[3]!
	if (!isLiteralVersion(current)) {
		return text
	}

	return (
		text.slice(0, match.index) +
		`${match[1]}${match[2]}${version}${match[2]}${match[4]}` +
		text.slice(match.index + match[0].length)
	)
}

function replacePomVersion(text: string, version: string): string {
	const parent = /<parent>[\s\S]*?<\/parent>/.exec(text)
	const start = parent ? parent.index + parent[0].length : 0
	const tail = text.slice(start)
	const match = /<version>([ \t]*)([^<]*?)([ \t]*)<\/version>/.exec(tail)
	if (!match) {
		return text
	}

	const current = match[2]!.trim()
	if (/^\$\{[^}]+\}$/.test(current)) {
		const property = current.slice(2, -1)
		if (property === 'revision') {
			const revision = /<revision>([ \t]*)([^<]*?)([ \t]*)<\/revision>/.exec(text)
			if (revision) {
				return (
					text.slice(0, revision.index) +
					`<revision>${revision[1]}${version}${revision[3]}</revision>` +
					text.slice(revision.index + revision[0].length)
				)
			}
		}

		return text
	}

	const matchStart = start + match.index
	return (
		text.slice(0, matchStart) +
		`<version>${match[1]}${version}${match[3]}</version>` +
		text.slice(matchStart + match[0].length)
	)
}

function isLiteralVersion(value: string): boolean {
	return /^[0-9][0-9A-Za-z._+~-]*$/.test(value.trim())
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
