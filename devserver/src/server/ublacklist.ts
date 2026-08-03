import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getDevConfig } from '#utilities/dev-config.ts'

export async function serveUblacklistFile(filename: string): Promise<Response> {
	const filePath = join((await getDevConfig()).paths.ublacklistDir, filename)
	try {
		const contents = await readFile(filePath, 'utf-8')
		return new Response(contents, {
			headers: { 'Content-Type': 'text/plain; charset=utf-8' },
		})
	} catch {
		return new Response('Not found', { status: 404 })
	}
}
