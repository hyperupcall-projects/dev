import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { createSignal } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import { Navigation } from '../../components/Navigation'
import { getDictionaryWatcherPageData } from '../../server/dictionary-watcher'

const getDictionaryData = createServerFn({ method: 'GET' }).handler(async () => {
	return getDictionaryWatcherPageData()
})

type ProcessResponse = {
	uniqueWords: number
	wordsToProcess: { missingFiles: string[]; word: string }[]
}

export const Route = createFileRoute('/tools/dictionary-watcher')({
	component: DictionaryWatcherPage,
	loader: () => getDictionaryData(),
})

function DictionaryWatcherPage() {
	const data = Route.useLoaderData()
	const [log, setLog] = createSignal('')
	const [wordList, setWordList] = createSignal<ProcessResponse>({
		uniqueWords: 0,
		wordsToProcess: [],
	})

	onMount(() => {
		const ws = (globalThis as typeof globalThis & { ws?: WebSocket }).ws
		if (!ws) {
			return
		}

		const listener = (event: MessageEvent) => {
			try {
				const message = JSON.parse(event.data)
				if (message?.type === 'dictionary-watcher-log') {
					setLog((value) => `${value}${message.line}\n`)
				}
			} catch {
				// Ignore malformed messages from unrelated channels.
			}
		}

		ws.addEventListener('message', listener)
		onCleanup(() => ws.removeEventListener('message', listener))
	})

	return (
		<>
			<Navigation />
			<h1 class="mb-0 title">Dictionary Watcher</h1>
			<p class="mb-0">This tool watches and sync various dictionary files</p>
			<hr class="my-2" />
			<div class="content">
				<p>The following dictionary files are processed:</p>
				<ul>
					<li>
						<p><b>cspell:</b> <code>~/.dotfiles/config/dictionary-kofler.txt</code></p>
					</li>
					<li>
						<p><b>LibreOffice:</b> <code>~/.config/libreoffice/4/user/wordbook/standard.dic</code></p>
					</li>
					<li>
						<p><b>Obsidian:</b> <code>?</code></p>
					</li>
				</ul>
			</div>
			<h2>Watching these files:</h2>
			{data().fileList.map((item) => <p class="subtitle">{item.path}</p>)}
			<h2 class="title is-3">Check</h2>
			<button
				class="button is-primary"
				onClick={async () => {
					const response = await fetch('/api/tools/dictionary-watcher/process-files', { method: 'POST' })
					setWordList(await response.json())
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
					{wordList().wordsToProcess.map(({ word, missingFiles }) => (
						<tr>
							<td>{word}</td>
							<td>{missingFiles.join(', ')}</td>
						</tr>
					))}
				</tbody>
			</table>
			<h2>Log</h2>
			<pre>{log()}</pre>
		</>
	)
}
