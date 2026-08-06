import { execFile, spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { getDevConfig } from '#utilities/dev-config.ts'

const execFileAsync = promisify(execFile)

export const KNOWLEDGE_OPENER_IDS = [
	'obsidian',
	'file-manager',
	'zettlr',
	'vscode',
	'zed',
] as const

export type KnowledgeOpenerId = (typeof KNOWLEDGE_OPENER_IDS)[number]

export type KnowledgeFolder = {
	id: string
	name: string
	path: string
}

const ZETTLR_CANDIDATES = ['zettlr', 'Zettlr']

const VSCODE_CANDIDATES = ['code', 'code-insiders']

const ZED_CANDIDATES = ['zed']

const FILE_MANAGER_CANDIDATES = ['xdg-open', 'dolphin', 'nautilus', 'thunar']

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath)
		return true
	} catch {
		return false
	}
}

async function resolveCommand(candidates: string[]): Promise<string | null> {
	for (const candidate of candidates) {
		if (candidate.includes('/') || candidate.startsWith('~')) {
			const expanded = candidate.startsWith('~')
				? path.join(os.homedir(), candidate.slice(1))
				: candidate
			if (await pathExists(expanded)) return expanded
			continue
		}
		try {
			const { stdout } = await execFileAsync('which', [candidate], {
				encoding: 'utf8',
			})
			const found = stdout.trim()
			if (found) return found
		} catch {
			continue
		}
	}
	return null
}

function spawnDetached(bin: string, args: string[]): void {
	const proc = spawn(bin, args, {
		detached: true,
		stdio: 'ignore',
		env: process.env,
	})
	proc.unref()
}

export async function getKnowledgeFolders(): Promise<KnowledgeFolder[]> {
	return (await getDevConfig()).knowledgeFolders.map((folder) => ({ ...folder }))
}

export async function getKnowledgeFolder(
	id: string,
): Promise<KnowledgeFolder | undefined> {
	return (await getKnowledgeFolders()).find((folder) => folder.id === id)
}

export async function listKnowledgeFolders(): Promise<
	Array<KnowledgeFolder & { exists: boolean }>
> {
	const folders = await getKnowledgeFolders()
	return Promise.all(
		folders.map(async (folder) => ({
			...folder,
			exists: await pathExists(folder.path),
		})),
	)
}

export async function openKnowledgeFolder(options: {
	folderId: string
	opener: KnowledgeOpenerId
}): Promise<{ folderId: string; opener: KnowledgeOpenerId; opened: string }> {
	const { folderId, opener } = options
	if (!KNOWLEDGE_OPENER_IDS.includes(opener)) {
		throw new Error(`Unsupported opener: ${String(opener)}`)
	}

	const folder = await getKnowledgeFolder(folderId)
	if (!folder) {
		throw new Error(`Unknown folder id: ${folderId}`)
	}
	if (!(await pathExists(folder.path))) {
		throw new Error(`Folder does not exist: ${folder.path}`)
	}

	if (opener === 'obsidian') {
		const binary = await resolveCommand((await getDevConfig()).binaries.obsidian)
		const uri = `obsidian://open?path=${encodeURIComponent(folder.path)}`
		if (binary) {
			spawnDetached(binary, ['--no-sandbox', uri])
		} else {
			const xdgOpen = await resolveCommand(['xdg-open'])
			if (!xdgOpen) {
				throw new Error(
					'Could not find Obsidian or xdg-open. Install Obsidian or add it to PATH.',
				)
			}
			spawnDetached(xdgOpen, [uri])
		}
		return { folderId, opener, opened: folder.path }
	}

	if (opener === 'vscode') {
		const binary = await resolveCommand(VSCODE_CANDIDATES)
		if (!binary) {
			throw new Error(
				'Could not find VSCode. Install it or add code/code-insiders to PATH.',
			)
		}
		spawnDetached(binary, [folder.path])
		return { folderId, opener, opened: folder.path }
	}

	if (opener === 'zed') {
		const binary = await resolveCommand(ZED_CANDIDATES)
		if (!binary) {
			throw new Error('Could not find the Zed executable. Install it or add it to PATH.')
		}
		spawnDetached(binary, [folder.path])
		return { folderId, opener, opened: folder.path }
	}

	if (opener === 'file-manager') {
		const binary = await resolveCommand(FILE_MANAGER_CANDIDATES)
		if (!binary) {
			throw new Error(
				'Could not find a file manager (xdg-open, dolphin, nautilus, or thunar).',
			)
		}
		spawnDetached(binary, [folder.path])
		return { folderId, opener, opened: folder.path }
	}

	const binary = await resolveCommand(ZETTLR_CANDIDATES)
	if (!binary) {
		throw new Error(
			'Could not find the Zettlr executable. Install it or add it to PATH.',
		)
	}
	spawnDetached(binary, [folder.path])
	return { folderId, opener, opened: folder.path }
}
