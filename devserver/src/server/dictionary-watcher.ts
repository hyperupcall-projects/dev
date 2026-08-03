import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { getDevConfig } from '#utilities/dev-config.ts'

function getDictionaryFiles(): Promise<string[]> {
	return getDevConfig().then((config) => [
		config.paths.dictionaryDotfiles,
		path.join(
			(process.env.XDG_CONFIG_HOME ?? '').startsWith('/')
				? (process.env.XDG_CONFIG_HOME ?? '')
				: path.join(os.homedir(), '.config'),
			'libreoffice/4/user/wordbook/standard.dic',
		),
	])
}

export async function getDictionaryWatcherPageData() {
	const fileList: { path: string; lastAccessed: string }[] = []
	for (const file of await getDictionaryFiles()) {
		try {
			fileList.push({
				path: file,
				lastAccessed: (await fs.stat(file)).mtime.toTimeString(),
			})
		} catch {
			fileList.push({
				path: file,
				lastAccessed: 'missing',
			})
		}
	}
	return { fileList }
}

export async function processDictionaryFiles() {
	const allWords: Set<string> = new Set()
	const dictionaries: { filepath: string; words: Set<string> }[] = []
	for (const dictionaryFile of await getDictionaryFiles()) {
		const set: Set<string> = new Set()

		try {
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
		} catch {
			// Skip missing or unreadable dictionary files.
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

	return { uniqueWords: allWords.size, wordsToProcess }
}

async function parseTextFile(filename: string) {
	const content = await fs.readFile(filename, 'utf-8')
	return {
		words: content.split('\n').filter((word) => word !== ''),
	}
}

async function parseDicFile(filename: string) {
	const content = await fs.readFile(filename, 'utf-8')
	const words = content.slice(content.indexOf('---\n') + '---\n'.length)
	return {
		words: words.split('\n').filter((word) => word !== ''),
	}
}
