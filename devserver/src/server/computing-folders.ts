import { execFile, spawn } from 'node:child_process'
import { access, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { getDevConfig } from '#utilities/dev-config.ts'

const execFileAsync = promisify(execFile)

export const COMPUTING_FOLDER_IDS = [
	'college',
	'competitive-programming',
	'data-science',
	'database',
	'experiments',
	'game-development',
	'programs',
] as const

export type ComputingFolderId = (typeof COMPUTING_FOLDER_IDS)[number]

export const COMPUTING_FOLDER_OPENERS = [
	'vscode',
	'zed',
	'kate',
	'clion',
	'file-manager',
] as const

export type ComputingFolderOpener = (typeof COMPUTING_FOLDER_OPENERS)[number]

export type ComputingSubdirectory = {
	id: string
	name: string
	path: string
}

export type ComputingFolder = {
	id: ComputingFolderId
	name: string
	path: string
	exists: boolean
	subdirectories: ComputingSubdirectory[]
}

const FOLDER_NAMES: Record<ComputingFolderId, string> = {
	college: 'College',
	'competitive-programming': 'Competitive Programming',
	'data-science': 'Data Science',
	database: 'Database',
	experiments: 'Experiments',
	'game-development': 'Game Development',
	programs: 'Programs',
}

function computingRoot(): string {
	return path.join(os.homedir(), 'Documents', 'Computing')
}

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

function spawnDetached(binary: string, args: string[]): void {
	const child = spawn(binary, args, {
		detached: true,
		stdio: 'ignore',
		env: process.env,
	})
	child.unref()
}

async function listSubdirectories(
	folderId: ComputingFolderId,
	folderPath: string,
): Promise<ComputingSubdirectory[]> {
	try {
		const entries = await readdir(folderPath, { withFileTypes: true })
		return entries
			.filter((entry) => entry.isDirectory())
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((entry) => ({
				id: `${folderId}::${entry.name}`,
				name: entry.name,
				path: path.join(folderPath, entry.name),
			}))
	} catch {
		return []
	}
}

export async function listComputingFolders(): Promise<ComputingFolder[]> {
	const root = computingRoot()
	return Promise.all(
		COMPUTING_FOLDER_IDS.map(async (id) => {
			const folderPath = path.join(root, FOLDER_NAMES[id])
			return {
				id,
				name: FOLDER_NAMES[id],
				path: folderPath,
				exists: await pathExists(folderPath),
				subdirectories: await listSubdirectories(id, folderPath),
			}
		}),
	)
}

async function openFileManager(folderPath: string): Promise<void> {
	const binary = await resolveCommand(['xdg-open', 'dolphin', 'nautilus', 'thunar'])
	if (!binary) {
		throw new Error(
			'Could not find a file manager (xdg-open, dolphin, nautilus, or thunar).',
		)
	}
	spawnDetached(binary, [folderPath])
}

export async function openComputingFolder(options: {
	folderId: ComputingFolderId
	subdirectoryId?: string
	opener: ComputingFolderOpener
}): Promise<{
	folderId: ComputingFolderId
	opener: ComputingFolderOpener
	opened: string
}> {
	const { folderId, subdirectoryId, opener } = options
	if (!COMPUTING_FOLDER_IDS.includes(folderId)) {
		throw new Error(`Unknown computing folder id: ${String(folderId)}`)
	}
	if (!COMPUTING_FOLDER_OPENERS.includes(opener)) {
		throw new Error(`Unsupported opener: ${String(opener)}`)
	}

	const folder = (await listComputingFolders()).find((item) => item.id === folderId)
	if (!folder || !folder.exists) {
		throw new Error(`Computing folder does not exist: ${FOLDER_NAMES[folderId]}`)
	}

	let folderPath = folder.path
	if (subdirectoryId) {
		const subdirectory = folder.subdirectories.find((item) => item.id === subdirectoryId)
		if (!subdirectory) {
			throw new Error(`Unknown subdirectory id: ${subdirectoryId}`)
		}
		folderPath = subdirectory.path
	}

	if (opener === 'file-manager') {
		await openFileManager(folderPath)
	} else {
		const candidates: Record<Exclude<ComputingFolderOpener, 'file-manager'>, string[]> = {
			vscode: ['code', 'code-insiders'],
			zed: ['zed'],
			kate: ['kate'],
			clion: (await getDevConfig()).binaries.clion,
		}
		const binary = await resolveCommand(candidates[opener])
		if (!binary) {
			throw new Error(
				`Could not find the ${opener} executable. Install it or add it to PATH.`,
			)
		}
		spawnDetached(binary, [folderPath])
	}

	return { folderId, opener, opened: folderPath }
}
