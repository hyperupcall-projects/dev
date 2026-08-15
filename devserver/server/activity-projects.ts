import { execFile, spawn } from 'node:child_process'
import { access, readdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { getDevConfig } from '#utilities/dev-config.ts'

const execFileAsync = promisify(execFile)

const FILE_MANAGER_CANDIDATES = ['xdg-open', 'dolphin', 'nautilus', 'thunar']

export type ActivityProject = {
	name: string
	path: string
}

export async function getActivityProjectsRoot(): Promise<string> {
	return (await getDevConfig()).paths.activityProjectsRoot
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

export async function listActivityProjects(): Promise<ActivityProject[]> {
	const root = await getActivityProjectsRoot()
	const entries = await readdir(root, {
		withFileTypes: true,
	})
	return entries
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
		.map((entry) => ({
			name: entry.name,
			path: path.join(root, entry.name),
		}))
		.sort((a, b) => a.name.localeCompare(b.name))
}

export async function openActivityProject(
	folderPath: string,
): Promise<{ opened: string }> {
	if (typeof folderPath !== 'string' || !folderPath) {
		throw new Error('Expected folder path')
	}

	const resolved = path.resolve(folderPath)
	const root = path.resolve(await getActivityProjectsRoot())
	if (resolved !== root && !resolved.startsWith(root + path.sep)) {
		throw new Error(`Folder must be under ${root}`)
	}
	if (!(await pathExists(resolved))) {
		throw new Error(`Folder does not exist: ${resolved}`)
	}

	const binary = await resolveCommand(FILE_MANAGER_CANDIDATES)
	if (!binary) {
		throw new Error(
			'Could not find a file manager (xdg-open, dolphin, nautilus, or thunar).',
		)
	}
	spawnDetached(binary, [resolved])
	return { opened: resolved }
}
