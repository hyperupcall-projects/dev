import { execFile, spawn } from 'node:child_process'
import { access, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const FILE_EDITOR_IDS = ['vscode', 'zed', 'sublime', 'kate'] as const

export type FileEditorId = (typeof FILE_EDITOR_IDS)[number]

export type OpenFileResult = {
	editor: FileEditorId
	opened: string
	line: number | null
	column: number | null
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

function spawnDetached(bin: string, args: string[]): void {
	const proc = spawn(bin, args, {
		detached: true,
		stdio: 'ignore',
		env: process.env,
	})
	proc.unref()
}

function expandHome(filePath: string): string {
	if (filePath === '~') return os.homedir()
	if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2))
	return filePath
}

function isPositiveInt(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function gotoLocation(filePath: string, line?: number, column?: number): string {
	if (line == null) return filePath
	if (column == null) return `${filePath}:${line}`
	return `${filePath}:${line}:${column}`
}

async function resolveEditorBinary(editor: FileEditorId): Promise<string> {
	const map: Record<FileEditorId, string[]> = {
		vscode: ['code', 'code-insiders'],
		zed: ['zed'],
		sublime: ['subl', 'sublime_text'],
		kate: ['kate'],
	}
	const binary = await resolveCommand(map[editor])
	if (!binary) {
		throw new Error(
			`Could not find the ${editor} executable. Install it or add it to PATH.`,
		)
	}
	return binary
}

function editorArgs(
	editor: FileEditorId,
	filePath: string,
	line?: number,
	column?: number,
): string[] {
	if (editor === 'vscode') {
		return ['-r', '--goto', gotoLocation(filePath, line, column)]
	}
	if (editor === 'zed') {
		return [gotoLocation(filePath, line, column)]
	}
	if (editor === 'sublime') {
		return ['-a', gotoLocation(filePath, line, column)]
	}
	const args: string[] = []
	if (line != null) args.push('--line', String(line))
	if (column != null) args.push('--column', String(column))
	args.push(filePath)
	return args
}

export async function openFile(options: {
	path: string
	editor: FileEditorId
	line?: number
	column?: number
}): Promise<OpenFileResult> {
	const { editor } = options
	if (!FILE_EDITOR_IDS.includes(editor)) {
		throw new Error(`Unsupported editor: ${String(editor)}`)
	}

	if (typeof options.path !== 'string' || !options.path) {
		throw new Error('Expected an absolute path or ~/…')
	}

	const expanded = expandHome(options.path)
	if (!path.isAbsolute(expanded)) {
		throw new Error('Expected an absolute path or ~/…')
	}

	const filePath = path.resolve(expanded)
	try {
		const info = await stat(filePath)
		if (!info.isFile()) {
			throw new Error(`Path is not a file: ${filePath}`)
		}
	} catch (error) {
		if (error instanceof Error && error.message.startsWith('Path is not a file')) {
			throw error
		}
		throw new Error(`File does not exist: ${filePath}`)
	}

	if (options.line != null && !isPositiveInt(options.line)) {
		throw new Error('Expected line to be an integer >= 1')
	}
	if (options.column != null) {
		if (options.line == null) {
			throw new Error('column requires line')
		}
		if (!isPositiveInt(options.column)) {
			throw new Error('Expected column to be an integer >= 1')
		}
	}

	const line = options.line
	const column = options.column
	const binary = await resolveEditorBinary(editor)
	spawnDetached(binary, editorArgs(editor, filePath, line, column))

	return {
		editor,
		opened: filePath,
		line: line ?? null,
		column: column ?? null,
	}
}
