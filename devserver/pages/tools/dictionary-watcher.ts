import { html } from 'htm/preact'
import { useEffect, useState } from 'preact/hooks'
import type { PageSchemaT } from './dictionary-watcher.server.ts'
import { Fragment } from 'preact'
import { Navigation } from '#components/Navigation.ts'
import { f } from '#webframeworklib'

export function Page(a: PageSchemaT) {
	const [log, setLog] = useState('')
	const [wordList, setWordList] = useState<
		{ uniqueWords: number; wordsToProcess: { missingFiles: string[]; word: string }[] }
	>({ uniqueWords: 0, wordsToProcess: [] })

	useEffect(() => {
		if (!globalThis.ws) {
			console.info('no ws')
			return
		}

		const listener = (str: MessageEvent) => {
			console.info('ev', str)

			const message = JSON.parse(str.data)
			if (message?.type === 'dictionary-watcher-log') {
				console.log('Appending to dictionary log', message.line)
				setLog(log + message.line + '\n')
			}
		}
		globalThis.ws.addEventListener('message', listener)

		return () => globalThis.ws.removeEventListener('message', listener)
	}, [log])

	return html`
		<${Fragment}>
			<${Navigation} />
			<h1 class="mb-0 title">Dictionary Watcher</h1>
			<p class="mb-0">This tool watches and sync various dictionary files</p>
			<hr class="my-2" />
			<div class="content">
				<p>The following dictionary files are processed:</p>
				<ul>
					<li>
						<p>
							<b>cspell:</b> at
							<code>cat ~/.dotfiles/config/dictionary-kofler.txt</code>
						</p>
					</li>
					<li>
						<p>
							<b>LibreOffice:</b> at
							<!-- TODO: space -->
							<code>~/.config/libreoffice/4/user/wordbook/standard.dic</code>
						</p>
					</li>
					<li>
						<p>
							<b>Obsidian:</b> at
							<!-- TODO: space -->
							<code>?</code>
						</p>
					</li>
				</ul>
			</div>
			<h2>Watching these files:</h2>
			${
		a.fileList.map((item) => {
			return html`
				<p class="subtitle">${item.path}</p>
			`
		})
	}
			<h2 class="title is-3">Check</h2>
			<button
				class="button is-primary"
				onClick=${() => {
		f('/api/tools/dictionary-watcher/process-files').then((wordList) => {
			setWordList(wordList)
		})
	}}
			>
				Process Files
			</button>
			<table class="table">
				<thead>
					<tr>
						<th>Word</th>
						<th>Missing In</th>
					</tr>
				</thead>
				<tbody>
					${
		wordList.wordsToProcess.map(({ word, missingFiles }) =>
			html`
				<tr>
					<td>${word}</td>
					<td>${missingFiles}</td>
				</tr>
			`
		)
	}
				</tbody>
			</table>
			<h2>Log</h2>
			<pre>
${log}
</pre>
		<//>
	`
}
