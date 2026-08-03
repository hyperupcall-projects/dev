import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Dirent } from 'node:fs'
import { promisify, styleText } from 'node:util'
import * as jsonc from 'jsonc-parser'
import { getDevConfig } from '#utilities/dev-config.ts'

const execFileAsync = promisify(execFile)

async function getServiceListDir(): Promise<string> {
	return (await getDevConfig()).paths.serviceListDir
}
const USER_UNIT_DIRS = [
	path.join(os.homedir(), '.config', 'systemd', 'user'),
	path.join(os.homedir(), '.local', 'share', 'systemd', 'user'),
]
const WANTS_DIR = path.join(os.homedir(), '.config', 'systemd', 'user', 'default.target.wants')

export type ServiceInfo = {
	name: string
	unit: string
	unitPath: string | null
	unitIsSymlink: boolean
	symlinkStatus: 'enabled' | 'disabled' | 'unknown'
	symlinkTarget: string | null
	port: string | null
	isActive: boolean
	activeState: string
}

type RunnerParam = {
	orgDir: string
	orgEntry: Dirent
	repoDir: string
	repoEntry: Dirent
}

type RunnerOptions = {
	ignores?: string[]
}

export async function forEachRepository(
	organizationsDir: string,
	options: RunnerOptions,
	fn: (arg0: RunnerParam) => Promise<void>,
) {
	if (typeof options === 'function') {
		fn = options
		options = {}
	}

	for (const orgEntry of await fs.readdir(organizationsDir, {
		withFileTypes: true,
	})) {
		const orgDir = path.join(orgEntry.parentPath, orgEntry.name)
		if (!orgEntry.isDirectory()) {
			continue
		}

		for (const repoEntry of await fs.readdir(orgDir, {
			withFileTypes: true,
		})) {
			const repoDir = path.join(repoEntry.parentPath, repoEntry.name)
			if (!repoEntry.isDirectory()) {
				continue
			}

			if (Array.isArray(options.ignores)) {
				const shouldSkip = options.ignores.some((ignoreEntry) => {
					if (ignoreEntry === orgEntry.name) {
						return true
					}

					if (ignoreEntry === `${orgEntry.name}/${repoEntry.name}`) {
						return true
					}

					return false
				})

				if (shouldSkip) {
					continue
				}
			}

			await fn({ orgDir, orgEntry, repoDir, repoEntry })
		}
	}
}

async function listRegisteredServices(): Promise<string[]> {
	try {
		const entries = await fs.readdir(await getServiceListDir(), { withFileTypes: true })
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith('.ini'))
			.map((entry) => entry.name.slice(0, -'.ini'.length))
			.sort((a, b) => a.localeCompare(b))
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
		throw error
	}
}

function normalizeServiceName(service: string): string {
	return service.endsWith('.service') ? service.slice(0, -'.service'.length) : service
}

async function resolveUnitPath(unit: string): Promise<string | null> {
	try {
		const { stdout } = await execFileAsync('systemctl', [
			'--user',
			'show',
			unit,
			'--property=FragmentPath',
			'--value',
		])
		const fragmentPath = stdout.trim()
		if (fragmentPath) return fragmentPath
	} catch {
		// fall through to filesystem lookup
	}

	for (const dir of USER_UNIT_DIRS) {
		const candidate = path.join(dir, unit)
		try {
			await fs.access(candidate)
			return candidate
		} catch {
			continue
		}
	}
	return null
}

async function resolveSymlinkStatus(
	unit: string,
): Promise<{ status: ServiceInfo['symlinkStatus']; target: string | null }> {
	try {
		const { stdout } = await execFileAsync('systemctl', [
			'--user',
			'is-enabled',
			unit,
		])
		const state = stdout.trim()
		if (state === 'enabled') {
			const wantsLink = path.join(WANTS_DIR, unit)
			try {
				const target = await fs.readlink(wantsLink)
				return { status: 'enabled', target }
			} catch {
				return { status: 'enabled', target: null }
			}
		}
		if (state === 'disabled' || state === 'static' || state === 'masked') {
			return { status: 'disabled', target: null }
		}
	} catch {
		// fall through to filesystem check
	}

	const wantsLink = path.join(WANTS_DIR, unit)
	try {
		const target = await fs.readlink(wantsLink)
		return { status: 'enabled', target }
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return { status: 'disabled', target: null }
		}
		try {
			await fs.lstat(wantsLink)
			return { status: 'enabled', target: null }
		} catch {
			return { status: 'unknown', target: null }
		}
	}
}

const PORT_ENV_RE = /^\s*Environment=(?:'|")?PORT=(\d+)(?:'|")?\s*$/m

async function parsePortFromUnit(unitPath: string | null): Promise<string | null> {
	if (!unitPath) return null
	try {
		const content = await fs.readFile(unitPath, 'utf8')
		return content.match(PORT_ENV_RE)?.[1] ?? null
	} catch {
		return null
	}
}

async function unitPathIsSymlink(unitPath: string | null): Promise<boolean> {
	if (!unitPath) return false
	try {
		const stat = await fs.lstat(unitPath)
		return stat.isSymbolicLink()
	} catch {
		return false
	}
}

export async function getServiceData(): Promise<ServiceInfo[]> {
	const names = await listRegisteredServices()

	return Promise.all(
		names.map(async (name) => {
			const unit = `${name}.service`
			const [unitPath, symlink, isActive, activeState] = await Promise.all([
				resolveUnitPath(unit),
				resolveSymlinkStatus(unit),
				execFileAsync('systemctl', ['--user', 'is-active', '--quiet', unit])
					.then(() => true)
					.catch(() => false),
				execFileAsync('systemctl', [
					'--user',
					'show',
					unit,
					'--property=ActiveState',
					'--value',
				])
					.then(({ stdout }) => stdout.trim() || 'unknown')
					.catch(() => 'unknown'),
			])
			const [port, unitIsSymlink] = await Promise.all([
				parsePortFromUnit(unitPath),
				unitPathIsSymlink(unitPath),
			])

			return {
				name,
				unit,
				unitPath,
				unitIsSymlink,
				symlinkStatus: symlink.status,
				symlinkTarget: symlink.target,
				port,
				isActive,
				activeState,
			}
		}),
	)
}

export async function updateServicePort(
	service: string,
	port: string,
): Promise<ServiceInfo> {
	const name = normalizeServiceName(service)
	const registered = await listRegisteredServices()
	if (!registered.includes(name)) {
		throw new Error(`Unknown service: ${service}`)
	}
	if (!/^\d+$/.test(port)) {
		throw new Error(`Invalid port: ${port}`)
	}

	const unit = `${name}.service`
	const unitPath = await resolveUnitPath(unit)
	if (!unitPath) {
		throw new Error(`Unit file not found for ${name}`)
	}

	const stat = await fs.lstat(unitPath)
	if (!stat.isSymbolicLink()) {
		throw new Error(`Unit file is not a symlink: ${unitPath}`)
	}

	const content = await fs.readFile(unitPath, 'utf8')
	if (!PORT_ENV_RE.test(content)) {
		throw new Error(`No Environment=PORT= line in ${unitPath}`)
	}
	const updated = content.replace(PORT_ENV_RE, `Environment=PORT=${port}`)
	await fs.writeFile(unitPath, updated, 'utf8')

	try {
		await execFileAsync('systemctl', ['--user', 'daemon-reload'])
	} catch {
		// best-effort; file is already updated
	}

	const services = await getServiceData()
	const result = services.find((s) => s.name === name)
	if (!result) throw new Error(`Service not found after port update: ${name}`)
	return result
}

export async function controlService(
	service: string,
	action: 'start' | 'stop' | 'enable' | 'disable',
): Promise<ServiceInfo> {
	const name = normalizeServiceName(service)
	const registered = await listRegisteredServices()
	if (!registered.includes(name)) {
		throw new Error(`Unknown service: ${service}`)
	}
	const unit = `${name}.service`
	await execFileAsync('systemctl', ['--user', action, unit])
	const services = await getServiceData()
	const updated = services.find((s) => s.name === name)
	if (!updated) throw new Error(`Service not found after ${action}: ${name}`)
	return updated
}

export async function launchServiceTerminal(
	service: string,
	action: 'status' | 'journal',
): Promise<{ terminal: string }> {
	const unit = `${normalizeServiceName(service)}.service`
	const cmd =
		action === 'status'
			? `systemctl --user status ${unit}; echo; read -p 'Press Enter to close...'`
			: `journalctl --user -f -u ${unit}`

	const terminals = [
		{ bin: 'kitty', args: ['bash', '-c', cmd] },
		{ bin: 'alacritty', args: ['-e', 'bash', '-c', cmd] },
		{ bin: 'foot', args: ['bash', '-c', cmd] },
		{ bin: 'gnome-terminal', args: ['--', 'bash', '-c', cmd] },
		{ bin: 'xterm', args: ['-e', 'bash', '-c', cmd] },
	]

	for (const { bin, args } of terminals) {
		try {
			await execFileAsync('which', [bin])
			const proc = spawn(bin, args, { detached: true, stdio: 'ignore' })
			proc.unref()
			return { terminal: bin }
		} catch {
			continue
		}
	}

	throw new Error(
		'No terminal emulator found. Please install kitty, alacritty, foot, gnome-terminal, or xterm.',
	)
}

export async function mergeYAML(file1: string, file2: string): Promise<string> {
	const { stdout } = await execFileAsync('yq', [
		'eval-all',
		'. as $item ireduce ({}; . * $item)',
		file1,
		file2,
	])
	return stdout
}

export async function mergeTOML(file1: string, file2: string): Promise<string> {
	const mergetomlPy = path.join(import.meta.dirname, 'mergetoml.py')
	const { stdout } = await execFileAsync('uv', ['run', mergetomlPy, file1, file2])
	return stdout
}

export function mergeJSONWithComments(
	originalText: string,
	ast: any,
	newSettings: Record<string, any>,
): string {
	const replacements: Array<{ key: string; oldValue: any; newValue: any }> = []
	const arrayMerges: Array<{ key: string; added: any[] }> = []
	const additions: Array<{ key: string }> = []

	function deepEquals(a: any, b: any): boolean {
		if (a === b) return true
		if (a == null || b == null) return false
		if (typeof a !== typeof b) return false

		if (Array.isArray(a) && Array.isArray(b)) {
			if (a.length !== b.length) return false
			return a.every((val, idx) => deepEquals(val, b[idx]))
		}

		if (typeof a === 'object' && typeof b === 'object') {
			const keysA = Object.keys(a)
			const keysB = Object.keys(b)
			if (keysA.length !== keysB.length) return false
			return keysA.every((key) => deepEquals(a[key], b[key]))
		}

		return false
	}

	const existingJson =
		ast.type === 'JSONObjectExpression' ? jsonASTToValue(ast) : {}

	function deepMerge(
		newObj: Record<string, any>,
		existingObj: any,
		pathPrefix: string[] = [],
	): any {
		const result: Record<string, any> = { ...existingObj }

		for (const [key, newValue] of Object.entries(newObj)) {
			const path = [...pathPrefix, key]
			const pathStr = path.join('.')
			const existingValue = existingObj?.[key]

			if (existingValue === undefined) {
				result[key] = newValue
				additions.push({ key: pathStr })
			} else if (Array.isArray(newValue) && Array.isArray(existingValue)) {
				const elementsToAdd: any[] = []
				for (const newElement of newValue) {
					const exists = existingValue.some((existingElement) =>
						deepEquals(newElement, existingElement),
					)
					if (!exists) {
						elementsToAdd.push(newElement)
					}
				}

				if (elementsToAdd.length > 0) {
					result[key] = [...existingValue, ...elementsToAdd]
					arrayMerges.push({ key: pathStr, added: elementsToAdd })
				}
			} else if (
				typeof newValue === 'object' &&
				newValue !== null &&
				!Array.isArray(newValue) &&
				typeof existingValue === 'object' &&
				existingValue !== null &&
				!Array.isArray(existingValue)
			) {
				result[key] = deepMerge(newValue, existingValue, path)
			} else {
				result[key] = newValue
				replacements.push({
					key: pathStr,
					oldValue: existingValue,
					newValue,
				})
			}
		}

		return result
	}

	const mergedJson = deepMerge(newSettings, existingJson)

	for (const { key } of additions) {
		// console.info(`  ${styleText('green', 'ADD')} ${key}`)
	}
	for (const { key, oldValue, newValue } of replacements) {
		// console.info(
		// 	`  ${styleText('yellow', 'REPLACE')} ${key}: ${JSON.stringify(oldValue)} → ${JSON.stringify(
		// 		newValue,
		// 	)}`,
		// )
	}
	for (const { key, added } of arrayMerges) {
		// console.info(
		// 	`  ${styleText('cyan', 'MERGE')} ${key}: added ${added.length} new element(s): ${JSON.stringify(
		// 		added,
		// 	)}`,
		// )
	}

	let output = originalText

	for (const [key, value] of Object.entries(mergedJson)) {
		const edits = jsonc.modify(output, [key], value, {
			formattingOptions: { tabSize: 1, insertSpaces: false },
		})
		output = jsonc.applyEdits(output, edits)
	}

	return output
}

export function overrideFile() {

}

function jsonASTToValue(node: any): any {
	if (!node) return undefined

	switch (node.type) {
		case 'JSONObjectExpression': {
			const obj: Record<string, any> = {}
			if (node.properties) {
				for (const prop of node.properties) {
					if (prop.key?.type === 'JSONLiteral') {
						obj[prop.key.value] = jsonASTToValue(prop.value)
					}
				}
			}
			return obj
		}
		case 'JSONArrayExpression':
			return node.elements ? node.elements.map(jsonASTToValue) : []

		case 'JSONLiteral':
			return node.value

		case 'JSONIdentifier':
			return node.name === 'true'
				? true
				: node.name === 'false'
					? false
					: null

		default:
			return undefined
	}
}
