import { createEffect, createSignal, For, Show } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { Navigation } from '../components/Navigation'

type ScriptId = 'build' | 'generate-index' | 'create-favicons' | 'md-to-bookmarks'

const SCRIPT_CONFIG: {
	id: ScriptId
	label: string
	description: string
	icon: string
}[] = [
	{
		id: 'build',
		label: 'Build HTML',
		description: 'Convert all markdown files to HTML using pandoc',
		icon: '🔨',
	},
	{
		id: 'generate-index',
		label: 'Generate Index',
		description: 'Create index.html from the built HTML files, inlining favicons',
		icon: '📋',
	},
	{
		id: 'create-favicons',
		label: 'Generate Favicons',
		description: 'Fetch & cache favicons for all links, then produce bookmarks.html',
		icon: '🖼️',
	},
	{
		id: 'md-to-bookmarks',
		label: 'MD to Bookmarks',
		description: 'Convert markdown links to a browser-importable bookmarks HTML file',
		icon: '🔖',
	},
]

export const Route = createFileRoute('/catalogs-admin')({
	component: CatalogsAdminPage,
})

function CatalogsAdminPage() {
	const [output, setOutput] = createSignal('')
	const [running, setRunning] = createSignal<ScriptId | null>(null)
	const [runningLabel, setRunningLabel] = createSignal('')
	const [exitCode, setExitCode] = createSignal<number | null>(null)

	let outputRef: HTMLPreElement | undefined

	// Auto-scroll to bottom whenever output changes
	createEffect(() => {
		output() // reactive dependency
		queueMicrotask(() => {
			if (outputRef) {
				outputRef.scrollTop = outputRef.scrollHeight
			}
		})
	})

	const runScript = async (id: ScriptId, label: string) => {
		setOutput('')
		setExitCode(null)
		setRunning(id)
		setRunningLabel(label)

		try {
			const response = await fetch('/api/catalogs/run-script', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ script: id }),
			})

			if (!response.ok || !response.body) {
				setOutput(`HTTP ${response.status}: ${response.statusText}`)
				setRunning(null)
				return
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''

			while (true) {
				const { done, value } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })

				// SSE events are delimited by double newlines
				const events = buffer.split('\n\n')
				buffer = events.pop() ?? ''

				for (const event of events) {
					const dataLine = event.split('\n').find((l) => l.startsWith('data: '))
					if (!dataLine) continue

					try {
						const data = JSON.parse(dataLine.slice(6)) as {
							line?: string
							error?: boolean
							done?: boolean
							code?: number
						}

						if (data.done) {
							setExitCode(data.code ?? -1)
							setRunning(null)
						} else if (data.line != null) {
							// Log to browser console as well
							if (data.error) {
								console.error(`[catalog-script/${id}]`, data.line)
							} else {
								console.log(`[catalog-script/${id}]`, data.line)
							}
							setOutput((prev) => prev + data.line)
						}
					} catch {
						// ignore malformed events
					}
				}
			}
		} catch (err) {
			setOutput((prev) => `${prev}\nClient error: ${String(err)}\n`)
			setRunning(null)
		}
	}

	return (
		<>
			<Navigation />
			<div class="container p-4">
				<div class="level mb-2">
					<div class="level-left">
						<div class="level-item">
							<h1 class="title mb-0">Catalog Admin</h1>
						</div>
					</div>
					<div class="level-right">
						<div class="level-item">
							<a
								class="button is-link is-light"
								href="/catalogs"
								target="_blank"
								rel="noopener noreferrer"
							>
								🔍 Browse Catalog
							</a>
						</div>
					</div>
				</div>

				<p class="subtitle mb-5">
					Build pipeline for <code>~/Documents/Catalogs</code>
				</p>

				<div class="columns is-multiline mb-5">
					<For each={SCRIPT_CONFIG}>
						{(script) => (
							<div class="column is-half">
								<div
									class="card"
									style={
										running() === script.id
											? 'border: 2px solid #3273dc; transition: border 0.2s'
											: 'border: 2px solid transparent; transition: border 0.2s'
									}
								>
									<div class="card-content">
										<p class="title is-5">
											{script.icon} {script.label}
										</p>
										<p class="subtitle is-6 mb-3">{script.description}</p>
										<button
											class={`button is-primary${running() === script.id ? ' is-loading' : ''}`}
											disabled={running() !== null}
											onClick={() => runScript(script.id, script.label)}
										>
											Run
										</button>
									</div>
								</div>
							</div>
						)}
					</For>
				</div>

				<Show when={running() !== null || exitCode() !== null || output()}>
					<div>
						<div class="level mb-2">
							<div class="level-left" style="gap: 0.5rem">
								<h2 class="title is-4 level-item mb-0">Output</h2>
								<Show when={running() !== null}>
									<span class="tag is-warning is-medium level-item">
										⏳ Running {runningLabel()}…
									</span>
								</Show>
								<Show when={exitCode() !== null}>
									<span
										class={`tag is-medium level-item ${exitCode() === 0 ? 'is-success' : 'is-danger'}`}
									>
										{exitCode() === 0 ? '✅' : '❌'} Exit code: {exitCode()}
									</span>
								</Show>
							</div>
							<div class="level-right">
								<button
									class="button is-small is-light level-item"
									disabled={running() !== null}
									onClick={() => {
										setOutput('')
										setExitCode(null)
									}}
								>
									Clear
								</button>
							</div>
						</div>

						<pre
							ref={outputRef}
							style={{
								'max-height': '600px',
								'overflow-y': 'auto',
								background: '#1e1e1e',
								color: '#d4d4d4',
								padding: '1rem',
								'border-radius': '4px',
								'font-size': '0.82em',
								'line-height': '1.5',
								'white-space': 'pre-wrap',
								'word-break': 'break-all',
							}}
						>
							<Show
								when={output()}
								fallback={<span style="opacity: 0.4">— no output yet —</span>}
							>
								{output()}
							</Show>
						</pre>
					</div>
				</Show>
			</div>
		</>
	)
}
