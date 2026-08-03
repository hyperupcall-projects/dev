import { html, raw } from './html.ts'
import { page } from './layout.ts'
import {
	getBlocklistsDir,
	listBlocklistTxtFiles,
} from './server/blocklists.ts'

export async function blocklistsPage(): Promise<Response> {
	const [dir, files] = await Promise.all([
		getBlocklistsDir(),
		listBlocklistTxtFiles(),
	])

	return page({
		title: 'Blocklists',
		body: html`
			<div class="p-4" id="blocklists-page">
				<div class="mb-4">
					<h1 class="title mb-1">Blocklists</h1>
					<p class="subtitle is-6 mb-0">
						Hosted blocklist text files and compile tooling
					</p>
				</div>

				<div class="content mb-5">
					<h2 class="title is-5">Documentation</h2>
					<p>
						This API serves every <code>.txt</code> file from the blocklists
						directory on disk:
					</p>
					<p>
						<code>${dir}</code>
					</p>
					<p>
						Each file is available at
						<code>https://&lt;host&gt;/&lt;filename&gt;.txt</code>
						(for example
						<code>/ublacklist-compiled.txt</code>
						or
						<code>/ublockorigin-compiled.txt</code>).
					</p>

					<h3 class="title is-6 mt-4">uBlacklist vs uBlock Origin</h3>
					<p>
						<strong>uBlacklist</strong> and
						<strong>uBlock Origin</strong> are different tools with different
						list formats. Do not mix their files:
					</p>
					<ul>
						<li>
							<strong>uBlacklist</strong> — a browser extension that hides
							search-engine results by URL/site pattern. Files named like
							<code>ublacklist*.txt</code> use uBlacklist’s match syntax
							(often <code>*://*.example.com/*</code> style rules).
						</li>
						<li>
							<strong>uBlock Origin</strong> — an ad/content blocker that uses
							Adblock Plus–style filter lists. Files named like
							<code>ublockorigin*.txt</code> use that filter syntax
							(comments typically start with <code>!</code>).
						</li>
					</ul>
					<p>
						The compile script downloads several upstream sources, tags each
						chunk by target app, and writes separate compiled outputs for each
						format.
					</p>
				</div>

				<div class="mb-5">
					<h2 class="title is-5 mb-2">Served files</h2>
					${files.length === 0
						? html`<p class="has-text-grey">No <code>.txt</code> files found.</p>`
						: html`
								<ul>
									${files.map(
										(name) => html`
											<li>
												<a href=${`/${name}`} target="_blank" rel="noopener">
													/${name}
												</a>
											</li>
										`,
									)}
								</ul>
							`}
				</div>

				<div class="mb-3">
					<h2 class="title is-5 mb-2">Compile blacklist</h2>
					<p class="help mb-3">
						Runs
						<code>compile-blacklist.ts</code>
						in
						<code>${dir}</code>
						via Deno and streams the result below.
					</p>
					<button type="button" class="button is-primary" id="bl-compile">
						Compile blacklist
					</button>
				</div>

				<div id="bl-status" class="notification is-hidden mb-3 py-2 px-3"></div>
				<pre
					id="bl-output"
					class="box bl-output"
					style="min-height: 12rem; max-height: 28rem; overflow: auto; white-space: pre-wrap; word-break: break-word; background: #1e1e1e; color: #d4d4d4;"
				><code class="has-text-grey">Output will appear here after you run Compile blacklist.</code></pre>
			</div>
		`,
		scripts: raw(`
<script>
(function () {
	var btn = document.getElementById('bl-compile')
	var statusEl = document.getElementById('bl-status')
	var outputEl = document.getElementById('bl-output')

	var ANSI_FG = {
		30: '#000000',
		31: '#cd3131',
		32: '#0dbc79',
		33: '#e5e510',
		34: '#2472c8',
		35: '#bc3fbc',
		36: '#11a8cd',
		37: '#e5e5e5',
		90: '#666666',
		91: '#f14c4c',
		92: '#23d18b',
		93: '#f5f543',
		94: '#3b8eea',
		95: '#d670d6',
		96: '#29b8db',
		97: '#ffffff',
	}
	var ANSI_BG = {
		40: '#000000',
		41: '#cd3131',
		42: '#0dbc79',
		43: '#e5e510',
		44: '#2472c8',
		45: '#bc3fbc',
		46: '#11a8cd',
		47: '#e5e5e5',
		100: '#666666',
		101: '#f14c4c',
		102: '#23d18b',
		103: '#f5f543',
		104: '#3b8eea',
		105: '#d670d6',
		106: '#29b8db',
		107: '#ffffff',
	}

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	function styleToCss(style) {
		var css = []
		if (style.fg) css.push('color:' + style.fg)
		if (style.bg) css.push('background-color:' + style.bg)
		if (style.bold) css.push('font-weight:700')
		if (style.dim) css.push('opacity:0.7')
		if (style.italic) css.push('font-style:italic')
		if (style.underline) css.push('text-decoration:underline')
		return css.join(';')
	}

	function ansiToHtml(text) {
		var style = {
			fg: null,
			bg: null,
			bold: false,
			dim: false,
			italic: false,
			underline: false,
		}
		var out = ''
		var i = 0

		function flushText(chunk) {
			if (!chunk) return
			var html = escapeHtml(chunk)
			var css = styleToCss(style)
			out += css ? '<span style="' + css + '">' + html + '</span>' : html
		}

		function applyCodes(codes) {
			for (var c = 0; c < codes.length; c++) {
				var code = Number(codes[c] || '0')
				if (code === 0) {
					style.fg = null
					style.bg = null
					style.bold = false
					style.dim = false
					style.italic = false
					style.underline = false
				} else if (code === 1) style.bold = true
				else if (code === 2) style.dim = true
				else if (code === 3) style.italic = true
				else if (code === 4) style.underline = true
				else if (code === 22) {
					style.bold = false
					style.dim = false
				} else if (code === 23) style.italic = false
				else if (code === 24) style.underline = false
				else if (code === 39) style.fg = null
				else if (code === 49) style.bg = null
				else if (ANSI_FG[code]) style.fg = ANSI_FG[code]
				else if (ANSI_BG[code]) style.bg = ANSI_BG[code]
				else if (code === 38 || code === 48) {
					var isFg = code === 38
					var mode = Number(codes[c + 1] || '-1')
					if (mode === 5 && codes[c + 2] != null) {
						var n = Number(codes[c + 2])
						var hex = '#' + n.toString(16).padStart(2, '0').repeat(3)
						if (isFg) style.fg = hex
						else style.bg = hex
						c += 2
					} else if (mode === 2 && codes[c + 4] != null) {
						var rgb =
							'rgb(' +
							Number(codes[c + 2]) +
							',' +
							Number(codes[c + 3]) +
							',' +
							Number(codes[c + 4]) +
							')'
						if (isFg) style.fg = rgb
						else style.bg = rgb
						c += 4
					}
				}
			}
		}

		while (i < text.length) {
			if (text.charCodeAt(i) !== 27) {
				var start = i
				while (i < text.length && text.charCodeAt(i) !== 27) i++
				flushText(text.slice(start, i))
				continue
			}

			// ESC
			i++
			if (i >= text.length) break
			var next = text.charAt(i)

			if (next === '[') {
				i++
				var seqStart = i
				while (i < text.length) {
					var ch = text.charAt(i)
					i++
					if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
						if (ch === 'm') {
							applyCodes(text.slice(seqStart, i - 1).split(';'))
						}
						break
					}
				}
				continue
			}

			if (next === ']') {
				// OSC sequence: ESC ] ... BEL or ESC ]
				i++
				while (i < text.length) {
					var code = text.charCodeAt(i)
					if (code === 7) {
						i++
						break
					}
					if (code === 27 && text.charAt(i + 1) === String.fromCharCode(92)) {
						i += 2
						break
					}
					i++
				}
				continue
			}

			// Other ESC sequences: skip the next char
			i++
		}

		return out
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

	function setOutput(text, asAnsi) {
		if (!outputEl) return
		var value = text || '(no output)'
		if (asAnsi) outputEl.innerHTML = ansiToHtml(value)
		else outputEl.textContent = value
	}

	if (!btn) return

	btn.addEventListener('click', function () {
		hideStatus()
		btn.classList.add('is-loading')
		btn.disabled = true
		setOutput('Running compile-blacklist.ts…', false)

		fetch('/api/blocklists/compile', { method: 'POST' })
			.then(function (res) {
				return res.json().then(function (data) {
					return { ok: res.ok, data: data }
				})
			})
			.then(function (result) {
				if (!result.ok) {
					showStatus('danger', result.data.error || 'Compile failed')
					setOutput(result.data.error || 'Compile failed', false)
					return
				}

				var parts = []
				parts.push('$ ' + result.data.command)
				parts.push('(cwd: ' + result.data.cwd + ')')
				parts.push('')
				if (result.data.stdout) {
					parts.push('--- stdout ---')
					parts.push(result.data.stdout)
				}
				if (result.data.stderr) {
					parts.push('--- stderr ---')
					parts.push(result.data.stderr)
				}
				parts.push('')
				parts.push('exit code: ' + result.data.exitCode)
				setOutput(parts.join('\\n'), true)

				if (result.data.exitCode === 0) {
					showStatus('success', 'Compile finished successfully.')
				} else {
					showStatus(
						'danger',
						'Compile exited with code ' + result.data.exitCode + '.',
					)
				}
			})
			.catch(function (err) {
				showStatus('danger', err && err.message ? err.message : String(err))
				setOutput(err && err.message ? err.message : String(err), false)
			})
			.finally(function () {
				btn.classList.remove('is-loading')
				btn.disabled = false
			})
	})
})()
</script>
`),
	})
}
