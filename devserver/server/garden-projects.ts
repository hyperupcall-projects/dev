import { execFile } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { parse as parseYaml } from 'yaml'
import { getDevConfig } from '#utilities/dev-config.ts'

const execFileAsync = promisify(execFile)

export const PINNED_CATEGORY_ID = 'pinned'

export type GardenProject = {
	id: string
	name: string
	path: string
	categoryId: string
	exists: boolean
}

export type GardenCategory = {
	id: string
	name: string
	projects: GardenProject[]
}

export type GardenCatalog = {
	categories: GardenCategory[]
	warnings: string[]
}

type GardenConfig = {
	variables?: Record<string, string>
	grafts?: Record<string, { config?: string; root?: string }>
	groups?: Record<string, string[]>
}

type GraftConfig = {
	trees?: Record<string, { path?: string } | null | undefined>
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath)
		return true
	} catch {
		return false
	}
}

function expandHome(text: string): string {
	const home = os.homedir()
	if (text === '~') return home
	if (text.startsWith('~/')) return path.join(home, text.slice(2))
	return text.replaceAll(/(^|[^$])~/g, `$1${home}`)
}

async function expandShellVariable(value: string): Promise<string> {
	if (!value.startsWith('$ ')) return value
	const shellCmd = value.slice(2)
	const { stdout } = await execFileAsync('bash', ['-c', shellCmd], {
		encoding: 'utf8',
		maxBuffer: 1024 * 1024,
	})
	return stdout.trim()
}

async function expandVariables(
	text: string,
	variables: Record<string, string>,
): Promise<string> {
	const expandedVars: Record<string, string> = {}
	for (const [name, raw] of Object.entries(variables)) {
		expandedVars[name] = expandHome(await expandShellVariable(raw))
	}

	let result = text
	for (const [name, value] of Object.entries(expandedVars)) {
		result = result.replaceAll(`\${${name}}`, value)
	}
	return expandHome(result)
}

async function loadGraftTrees(
	gardenDir: string,
	graftKey: string,
	graft: { config?: string; root?: string },
	variables: Record<string, string>,
	warnings: string[],
): Promise<{ root: string; trees: Record<string, { path?: string }> } | null> {
	if (!graft.config || !graft.root) {
		warnings.push(`Graft "${graftKey}" is missing config or root`)
		return null
	}

	const configPath = path.isAbsolute(expandHome(graft.config))
		? expandHome(graft.config)
		: path.resolve(gardenDir, graft.config)

	if (!(await pathExists(configPath))) {
		warnings.push(`Graft config not found for "${graftKey}": ${configPath}`)
		return null
	}

	const root = await expandVariables(graft.root, variables)
	const content = await readFile(configPath, 'utf8')
	const parsed = parseYaml(content) as GraftConfig
	const trees: Record<string, { path?: string }> = {}
	for (const [name, tree] of Object.entries(parsed.trees ?? {})) {
		trees[name] = tree && typeof tree === 'object' ? tree : {}
	}
	return { root, trees }
}

export async function getPinnedCategory(): Promise<GardenCategory> {
	const home = os.homedir()
	const projects: GardenProject[] = []
	for (const absolutePath of (await getDevConfig()).pinnedProjects) {
		const name = absolutePath.startsWith(home + path.sep)
			? absolutePath.slice(home.length + 1)
			: path.basename(absolutePath)
		projects.push({
			id: `${PINNED_CATEGORY_ID}::${absolutePath}`,
			name,
			path: absolutePath,
			categoryId: PINNED_CATEGORY_ID,
			exists: await pathExists(absolutePath),
		})
	}
	return {
		id: PINNED_CATEGORY_ID,
		name: 'Pinned',
		projects,
	}
}

export async function getGardenCatalog(): Promise<GardenCatalog> {
	const warnings: string[] = []
	const gardenPath = (await getDevConfig()).paths.gardenYaml
	const gardenDir = path.dirname(gardenPath)
	const pinned = await getPinnedCategory()

	if (!(await pathExists(gardenPath))) {
		return {
			categories: [pinned],
			warnings: [`Garden config not found: ${gardenPath}`],
		}
	}

	const gardenContent = await readFile(gardenPath, 'utf8')
	const garden = parseYaml(gardenContent) as GardenConfig
	const variables = garden.variables ?? {}
	const grafts = garden.grafts ?? {}
	const groups = garden.groups ?? {}

	const graftCache = new Map<
		string,
		{ root: string; trees: Record<string, { path?: string }> } | null
	>()

	async function getGraft(graftKey: string) {
		if (graftCache.has(graftKey)) return graftCache.get(graftKey) ?? null
		const graft = grafts[graftKey]
		if (!graft) {
			warnings.push(`Unknown graft "${graftKey}" referenced in groups`)
			graftCache.set(graftKey, null)
			return null
		}
		const loaded = await loadGraftTrees(
			gardenDir,
			graftKey,
			graft,
			variables,
			warnings,
		)
		graftCache.set(graftKey, loaded)
		return loaded
	}

	const categories: GardenCategory[] = []

	for (const [categoryId, entries] of Object.entries(groups)) {
		const projects: GardenProject[] = []

		for (const entry of entries ?? []) {
			const separator = entry.indexOf('::')
			if (separator === -1) {
				warnings.push(`Invalid group entry in "${categoryId}": ${entry}`)
				continue
			}
			const graftKey = entry.slice(0, separator)
			const treeName = entry.slice(separator + 2)
			const graft = await getGraft(graftKey)
			if (!graft) continue

			const tree = graft.trees[treeName]
			if (!tree) {
				warnings.push(
					`Tree "${treeName}" not found in graft "${graftKey}" (category "${categoryId}")`,
				)
				continue
			}

			const relativePath = tree.path ?? treeName
			const projectPath = path.resolve(graft.root, relativePath)
			projects.push({
				id: entry,
				name: treeName,
				path: projectPath,
				categoryId,
				exists: await pathExists(projectPath),
			})
		}

		categories.push({
			id: categoryId,
			name: categoryId,
			projects,
		})
	}

	return { categories: [pinned, ...categories], warnings }
}

export async function resolveProjectsByIds(
	projectIds: string[],
): Promise<GardenProject[]> {
	const catalog = await getGardenCatalog()
	const byId = new Map<string, GardenProject>()
	for (const category of catalog.categories) {
		for (const project of category.projects) {
			byId.set(project.id, project)
		}
	}

	const resolved: GardenProject[] = []
	const missing: string[] = []
	for (const id of projectIds) {
		const project = byId.get(id)
		if (!project) missing.push(id)
		else resolved.push(project)
	}
	if (missing.length > 0) {
		throw new Error(`Unknown project id(s): ${missing.join(', ')}`)
	}
	return resolved
}
