import { html, raw } from './html.ts'
import { page } from './layout.ts'
import { listKnowledgeFolders } from './server/knowledge-folders.ts'

export async function knowledgeManagerPage(): Promise<Response> {
	const folders = await listKnowledgeFolders()
	const foldersJson = JSON.stringify(folders).replaceAll('</', '<\\/')

	return page({
		title: 'Knowledge Manager',
		body: html`
			<div class="p-4" id="knowledge-manager">
				<div class="mb-4">
					<h1 class="title mb-1">Knowledge Manager</h1>
					<p class="subtitle is-6 mb-0">
						Select a knowledge folder and open it in Obsidian, your file manager,
						Zettlr, VSCode, or Zed
					</p>
				</div>

				<div id="km-status" class="notification is-hidden mb-3 py-2 px-3"></div>

				<div class="columns">
					<div class="column is-one-third">
						<h2 class="title is-5 mb-2">Folders</h2>
						<p class="help mb-3">Choose one folder, then pick how to open it.</p>

						<div class="field">
							${folders.map(
								(folder, index) => html`
									<label
										class="is-flex is-align-items-flex-start mb-2"
										style="gap: 0.5rem; cursor: pointer;"
									>
										<input
											type="radio"
											name="km-folder"
											value=${folder.id}
											checked=${index === 0}
											style="margin-top: 0.35rem;"
										/>
										<span>
											<span class="has-text-weight-medium">${folder.name}</span>
											<br />
											<code class="is-size-7" style="word-break: break-all;">
												${folder.path}
											</code>
											${!folder.exists
												? html`
														<br />
														<span class="tag is-warning is-light is-size-7 mt-1">
															missing
														</span>
													`
												: ''}
										</span>
									</label>
								`,
							)}
						</div>

						<div
							class="is-flex is-align-items-flex-end is-flex-wrap-wrap mt-4"
							style="gap: 0.5rem;"
						>
							<div class="field mb-0">
								<label class="label is-small" for="km-opener">Open with</label>
								<div class="control">
									<div class="select">
										<select id="km-opener">
											<option value="obsidian">Obsidian</option>
											<option value="file-manager">File manager</option>
											<option value="zettlr">Zettlr</option>
											<option value="vscode">VSCode</option>
											<option value="zed">Zed</option>
										</select>
									</div>
								</div>
							</div>
							<div class="field mb-0">
								<label class="label is-small" style="visibility: hidden;">Open</label>
								<div class="control">
									<button type="button" class="button is-primary" id="km-open">
										Open
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`,
		scripts: raw(`
<script>
(function () {
	var folders = ${foldersJson}
	var statusEl = document.getElementById('km-status')
	var openBtn = document.getElementById('km-open')
	var openerEl = document.getElementById('km-opener')

	function selectedFolderId() {
		var checked = document.querySelector('input[name="km-folder"]:checked')
		return checked ? checked.value : null
	}

	function showStatus(kind, message) {
		if (!statusEl) return
		statusEl.className = 'notification mb-3 py-2 px-3 is-' + kind
		statusEl.textContent = message
		statusEl.classList.remove('is-hidden')
	}

	function hideStatus() {
		if (!statusEl) return
		statusEl.classList.add('is-hidden')
		statusEl.textContent = ''
	}

	if (openBtn) {
		openBtn.addEventListener('click', function () {
			var folderId = selectedFolderId()
			var opener = openerEl ? openerEl.value : 'obsidian'
			if (!folderId) {
				showStatus('warning', 'Select a folder first.')
				return
			}
			var folder = folders.find(function (f) { return f.id === folderId })
			if (folder && !folder.exists) {
				showStatus('danger', 'That folder is missing on disk: ' + folder.path)
				return
			}

			hideStatus()
			openBtn.disabled = true
			fetch('/api/knowledge/open', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folderId: folderId, opener: opener }),
			})
				.then(function (res) {
					return res.json().then(function (data) {
						return { ok: res.ok, data: data }
					})
				})
				.then(function (result) {
					if (!result.ok) {
						showStatus('danger', result.data.error || 'Failed to open folder')
						return
					}
					showStatus(
						'success',
						'Opened ' + result.data.opened + ' with ' + result.data.opener + '.',
					)
				})
				.catch(function (err) {
					showStatus('danger', err && err.message ? err.message : String(err))
				})
				.finally(function () {
					openBtn.disabled = false
				})
		})
	}
})()
</script>
`),
	})
}
