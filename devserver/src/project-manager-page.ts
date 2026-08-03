import {
	getGardenCatalog,
	PINNED_CATEGORY_ID,
} from './server/garden-projects.ts'
import { listSavedGroups } from './server/project-groups.ts'
import { html, raw } from './html.ts'
import { page } from './layout.ts'

export async function projectManagerPage(): Promise<Response> {
	const [catalog, groups] = await Promise.all([
		getGardenCatalog(),
		listSavedGroups(),
	])

	const pinned =
		catalog.categories.find((c) => c.id === PINNED_CATEGORY_ID)?.projects ??
		[]
	const gardenCategories = catalog.categories.filter(
		(c) => c.id !== PINNED_CATEGORY_ID,
	)

	const initialData = {
		pinned,
		categories: gardenCategories,
		warnings: catalog.warnings,
		groups,
	}
	// Prevent </script> in paths/names from breaking the inline script tag.
	const initialDataJson = JSON.stringify(initialData).replaceAll(
		'</',
		'<\\/',
	)

	return page({
		title: 'Software Project Manager',
		body: html`
			<div class="p-4" id="project-manager">
				<div
					class="is-flex is-justify-content-space-between is-align-items-flex-end is-flex-wrap-wrap mb-3"
					style="gap: 0.75rem;"
				>
					<div>
						<h1 class="title mb-1">Software Project Manager</h1>
						<p class="subtitle is-6 mb-0">
							Browse garden projects, select a set, and open them in an IDE
						</p>
					</div>
					<div
						class="is-flex is-align-items-flex-end is-flex-wrap-wrap"
						style="gap: 0.5rem;"
					>
						<div class="field mb-0">
							<label class="label is-small" for="pm-search">Search</label>
							<div class="control">
								<input
									id="pm-search"
									class="input"
									type="search"
									placeholder="Filter projects…"
									autocomplete="off"
									style="min-width: 16rem;"
								/>
							</div>
						</div>
						<div class="field mb-0">
							<label class="label is-small" for="pm-ide">IDE</label>
							<div class="control">
								<div class="select">
									<select id="pm-ide">
										<option value="cursor">Cursor</option>
										<option value="vscode">VSCode</option>
										<option value="zed">Zed</option>
										<option value="kate">Kate</option>
										<option value="clion">CLion</option>
									</select>
								</div>
							</div>
						</div>
						<div class="field mb-0">
							<label class="label is-small" style="visibility: hidden;">Open</label>
							<div class="control buttons mb-0">
								<button
									type="button"
									class="button is-primary"
									id="pm-open"
									disabled
								>
									Open
								</button>
								<button
									type="button"
									class="button is-light"
									id="pm-clear"
									disabled
								>
									Clear
								</button>
							</div>
						</div>
						<p class="help mb-0" id="pm-selection-count" style="align-self: center;">
							0 selected
						</p>
					</div>
				</div>

				<div id="pm-status" class="notification is-hidden mb-3 py-2 px-3"></div>
				${catalog.warnings.length > 0
					? html`
							<div class="notification is-warning is-light mb-3 py-2 px-3">
								<p class="mb-1"><strong>Warnings while loading garden config:</strong></p>
								<ul class="mb-0">
									${catalog.warnings.map((w) => html`<li>${w}</li>`)}
								</ul>
							</div>
						`
					: ''}

				<div class="columns">
					<div class="column is-one-quarter">
						<div class="mb-2">
							<h2 class="title is-5 mb-1">Pinned</h2>
							<p class="help mb-2">
								Local folders you can select and open.
							</p>
							<ul id="pm-pinned" class="mb-4" style="list-style: none; padding-left: 0;"></ul>
						</div>
						<div class="mb-2 is-flex is-justify-content-space-between is-align-items-center">
							<h2 class="title is-5 mb-0">Saved groups</h2>
						</div>
						<p class="help mb-2">
							Select projects, then save them as a reusable group.
						</p>
						<button
							type="button"
							class="button is-small is-link is-light mb-3"
							id="pm-save-group"
							disabled
						>
							Save selection as…
						</button>
						<ul id="pm-groups" class="menu-list"></ul>
						<p id="pm-groups-empty" class="has-text-grey is-size-7">
							No saved groups yet.
						</p>
					</div>
					<div class="column">
						<div id="pm-catalog"></div>
						<p id="pm-empty" class="has-text-grey is-hidden">
							No projects match your search.
						</p>
					</div>
				</div>
			</div>
		`,
		scripts: raw(`
<script>
	(function () {
		var DATA = ${initialDataJson}
		var selected = new Set()
		var IDE_KEY = 'project-manager-ide'

		var searchEl = document.getElementById('pm-search')
		var ideEl = document.getElementById('pm-ide')
		var openBtn = document.getElementById('pm-open')
		var clearBtn = document.getElementById('pm-clear')
		var saveBtn = document.getElementById('pm-save-group')
		var countEl = document.getElementById('pm-selection-count')
		var catalogEl = document.getElementById('pm-catalog')
		var emptyEl = document.getElementById('pm-empty')
		var pinnedEl = document.getElementById('pm-pinned')
		var groupsEl = document.getElementById('pm-groups')
		var groupsEmptyEl = document.getElementById('pm-groups-empty')
		var statusEl = document.getElementById('pm-status')

		function showStatus(kind, message) {
			statusEl.className = 'notification mb-3 py-2 px-3 is-' + kind
			statusEl.textContent = message
			statusEl.classList.remove('is-hidden')
		}

		function hideStatus() {
			statusEl.classList.add('is-hidden')
			statusEl.textContent = ''
		}

		function escapeHtml(value) {
			return String(value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
		}

		function getQuery() {
			return (searchEl.value || '').trim().toLowerCase()
		}

		function projectMatches(project, query) {
			if (!query) return true
			return project.name.toLowerCase().indexOf(query) !== -1
		}

		function visibleProjects(category) {
			var query = getQuery()
			return category.projects.filter(function (p) {
				return projectMatches(p, query)
			})
		}

		function updateSelectionUi() {
			var n = selected.size
			countEl.textContent = n + ' selected'
			openBtn.disabled = n === 0
			clearBtn.disabled = n === 0
			saveBtn.disabled = n === 0
		}

		function syncCategoryCheckbox(categoryEl, category) {
			var checkbox = categoryEl.querySelector('.js-category-check')
			if (!checkbox) return
			var visible = visibleProjects(category)
			var selectedCount = visible.filter(function (p) {
				return selected.has(p.id)
			}).length
			checkbox.checked = visible.length > 0 && selectedCount === visible.length
			checkbox.indeterminate =
				selectedCount > 0 && selectedCount < visible.length
		}

		function renderPinned() {
			pinnedEl.innerHTML = (DATA.pinned || [])
				.map(function (project) {
					return (
						'<li class="mb-1">' +
						'<label class="checkbox is-flex is-align-items-center" style="gap: 0.5rem;">' +
						'<input type="checkbox" class="js-pinned-check" data-project-id="' +
						escapeHtml(project.id) +
						'"' +
						(selected.has(project.id) ? ' checked' : '') +
						' />' +
						'<span>' +
						escapeHtml(project.name) +
						'</span>' +
						(project.exists
							? ''
							: '<span class="tag is-warning is-light is-size-7">missing</span>') +
						'</label>' +
						'<code class="is-size-7 has-text-grey" style="margin-left: 1.5rem;">' +
						escapeHtml(project.path) +
						'</code>' +
						'</li>'
					)
				})
				.join('')
		}

		function renderCatalog() {
			var query = getQuery()
			var html = ''
			var anyVisible = false

			DATA.categories.forEach(function (category) {
				var visible = visibleProjects(category)
				if (visible.length === 0) return
				anyVisible = true

				var selectedCount = visible.filter(function (p) {
					return selected.has(p.id)
				}).length
				var allChecked = selectedCount === visible.length
				var indeterminate = selectedCount > 0 && selectedCount < visible.length

				html +=
					'<details class="pm-category mb-3" data-category-id="' +
					escapeHtml(category.id) +
					'" open>' +
					'<summary class="is-flex is-align-items-center" style="gap: 0.5rem; cursor: pointer; list-style: none;">' +
					'<label class="checkbox" onclick="event.stopPropagation()">' +
					'<input type="checkbox" class="js-category-check"' +
					(allChecked ? ' checked' : '') +
					(indeterminate ? ' data-indeterminate="1"' : '') +
					' />' +
					'</label>' +
					'<strong>' +
					escapeHtml(category.name) +
					'</strong>' +
					'<span class="tag is-light is-rounded">' +
					visible.length +
					(query ? ' / ' + category.projects.length : '') +
					'</span>' +
					'</summary>' +
					'<ul class="mt-2 ml-4" style="list-style: none; padding-left: 0;">'

				visible.forEach(function (project) {
					html +=
						'<li class="mb-1">' +
						'<label class="checkbox is-flex is-align-items-center" style="gap: 0.5rem;">' +
						'<input type="checkbox" class="js-project-check" data-project-id="' +
						escapeHtml(project.id) +
						'"' +
						(selected.has(project.id) ? ' checked' : '') +
						' />' +
						'<span>' +
						escapeHtml(project.name) +
						'</span>' +
						(project.exists
							? ''
							: '<span class="tag is-warning is-light is-size-7">missing</span>') +
						'<code class="is-size-7 has-text-grey" style="margin-left: 0.25rem;">' +
						escapeHtml(project.path) +
						'</code>' +
						'</label>' +
						'</li>'
				})

				html += '</ul></details>'
			})

			catalogEl.innerHTML = html
			emptyEl.classList.toggle('is-hidden', anyVisible)

			catalogEl.querySelectorAll('.js-category-check[data-indeterminate="1"]').forEach(
				function (el) {
					el.indeterminate = true
				},
			)
		}

		function renderGroups() {
			if (!DATA.groups.length) {
				groupsEl.innerHTML = ''
				groupsEmptyEl.classList.remove('is-hidden')
				return
			}
			groupsEmptyEl.classList.add('is-hidden')
			groupsEl.innerHTML = DATA.groups
				.map(function (group) {
					return (
						'<li class="mb-2">' +
						'<div class="is-flex is-align-items-center" style="gap: 0.35rem;">' +
						'<button type="button" class="button is-small is-ghost js-load-group has-text-left" data-group-id="' +
						escapeHtml(group.id) +
						'" style="flex: 1; justify-content: flex-start;">' +
						escapeHtml(group.name) +
						' <span class="has-text-grey ml-1">(' +
						group.projectIds.length +
						')</span>' +
						'</button>' +
						'<button type="button" class="button is-small is-light js-rename-group" data-group-id="' +
						escapeHtml(group.id) +
						'" title="Rename">Rename</button>' +
						'<button type="button" class="button is-small is-danger is-light js-delete-group" data-group-id="' +
						escapeHtml(group.id) +
						'" title="Delete">Delete</button>' +
						'</div>' +
						'</li>'
					)
				})
				.join('')
		}

		function findCategory(id) {
			return DATA.categories.find(function (c) {
				return c.id === id
			})
		}

		function findGroup(id) {
			return DATA.groups.find(function (g) {
				return g.id === id
			})
		}

		async function api(url, options) {
			var response = await fetch(url, options)
			var data = null
			try {
				data = await response.json()
			} catch (e) {
				data = null
			}
			if (!response.ok) {
				var msg =
					(data && data.error) || response.statusText || 'Request failed'
				throw new Error(msg)
			}
			return data
		}

		searchEl.addEventListener('input', function () {
			renderCatalog()
		})

		var savedIde = null
		try {
			savedIde = localStorage.getItem(IDE_KEY)
		} catch (e) {}
		if (savedIde) ideEl.value = savedIde

		ideEl.addEventListener('change', function () {
			try {
				localStorage.setItem(IDE_KEY, ideEl.value)
			} catch (e) {}
		})

		catalogEl.addEventListener('change', function (event) {
			var target = event.target
			if (!(target instanceof HTMLInputElement)) return

			if (target.classList.contains('js-project-check')) {
				var id = target.getAttribute('data-project-id')
				if (!id) return
				if (target.checked) selected.add(id)
				else selected.delete(id)
				updateSelectionUi()
				var details = target.closest('.pm-category')
				if (details) {
					var category = findCategory(details.getAttribute('data-category-id'))
					if (category) syncCategoryCheckbox(details, category)
				}
				return
			}

			if (target.classList.contains('js-category-check')) {
				var details = target.closest('.pm-category')
				if (!details) return
				var category = findCategory(details.getAttribute('data-category-id'))
				if (!category) return
				var visible = visibleProjects(category)
				visible.forEach(function (p) {
					if (target.checked) selected.add(p.id)
					else selected.delete(p.id)
				})
				details.querySelectorAll('.js-project-check').forEach(function (el) {
					el.checked = target.checked
				})
				target.indeterminate = false
				updateSelectionUi()
			}
		})

		openBtn.addEventListener('click', async function () {
			hideStatus()
			openBtn.classList.add('is-loading')
			try {
				var result = await api('/api/projects/open', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						ide: ideEl.value,
						projectIds: Array.from(selected),
					}),
				})
				showStatus(
					'success',
					'Opened ' +
						result.projectCount +
						' project(s) in ' +
						result.ide +
						': ' +
						result.opened,
				)
			} catch (err) {
				showStatus(
					'danger',
					err && err.message ? err.message : String(err),
				)
			} finally {
				openBtn.classList.remove('is-loading')
			}
		})

		pinnedEl.addEventListener('change', function (event) {
			var target = event.target
			if (!(target instanceof HTMLInputElement)) return
			if (!target.classList.contains('js-pinned-check')) return
			var id = target.getAttribute('data-project-id')
			if (!id) return
			if (target.checked) selected.add(id)
			else selected.delete(id)
			updateSelectionUi()
		})

		clearBtn.addEventListener('click', function () {
			selected = new Set()
			updateSelectionUi()
			renderPinned()
			renderCatalog()
			hideStatus()
		})

		saveBtn.addEventListener('click', async function () {
			var name = window.prompt('Name for this saved group:')
			if (name == null) return
			name = name.trim()
			if (!name) return
			hideStatus()
			try {
				var group = await api('/api/project-groups', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: name,
						projectIds: Array.from(selected),
					}),
				})
				DATA.groups.push(group)
				DATA.groups.sort(function (a, b) {
					return a.name.localeCompare(b.name)
				})
				renderGroups()
				showStatus('success', 'Saved group "' + group.name + '"')
			} catch (err) {
				showStatus(
					'danger',
					err && err.message ? err.message : String(err),
				)
			}
		})

		groupsEl.addEventListener('click', async function (event) {
			var target = event.target
			if (!(target instanceof Element)) return

			var loadBtn = target.closest('.js-load-group')
			if (loadBtn) {
				var group = findGroup(loadBtn.getAttribute('data-group-id'))
				if (!group) return
				selected = new Set(group.projectIds)
				updateSelectionUi()
				renderPinned()
				renderCatalog()
				showStatus(
					'info',
					'Loaded group "' + group.name + '" (' + group.projectIds.length + ' projects)',
				)
				return
			}

			var renameBtn = target.closest('.js-rename-group')
			if (renameBtn) {
				var group = findGroup(renameBtn.getAttribute('data-group-id'))
				if (!group) return
				var next = window.prompt('Rename group:', group.name)
				if (next == null) return
				next = next.trim()
				if (!next || next === group.name) return
				try {
					var updated = await api('/api/project-groups/' + group.id, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ name: next }),
					})
					group.name = updated.name
					group.updatedAt = updated.updatedAt
					DATA.groups.sort(function (a, b) {
						return a.name.localeCompare(b.name)
					})
					renderGroups()
					showStatus('success', 'Renamed group to "' + updated.name + '"')
				} catch (err) {
					showStatus(
						'danger',
						err && err.message ? err.message : String(err),
					)
				}
				return
			}

			var deleteBtn = target.closest('.js-delete-group')
			if (deleteBtn) {
				var group = findGroup(deleteBtn.getAttribute('data-group-id'))
				if (!group) return
				if (!window.confirm('Delete saved group "' + group.name + '"?')) return
				try {
					await api('/api/project-groups/' + group.id, { method: 'DELETE' })
					DATA.groups = DATA.groups.filter(function (g) {
						return g.id !== group.id
					})
					renderGroups()
					showStatus('success', 'Deleted group "' + group.name + '"')
				} catch (err) {
					showStatus(
						'danger',
						err && err.message ? err.message : String(err),
					)
				}
			}
		})

		updateSelectionUi()
		renderPinned()
		renderCatalog()
		renderGroups()
	})()
</script>
`),
	})
}
