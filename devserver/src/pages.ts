import { getDictionaryWatcherPageData } from './server/dictionary-watcher.ts'
import { html, raw } from './html.ts'
import { page } from './layout.ts'
import { getServiceData } from '#utilities/util.ts'
import { getDevConfig } from '#utilities/dev-config.ts'

export { activityManagerPage } from './activity-manager-page.ts'
export { projectManagerPage } from './project-manager-page.ts'
export { knowledgeManagerPage } from './knowledge-manager-page.ts'
export { blocklistsPage } from './blocklists-page.ts'

export async function servicesPage(): Promise<Response> {
	const services = await getServiceData()

	return page({
		title: 'Service Manager',
		body: html`
			<div class="p-4">
				<h1 class="title mb-1">Service Manager</h1>
				<p class="subtitle is-6 mb-4">User-level systemd services</p>
				<table class="table is-fullwidth is-striped is-hoverable">
					<thead>
						<tr>
							<th>Name</th>
							<th>Unit file</th>
							<th>Enabled</th>
							<th>Port</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						${services.map(
							(service) => html`
								<tr>
									<td style="vertical-align: middle;">
										<code>${service.name}</code>
									</td>
									<td style="vertical-align: middle;">
										${service.unitPath
											? html`<code style="word-break: break-all;">${service.unitPath}</code>`
											: html`<span class="has-text-grey">missing</span>`}
									</td>
									<td style="vertical-align: middle;">
										<span
											class=${`tag is-light js-enabled ${
												service.symlinkStatus === 'enabled'
													? 'is-success'
													: service.symlinkStatus === 'disabled'
														? 'is-warning'
														: ''
											}`}
											data-service=${service.name}
											title=${service.symlinkTarget}
										>
											${service.symlinkStatus}
										</span>
									</td>
									<td style="vertical-align: middle;">
										${service.port
											? service.unitIsSymlink
												? html`<button
														type="button"
														class="button is-ghost is-small p-0 js-edit-port"
														data-service=${service.name}
														data-port=${service.port}
														title="Edit port"
														style="height: auto; text-decoration: underline; vertical-align: baseline;"
													>
														<code>${service.port}</code>
													</button>`
												: html`<code>${service.port}</code>`
											: html`<span class="has-text-grey">—</span>`}
									</td>
									<td style="vertical-align: middle;">
										<span
											class=${`tag is-medium js-status ${service.isActive ? 'is-success' : 'is-danger'}`}
											data-service=${service.name}
										>
											${service.activeState}
										</span>
									</td>
									<td style="vertical-align: middle;">
										<div class="buttons are-small mb-0" data-service=${service.name}>
											<button
												type="button"
												class="button js-service-control"
												data-action="start"
												disabled=${service.isActive}
											>
												Start
											</button>
											<button
												type="button"
												class="button js-service-control"
												data-action="stop"
												disabled=${!service.isActive}
											>
												Stop
											</button>
											<button
												type="button"
												class="button js-service-control"
												data-action="restart"
											>
												Restart
											</button>
											<button
												type="button"
												class="button js-service-control"
												data-action="enable"
												disabled=${service.symlinkStatus === 'enabled'}
											>
												Enable
											</button>
											<button
												type="button"
												class="button js-service-control"
												data-action="disable"
												disabled=${service.symlinkStatus !== 'enabled'}
											>
												Disable
											</button>
											<div class="dropdown" data-service=${service.name}>
												<div class="dropdown-trigger">
													<button
														type="button"
														class="button is-small js-dropdown-toggle"
														aria-haspopup="true"
													>
														<span>More</span>
														<span class="icon is-small" aria-hidden="true">▾</span>
													</button>
												</div>
												<div class="dropdown-menu" role="menu">
													<div class="dropdown-content">
														<button
															type="button"
															class="dropdown-item button is-ghost has-text-left js-launch"
															data-action="status"
															style="width: 100%; justify-content: flex-start; border: none; box-shadow: none;"
														>
															<span class="icon is-small mr-1">🖥</span>
															Status in Terminal
														</button>
														<button
															type="button"
															class="dropdown-item button is-ghost has-text-left js-launch"
															data-action="journal"
															style="width: 100%; justify-content: flex-start; border: none; box-shadow: none;"
														>
															<span class="icon is-small mr-1">📋</span>
															Journal (follow)
														</button>
													</div>
												</div>
											</div>
										</div>
									</td>
								</tr>
							`,
						)}
					</tbody>
				</table>
			</div>
		`,
		scripts: raw(`
<script>
	(function () {
		function updateServiceRow(data) {
			var service = data.name
			var status = document.querySelector('.js-status[data-service="' + service + '"]')
			if (status) {
				status.textContent = data.activeState
				status.classList.toggle('is-success', data.isActive)
				status.classList.toggle('is-danger', !data.isActive)
			}
			var enabled = document.querySelector('.js-enabled[data-service="' + service + '"]')
			if (enabled) {
				enabled.textContent = data.symlinkStatus
				enabled.title = data.symlinkTarget || ''
				enabled.classList.toggle('is-success', data.symlinkStatus === 'enabled')
				enabled.classList.toggle('is-warning', data.symlinkStatus === 'disabled')
			}
			var wrap = document.querySelector('.buttons[data-service="' + service + '"]')
			if (!wrap) return
			var startBtn = wrap.querySelector('.js-service-control[data-action="start"]')
			var stopBtn = wrap.querySelector('.js-service-control[data-action="stop"]')
			var enableBtn = wrap.querySelector('.js-service-control[data-action="enable"]')
			var disableBtn = wrap.querySelector('.js-service-control[data-action="disable"]')
			if (startBtn) startBtn.disabled = data.isActive
			if (stopBtn) stopBtn.disabled = !data.isActive
			if (enableBtn) enableBtn.disabled = data.symlinkStatus === 'enabled'
			if (disableBtn) disableBtn.disabled = data.symlinkStatus !== 'enabled'
		}

		document.addEventListener('click', function (event) {
			var target = event.target
			if (!(target instanceof Element)) return

			var toggle = target.closest('.js-dropdown-toggle')
			if (toggle) {
				event.stopPropagation()
				var dropdown = toggle.closest('.dropdown')
				document.querySelectorAll('.dropdown.is-active').forEach(function (el) {
					if (el !== dropdown) el.classList.remove('is-active')
				})
				if (dropdown) dropdown.classList.toggle('is-active')
				return
			}

			var control = target.closest('.js-service-control')
			if (control) {
				var buttons = control.closest('.buttons')
				var service = buttons && buttons.getAttribute('data-service')
				var action = control.getAttribute('data-action')
				var allowed = { start: 1, stop: 1, restart: 1, enable: 1, disable: 1 }
				if (!service || !action || !allowed[action]) return
				control.classList.add('is-loading')
				fetch('/api/services/control', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ service: service, action: action }),
				}).then(function (response) {
					return response.json().then(function (data) {
						if (!response.ok) {
							throw new Error((data && data.error) || response.statusText)
						}
						updateServiceRow(data)
					})
				}).catch(function (err) {
					alert('Failed to ' + action + ' service: ' + (err && err.message ? err.message : String(err)))
				}).finally(function () {
					control.classList.remove('is-loading')
				})
				return
			}

			var editPort = target.closest('.js-edit-port')
			if (editPort) {
				var service = editPort.getAttribute('data-service')
				var currentPort = editPort.getAttribute('data-port') || ''
				if (!service) return
				var nextPort = window.prompt('Enter new port for ' + service + ':', currentPort)
				if (nextPort == null) return
				nextPort = String(nextPort).trim()
				if (!nextPort || nextPort === currentPort) return
				if (!/^\\d+$/.test(nextPort)) {
					alert('Port must be a number')
					return
				}
				if (!window.confirm('Set ' + service + ' port to ' + nextPort + '?')) return
				fetch('/api/services/port', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ service: service, port: nextPort }),
				}).then(function (response) {
					return response.json().then(function (data) {
						if (!response.ok) {
							throw new Error((data && data.error) || response.statusText)
						}
						editPort.setAttribute('data-port', data.port || nextPort)
						var code = editPort.querySelector('code')
						if (code) code.textContent = data.port || nextPort
					})
				}).catch(function (err) {
					alert('Failed to update port: ' + (err && err.message ? err.message : String(err)))
				})
				return
			}

			var launch = target.closest('.js-launch')
			if (launch) {
				var wrap = launch.closest('.dropdown')
				var service = wrap && wrap.getAttribute('data-service')
				var action = launch.getAttribute('data-action')
				if (wrap) wrap.classList.remove('is-active')
				if (!service || !action) return
				fetch('/api/services/launch-terminal', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ service: service, action: action }),
				}).then(function (response) {
					if (!response.ok) {
						return response.text().then(function (text) {
							throw new Error(text || response.statusText)
						})
					}
				}).catch(function (err) {
					alert('Failed to launch terminal: ' + (err && err.message ? err.message : String(err)))
				})
				return
			}

			document.querySelectorAll('.dropdown.is-active').forEach(function (el) {
				el.classList.remove('is-active')
			})
		})
	})()
</script>
`),
	})
}

export async function computerPage(): Promise<Response> {
	return page({
		title: 'Computer',
		body: html`
			<div class="content p-4">
				<h1>Computer</h1>
				<p>
					Information about how this computer is organized.
				</p>
				<h2>Volumes</h2>
				<p>There are a few main volumes:</p>
				<ul>
					<li><b>Root</b> - <tt>/</tt></li>
					<li><b>Extras</b> - Includes XDG user directories like <tt>Documents/</tt>.</li>
					<li><b>Vault</b> - Includes everything else, including very large files.</li>
				</ul>
				<h2>Home Folder</h2>
				<p>
					Has the usual stuff, including:
				</p>
				<ul>
					<li><b><tt>.dotfiles</tt></b> - Configuration files.</li>
					<li><b><tt>.dev</tt></b> - Programs to help me manage the computer.</li>
					<li><b><tt>.devhidden</tt></b> - Like <tt>.dev</tt>, but not version controlled.</li>
					<li><b><tt>.devtest</tt></b> - Testing ground.</li>
				</ul>

				<h2>Documents Folder</h2>
				<p>For each one, there may be an "archive"</p>
				<ul>
					<li><b>Knowledge</b> - Knowledge and information that I want to write down.</li>
					<li><b>Projects</b> - "Regular" projects and computing projects.</li>
					<li><b>Content</b> - Content like books, papers, specifications, movies, TV shows</li>
				</ul>

				<h3>Knowledge</h3>
				<ul>
					<li><b>Personal Knowledge</b> - Only applies to me.
						<ul>
							<li>Personal & Life</li>
							<li>Records</li>
						</ul>
					</li>
					<li><b>World Knowledge</b> - About the world, useful to everyone.
						<ul>
							<li><b>Catalogs</b> - Resources in an "awesome"-style list. Simply lists of links with minimal description.</li>
							<li><b>Concepts</b> - Sort of a glossary reference. Sort of WIP.</li>
							<li><b>Literature</b> - Notes when reading books, watching movies, etc. Maybe put "non-school course" stuff here?</li>
							<li><b>Education</b> - School or course related organizations</li>
						</ul>
					</li>
				</ul>




				<h2>Other Notes</h2>
				<p>
					Color codes:
				</p>
				<ul>
					<li><b>Purple</b> - Knowledge</li>
					<li><b>Orange</b> - Content and media from other people. Nothing I created, usually downloaded from the internet.</li>
					<li><b>Green</b> - Archived stuff.</li>
					<li><b>Brown</b> - For the <tt>Other</tt> folder so it stands out.</li>
				</ul>
			</div>
		`,
	})
}

export async function dictionaryPage(): Promise<Response> {
	const data = await getDictionaryWatcherPageData()
	const cspellPath = (await getDevConfig()).paths.dictionaryCspellDisplay

	return page({
		title: 'Dictionary Manager',
		body: html`
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
	})
}
