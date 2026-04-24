import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

// Resolve catalogs directory (supports ~ expansion)
const rawCatalogsDir = process.env.CATALOGS_DIR ?? '~/Documents/Catalogs'
const CATALOGS_DIR = rawCatalogsDir.startsWith('~')
	? path.join(os.homedir(), rawCatalogsDir.slice(1))
	: rawCatalogsDir

// Scripts live alongside the devserver package (cwd = devserver/ at runtime)
const SCRIPTS_DIR = path.resolve(process.cwd(), 'catalog-scripts')

/** Strip ANSI escape codes so the terminal output is clean plain text */
const stripAnsi = (str: string) =>
	str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')

export type ScriptId =
	| 'build'
	| 'generate-index'
	| 'create-favicons'
	| 'md-to-bookmarks'

type ScriptConfig = {
	cmd: string
	args: string[]
	label: string
	description: string
	icon: string
}

export const CATALOG_SCRIPTS: Record<ScriptId, ScriptConfig> = {
	build: {
		cmd: 'bash',
		args: [path.join(SCRIPTS_DIR, 'build.sh')],
		label: 'Build HTML',
		description: 'Convert markdown files to HTML with pandoc',
		icon: '🔨',
	},
	'generate-index': {
		cmd: 'node',
		args: [path.join(SCRIPTS_DIR, 'generate-index.js')],
		label: 'Generate Index',
		description: 'Create index.html from built HTML files with inlined favicons',
		icon: '📋',
	},
	'create-favicons': {
		cmd: 'node',
		args: [path.join(SCRIPTS_DIR, 'create-favicons.js')],
		label: 'Generate Favicons',
		description: 'Fetch & cache favicons for all links, then produce bookmarks.html',
		icon: '🖼️',
	},
	'md-to-bookmarks': {
		cmd: 'node',
		args: [path.join(SCRIPTS_DIR, 'md_to_bookmarks.js')],
		label: 'MD to Bookmarks',
		description: 'Convert markdown links to a browser-importable bookmarks HTML file',
		icon: '🔖',
	},
}

/**
 * Spawns the given catalog script and returns an SSE `Response` that streams
 * stdout/stderr in real-time.  Every chunk is also written to the Node.js
 * process stdout/stderr so it appears in the server console.
 *
 * SSE event shape:
 *   { line: string; error: boolean }   – a chunk of output
 *   { done: true; code: number }       – process exited
 */
export function runCatalogScript(scriptId: ScriptId): Response {
	const config = CATALOG_SCRIPTS[scriptId]

	if (!config) {
		return new Response(
			JSON.stringify({ error: `Unknown script: ${scriptId}` }),
			{ status: 400, headers: { 'Content-Type': 'application/json' } },
		)
	}

	console.log(
		`[catalog-scripts] Starting: ${config.cmd} ${config.args.join(' ')}`,
	)
	console.log(`[catalog-scripts] CWD: ${CATALOGS_DIR}`)

	const encoder = new TextEncoder()

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const proc = spawn(config.cmd, config.args, {
				cwd: CATALOGS_DIR,
				shell: false,
				// Disable colour output so ANSI fallback regex has less work to do
				env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
			})

			const emit = (raw: string, isStderr = false) => {
				const line = stripAnsi(raw)

				// Log to Node.js console
				if (isStderr) {
					process.stderr.write(`[catalog-scripts] ${line}`)
				} else {
					process.stdout.write(`[catalog-scripts] ${line}`)
				}

				// Send SSE event to the client
				const event = `data: ${JSON.stringify({ line, error: isStderr })}\n\n`
				controller.enqueue(encoder.encode(event))
			}

			proc.stdout.on('data', (chunk: Buffer) => emit(chunk.toString()))
			proc.stderr.on('data', (chunk: Buffer) => emit(chunk.toString(), true))

			proc.on('close', (code: number | null) => {
				const exitCode = code ?? -1
				console.log(`[catalog-scripts] Process exited with code ${exitCode}`)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ done: true, code: exitCode })}\n\n`,
					),
				)
				controller.close()
			})

			proc.on('error', (err: Error) => {
				console.error(`[catalog-scripts] Spawn error: ${err.message}`)
				emit(`Spawn error: ${err.message}\n`, true)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ done: true, code: -1 })}\n\n`,
					),
				)
				controller.close()
			})
		},
	})

	return new Response(stream, {
		status: 200,
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-store',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	})
}
