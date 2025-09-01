import path from 'node:path'
import * as v from 'valibot'
import chokidar from 'chokidar'
import os from 'node:os'
import fs from 'node:fs/promises'
import type { Express } from 'express'
import type { WebSocketServer } from 'ws'

export type PageSchemaT = v.InferInput<typeof PageSchema>
export const PageSchema = v.strictObject({
	fileList: v.array(v.strictObject({ path: v.string(), lastAccessed: v.string() })),
})

const dictionaryFiles = [
	path.join(os.homedir(), '.dotfiles/config/dictionary-hyperupcall.txt'),
	path.join(
		(Deno.env.get('XDG_CONFIG_HOME') ?? '').startsWith('/')
			? (Deno.env.get('XDG_CONFIG_HOME') ?? '')
			: path.join(os.homedir(), '.config'),
		'libreoffice/4/user/wordbook/standard.dic',
	),
]

export async function PageData(): Promise<PageSchemaT> {
	const list: PageSchemaT['fileList'] = []
	for (const file of dictionaryFiles) {
		list.push({
			path: file,
			lastAccessed: (await fs.stat(file)).mtime.toTimeString(),
		})
	}

	return {
		fileList: list,
	}
}

export function Api(app: Express, wss: WebSocketServer) {
	app.post('/api/tools/dictionary-watcher/process-files', async (req, res) => {
		const allWords: Set<string> = new Set()
		const dictionaries: { filepath: string; words: Set<string> }[] = []
		for (const dictionaryFile of dictionaryFiles) {
			const set: Set<string> = new Set()
			console.log(dictionaryFile)

			if (dictionaryFile.endsWith('.txt')) {
				const result = await parseTextFile(dictionaryFile)
				for (const word of result.words) {
					set.add(word)
					allWords.add(word)
				}
			} else if (dictionaryFile.endsWith('.dic')) {
				const result = await parseDicFile(dictionaryFile)
				for (const word of result.words) {
					set.add(word)
					allWords.add(word)
				}
			}

			dictionaries.push({
				filepath: dictionaryFile,
				words: set,
			})
		}

		const wordsToProcess: { missingFiles: string[]; word: string }[] = []
		for (const word of allWords) {
			const filesMissingWord: string[] = []
			for (const dictionary of dictionaries) {
				if (!dictionary.words.has(word)) {
					filesMissingWord.push(dictionary.filepath)
				}
			}

			if (filesMissingWord.length > 0) {
				wordsToProcess.push({
					missingFiles: filesMissingWord,
					word,
				})
			}
		}

		res.json({ uniqueWords: allWords.size, wordsToProcess })

		async function parseTextFile(filename: string) {
			const content = await fs.readFile(filename, 'utf-8')
			return {
				words: content.split('\n').filter((word) => word !== ''),
			}
		}

		async function parseDicFile(filename: string) {
			const content = await fs.readFile(filename, 'utf-8')
			const frontmatter = content.slice(0, content.indexOf('\n---'))
			const words = content.slice(content.indexOf('---\n') + '---\n'.length)
			return {
				frontmatter,
				words: words.split('\n').filter((word) => word !== ''),
			}
		}
	})

	wss.once('connection', (ws) => {
		ws.on('error', console.error)
		ws.on('message', function message(data) {
			console.log('received: %s', data)
		})

		const watcher = chokidar.watch(dictionaryFiles, { persistent: false })
		watcher.on('error', console.error)
		watcher.on('change', (path) => {
			ws.send(
				JSON.stringify({
					type: 'dictionary-watcher-log',
					line: `Event "${'change'}" from file "${path}"`,
				}),
			)
			syncDictionaries()
		})

		function syncDictionaries() {
			console.info('sync')
		}

		ws.send('something')
	})
}
