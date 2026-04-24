import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export async function serveUblacklistFile(filename: string): Promise<Response> {
	const filePath = join(homedir(), '.devresources', filename)
	try {
		const contents = await readFile(filePath, 'utf-8')
		return new Response(contents, {
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		})
	} catch {
		return new Response('Not found', { status: 404 })
	}
}
