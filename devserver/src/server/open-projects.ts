import { execFile, spawn } from 'node:child_process'
import { access, mkdir, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { getDevConfig } from '#utilities/dev-config.ts'
import {
	resolveProjectsByIds,
	type GardenProject,
} from './garden-projects.ts'

const execFileAsync = promisify(execFile)

export const IDE_IDS = [
	'zed',
	'vscode',
	'cursor',
	'kate',
	'clion',
] as const

export type IdeId = (typeof IDE_IDS)[number]

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

async function resolveIdeBinary(ide: IdeId): Promise<string> {
	const map: Record<IdeId, string[]> = {
		zed: ['zed'],
		vscode: ['code'],
		cursor: ['cursor'],
		kate: ['kate'],
		clion: (await getDevConfig()).binaries.clion,
	}
	const binary = await resolveCommand(map[ide])
	if (!binary) {
		throw new Error(
			`Could not find the ${ide} executable. Install it or add it to PATH.`,
		)
	}
	return binary
}

function spawnDetached(bin: string, args: string[]): void {
	const proc = spawn(bin, args, {
		detached: true,
		stdio: 'ignore',
		env: process.env,
	})
	proc.unref()
}

async function createSymlinkWorkspace(
	projects: GardenProject[],
): Promise<string> {
	const dir = path.join(os.tmpdir(), `dev-project-manager-${randomUUID()}`)
	await mkdir(dir, { recursive: true })

	const usedNames = new Set<string>()
	for (const project of projects) {
		let name = project.name
		if (usedNames.has(name)) {
			name = `${project.categoryId}-${project.name}`
		}
		let unique = name
		let n = 2
		while (usedNames.has(unique)) {
			unique = `${name}-${n}`
			n += 1
		}
		usedNames.add(unique)
		await symlink(project.path, path.join(dir, unique))
	}
	return dir
}

async function createCodeWorkspace(
	projects: GardenProject[],
): Promise<string> {
	const dir = path.join(os.tmpdir(), `dev-project-manager-${randomUUID()}`)
	await mkdir(dir, { recursive: true })
	const workspacePath = path.join(dir, 'workspace.code-workspace')
	const workspace = {
		folders: projects.map((p) => ({
			name: p.name,
			path: p.path,
		})),
	}
	await writeFile(
		workspacePath,
		JSON.stringify(workspace, null, '\t') + '\n',
		'utf8',
	)
	return workspacePath
}

export async function openProjects(options: {
	ide: IdeId
	projectIds: string[]
}): Promise<{ ide: IdeId; opened: string; projectCount: number }> {
	const { ide, projectIds } = options
	if (!IDE_IDS.includes(ide)) {
		throw new Error(`Unsupported IDE: ${String(ide)}`)
	}
	if (!Array.isArray(projectIds) || projectIds.length === 0) {
		throw new Error('Select at least one project')
	}

	const projects = await resolveProjectsByIds(projectIds)
	const missing = projects.filter((p) => !p.exists)
	if (missing.length > 0) {
		throw new Error(
			`Project path(s) do not exist: ${missing.map((p) => p.path).join(', ')}`,
		)
	}

	const binary = await resolveIdeBinary(ide)

	if (projects.length === 1) {
		spawnDetached(binary, [projects[0]!.path])
		return {
			ide,
			opened: projects[0]!.path,
			projectCount: 1,
		}
	}

	if (ide === 'vscode' || ide === 'cursor') {
		const workspacePath = await createCodeWorkspace(projects)
		spawnDetached(binary, [workspacePath])
		return {
			ide,
			opened: workspacePath,
			projectCount: projects.length,
		}
	}

	// Zed, Kate, CLion: temporary workspace root with symlinks
	const workspaceDir = await createSymlinkWorkspace(projects)
	spawnDetached(binary, [workspaceDir])
	return {
		ide,
		opened: workspaceDir,
		projectCount: projects.length,
	}
}
