import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const staticDir = join(process.cwd(), 'static')

export async function serveStaticFile(
	filename: string,
	contentType: string,
): Promise<Response> {
	try {
		const contents = await readFile(join(staticDir, filename))
		return new Response(contents, {
			headers: { 'Content-Type': contentType },
		})
	} catch {
		return new Response('Not found', { status: 404 })
	}
}
