import { html, raw } from 'hono/html'
import {
	getActivityProjectsRoot,
	listActivityProjects,
} from '../server/activity-projects.ts'

export async function activityManagerPanel() {
	const projects = await listActivityProjects()
	const root = await getActivityProjectsRoot()

	return {
		content: html`
			<div id="activity-manager">
				<div class="mb-4">
					<h2 class="title is-4 mb-1">Project Manager</h2>
					<p class="subtitle is-6 mb-0">
						Open activity folders from
						<code>${root}</code>
						in your file manager
					</p>
				</div>

				<div id="am-status" class="notification is-hidden mb-3 py-2 px-3"></div>

				${projects.length === 0
					? html`
							<p class="has-text-grey">
								No subdirectories found in
								<code>${root}</code>.
							</p>
						`
					: html`
							<ul class="mb-0" style="list-style: none; padding-left: 0;">
								${projects.map(
									(project) => html`
										<li class="mb-2">
											<button
												type="button"
												class="button is-link is-light js-open-activity"
												data-path="${project.path}"
											>
												${project.name}
											</button>
										</li>
									`,
								)}
							</ul>
						`}
			</div>
		`,
		scripts: raw(`
<script>
(function () {
	var statusEl = document.getElementById('am-status')
	var root = document.getElementById('activity-manager')

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

	if (!root) return

	root.addEventListener('click', function (event) {
		var target = event.target
		if (!(target instanceof Element)) return
		var btn = target.closest('.js-open-activity')
		if (!btn) return

		var folderPath = btn.getAttribute('data-path')
		if (!folderPath) return

		hideStatus()
		btn.classList.add('is-loading')
		btn.disabled = true

		fetch('/api/activity/open', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: folderPath }),
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
				showStatus('success', 'Opened ' + result.data.opened + ' in file manager.')
			})
			.catch(function (err) {
				showStatus('danger', err && err.message ? err.message : String(err))
			})
			.finally(function () {
				btn.classList.remove('is-loading')
				btn.disabled = false
			})
	})
})()
</script>
`),
	}
}
