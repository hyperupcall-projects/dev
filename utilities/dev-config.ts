import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import untildify from 'untildify'

export type KnowledgeFolderConfig = {
	id: string
	name: string
	path: string
}

export type DevConfig = {
	paths: {
		activityProjectsRoot: string
		gardenYaml: string
		serviceListDir: string
		ublacklistDir: string
		clonedRepositories: string
		managedRepositories: string
		symlinkedRepositories: string
		codeDir: string
		repositoriesJson: string
		vscodeDataDirs: string
		vscodeExtensions: string
		ecosystemIcons: string
		setupPrivate: string
		nodeBinary: string
		repoDev: string
		repoDotfiles: string
		dictionaryDotfiles: string
		dictionaryCspellDisplay: string
	}
	pinnedProjects: string[]
	knowledgeFolders: KnowledgeFolderConfig[]
	binaries: {
		obsidian: string[]
		clion: string[]
	}
}

let cached: DevConfig | null = null
let loading: Promise<DevConfig> | null = null

export function getDevConfigPath(): string {
	if (process.env.DEV_CONFIG) {
		return path.resolve(process.env.DEV_CONFIG)
	}
	return path.join(os.homedir(), '.devhidden', 'configs', 'dev.config.js')
}

function expandValue(value: unknown): unknown {
	if (typeof value === 'string') {
		if (value === '~' || value.startsWith('~/')) {
			return untildify(value)
		}
		return value
	}
	if (Array.isArray(value)) {
		return value.map(expandValue)
	}
	if (value !== null && typeof value === 'object') {
		const out: Record<string, unknown> = {}
		for (const [key, child] of Object.entries(value)) {
			out[key] = expandValue(child)
		}
		return out
	}
	return value
}

function assertDevConfig(value: unknown, configPath: string): DevConfig {
	if (!value || typeof value !== 'object') {
		throw new Error(`Invalid dev config (expected object): ${configPath}`)
	}
	const cfg = value as Partial<DevConfig>
	if (!cfg.paths || typeof cfg.paths !== 'object') {
		throw new Error(`Invalid dev config (missing paths): ${configPath}`)
	}
	if (!Array.isArray(cfg.pinnedProjects)) {
		throw new Error(`Invalid dev config (missing pinnedProjects): ${configPath}`)
	}
	if (!Array.isArray(cfg.knowledgeFolders)) {
		throw new Error(
			`Invalid dev config (missing knowledgeFolders): ${configPath}`,
		)
	}
	if (!cfg.binaries || typeof cfg.binaries !== 'object') {
		throw new Error(`Invalid dev config (missing binaries): ${configPath}`)
	}
	return cfg as DevConfig
}

/**
 * Load and cache ~/.devhidden/configs/dev.config.js (or DEV_CONFIG).
 * All `~/...` strings are expanded to absolute paths.
 */
export async function getDevConfig(): Promise<DevConfig> {
	if (cached) return cached
	if (loading) return loading

	loading = (async () => {
		const configPath = getDevConfigPath()
		if (!fs.existsSync(configPath)) {
			throw new Error(
				`Missing private config file: ${configPath}\n` +
					`Create it or set DEV_CONFIG to an alternate path.`,
			)
		}

		const stat = fs.statSync(configPath)
		if (stat.size === 0) {
			throw new Error(`Private config file is empty: ${configPath}`)
		}

		let raw: unknown
		try {
			// Bust import cache so edits / DEV_CONFIG swaps are visible.
			const url = `${pathToFileURL(configPath).href}?t=${stat.mtimeMs}`
			const mod = (await import(url)) as { default?: unknown }
			raw = mod.default
		} catch (error) {
			throw new Error(
				`Failed to load private config ${configPath}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}

		if (raw === undefined) {
			throw new Error(
				`Private config must use ESM \`export default { ... }\`: ${configPath}`,
			)
		}

		cached = assertDevConfig(expandValue(raw), configPath)
		return cached
	})()

	try {
		return await loading
	} finally {
		loading = null
	}
}

/** Clear the cached config (for tests). */
export function clearDevConfigCache(): void {
	cached = null
	loading = null
}
