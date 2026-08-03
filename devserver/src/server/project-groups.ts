import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../../data')
const groupsFile = path.join(dataDir, 'saved-groups.json')

export type SavedGroup = {
	id: string
	name: string
	projectIds: string[]
	updatedAt: string
}

async function ensureDataDir(): Promise<void> {
	await mkdir(dataDir, { recursive: true })
}

async function readGroups(): Promise<SavedGroup[]> {
	await ensureDataDir()
	try {
		const raw = await readFile(groupsFile, 'utf8')
		const parsed = JSON.parse(raw) as SavedGroup[]
		if (!Array.isArray(parsed)) return []
		return parsed
	} catch (error) {
		const err = error as NodeJS.ErrnoException
		if (err.code === 'ENOENT') return []
		throw error
	}
}

async function writeGroups(groups: SavedGroup[]): Promise<void> {
	await ensureDataDir()
	await writeFile(groupsFile, JSON.stringify(groups, null, '\t') + '\n', 'utf8')
}

export async function listSavedGroups(): Promise<SavedGroup[]> {
	return readGroups()
}

export async function createSavedGroup(
	name: string,
	projectIds: string[],
): Promise<SavedGroup> {
	const trimmed = name.trim()
	if (!trimmed) throw new Error('Group name is required')
	if (!Array.isArray(projectIds) || projectIds.length === 0) {
		throw new Error('At least one project is required')
	}

	const groups = await readGroups()
	if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
		throw new Error(`A group named "${trimmed}" already exists`)
	}

	const group: SavedGroup = {
		id: randomUUID(),
		name: trimmed,
		projectIds: [...new Set(projectIds)],
		updatedAt: new Date().toISOString(),
	}
	groups.push(group)
	await writeGroups(groups)
	return group
}

export async function renameSavedGroup(
	id: string,
	name: string,
): Promise<SavedGroup> {
	const trimmed = name.trim()
	if (!trimmed) throw new Error('Group name is required')

	const groups = await readGroups()
	const group = groups.find((g) => g.id === id)
	if (!group) throw new Error(`Group not found: ${id}`)

	if (
		groups.some(
			(g) =>
				g.id !== id && g.name.toLowerCase() === trimmed.toLowerCase(),
		)
	) {
		throw new Error(`A group named "${trimmed}" already exists`)
	}

	group.name = trimmed
	group.updatedAt = new Date().toISOString()
	await writeGroups(groups)
	return group
}

export async function deleteSavedGroup(id: string): Promise<void> {
	const groups = await readGroups()
	const next = groups.filter((g) => g.id !== id)
	if (next.length === groups.length) {
		throw new Error(`Group not found: ${id}`)
	}
	await writeGroups(next)
}
