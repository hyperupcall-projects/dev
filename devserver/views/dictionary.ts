import { html, raw } from 'hono/html'
import { getDictionaryWatcherPageData } from '../server/dictionary-watcher.ts'
import { getDevConfig } from '#utilities/dev-config.ts'

export async function dictionaryView() {
	const data = await getDictionaryWatcherPageData()
	const cspellPath = (await getDevConfig()).paths.dictionaryCspellDisplay

	return {
		title: 'Dictionary Manager',
		content: html`
			<div class="p-4">
				<h1 class="mb-0 title">Dictionary Manager</h1>
				<p class="mb-0">This tool watches and sync various dictionary files</p>
				<hr class="my-2" />
				<div class="content">
					<p>The following dictionary files are processed:</p>
					<ul>
						<li>
							<p>
								<b>cspell:</b>
								<code>${cspellPath}</code>
							</p>
						</li>
						<li>
							<p>
								<b>LibreOffice:</b>
								<code>~/.config/libreoffice/4/user/wordbook/standard.dic</code>
							</p>
						</li>
						<li>
							<p>
								<b>Obsidian:</b> <code>?</code>
							</p>
						</li>
					</ul>
				</div>
				<h2>Watching these files:</h2>
				${data.fileList.map((item) => html`<p class="subtitle">${item.path}</p>`)}
				<h2 class="title is-3">Check</h2>
				<button type="button" class="button is-primary" id="process-files">
					Process Files
				</button>
				<table class="table">
					<thead>
						<tr>
							<th>Word</th>
							<th>Missing In</th>
						</tr>
					</thead>
					<tbody id="word-list"></tbody>
				</table>
				<h2>Log</h2>
				<pre id="log"></pre>
			</div>
		`,
		scripts: raw(`
<script>
	(function () {
		var processBtn = document.getElementById('process-files')
		var wordList = document.getElementById('word-list')
		var logEl = document.getElementById('log')

		processBtn.addEventListener('click', async function () {
			var response = await fetch('/api/dictionary/process-files', { method: 'POST' })
			var data = await response.json()
			wordList.innerHTML = (data.wordsToProcess || []).map(function (row) {
				return '<tr><td>' + row.word + '</td><td>' + row.missingFiles.join(', ') + '</td></tr>'
			}).join('')
		})

		if (window.ws) {
			window.ws.addEventListener('message', function (event) {
				try {
					var message = JSON.parse(event.data)
					if (message && message.type === 'dictionary-watcher-log') {
						logEl.textContent += message.line + '\\n'
					}
				} catch (e) {}
			})
		}
	})()
</script>
`),
	}
}
