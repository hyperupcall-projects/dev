import { execFile } from 'node:child_process'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { getDevConfig } from '#utilities/dev-config.ts'

const execFileAsync = promisify(execFile)

const SAFE_TXT = /^[A-Za-z0-9._-]+\.txt$/
const COMPILE_SCRIPT = 'compile-blacklist.ts'

export async function getBlocklistsDir(): Promise<string> {
	return (await getDevConfig()).paths.blocklistsDir
}

export async function listBlocklistTxtFiles(): Promise<string[]> {
	const dir = await getBlocklistsDir()
	const entries = await readdir(dir, { withFileTypes: true })
	return entries
		.filter((entry) => entry.isFile() && SAFE_TXT.test(entry.name))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b))
}

export async function serveBlocklistFile(filename: string): Promise<Response> {
	if (!SAFE_TXT.test(filename)) {
		return new Response('Not found', { status: 404 })
	}

	const dir = path.resolve(await getBlocklistsDir())
	const filePath = path.resolve(dir, filename)
	if (filePath !== dir && !filePath.startsWith(dir + path.sep)) {
		return new Response('Not found', { status: 404 })
	}

	try {
		const contents = await readFile(filePath, 'utf-8')
		return new Response(contents, {
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		})
	} catch {
		return new Response('Not found', { status: 404 })
	}
}

export async function compileBlocklists(): Promise<{
	exitCode: number
	stdout: string
	stderr: string
	command: string
	cwd: string
}> {
	const cwd = await getBlocklistsDir()
	const scriptPath = path.join(cwd, COMPILE_SCRIPT)

	try {
		await access(scriptPath)
	} catch {
		throw new Error(`Compile script not found: ${scriptPath}`)
	}

	const args = [
		'run',
		'--allow-env',
		'--allow-net',
		'--allow-read',
		'--allow-write',
		scriptPath,
	]
	const command = `deno ${args.join(' ')}`

	try {
		const { stdout, stderr } = await execFileAsync('deno', args, {
			cwd,
			encoding: 'utf8',
			maxBuffer: 20 * 1024 * 1024,
			timeout: 10 * 60 * 1000,
			env: (() => {
				const env = {
					...process.env,
					FORCE_COLOR: '1',
					CLICOLOR_FORCE: '1',
				}
				delete env.NO_COLOR
				return env
			})(),
		})
		return {
			exitCode: 0,
			stdout: stdout ?? '',
			stderr: stderr ?? '',
			command,
			cwd,
		}
	} catch (error) {
		const err = error as {
			code?: number | string
			stdout?: string
			stderr?: string
			message?: string
			killed?: boolean
		}
		if (typeof err.code === 'number' || err.stdout != null || err.stderr != null) {
			return {
				exitCode: typeof err.code === 'number' ? err.code : 1,
				stdout: err.stdout ?? '',
				stderr: err.stderr ?? err.message ?? String(error),
				command,
				cwd,
			}
		}
		throw new Error(
			`Failed to run compile script: ${
				error instanceof Error ? error.message : String(error)
			}`,
		)
	}
}
