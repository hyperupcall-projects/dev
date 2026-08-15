import { html } from 'hono/html'
import { FILE_EDITOR_IDS } from '../server/open-files.ts'

function codeList(values: readonly string[]) {
	return values.map((value) => html`<code>${value}</code>`).reduce(
		(acc, item, index) =>
			index === 0 ? item : html`${acc}, ${item}`,
		html``,
	)
}

export function openFileView() {
	return {
		title: 'Open file',
		content: html`
			<div class="p-4" id="open-file-page">
				<div class="mb-4">
					<h1 class="title mb-1">Open file</h1>
					<p class="subtitle is-6 mb-0">
						Open a specific file, optionally at a line and column, in
						VSCode, Zed, Sublime Text, or Kate
					</p>
				</div>

				<div class="content">
					<p>
						<code>POST /api/files/open</code>
						takes a filesystem path (not a catalog id). It reuses an
						already-open editor window so it can follow
						<a href="/docs/open-directory">Open directory</a>
						or
						<a href="/docs/workspaces">Workspaces</a>.
					</p>
					<p>
						<strong>Editors:</strong>
						${codeList(FILE_EDITOR_IDS)}
					</p>

					<h2 class="title is-5">Request</h2>
					<ul>
						<li>
							<code>path</code> (required) — absolute path, or
							<code>~</code> / <code>~/…</code>. Relative paths are
							rejected.
						</li>
						<li>
							<code>editor</code> (required) — one of
							${codeList(FILE_EDITOR_IDS)}
						</li>
						<li>
							<code>line</code> (optional) — 1-based line number
						</li>
						<li>
							<code>column</code> (optional) — 1-based column; requires
							<code>line</code>
						</li>
					</ul>
					<pre><code>POST /api/files/open
Content-Type: application/json

{
	"editor": "vscode",
	"path": "/absolute/path/to/file.ts",
	"line": 42,
	"column": 8
}</code></pre>
					<p>Success response:</p>
					<pre><code>{
	"editor": "vscode",
	"opened": "/absolute/path/to/file.ts",
	"line": 42,
	"column": 8
}</code></pre>
					<p>
						<code>line</code> and <code>column</code> are
						<code>null</code> when omitted.
					</p>

					<h2 class="title is-5 mt-5">How each editor is launched</h2>
					<ul>
						<li>
							<strong>vscode</strong> —
							<code>code -r --goto path[:line[:column]]</code>
							(<code>code-insiders</code> if <code>code</code> is missing)
						</li>
						<li>
							<strong>zed</strong> —
							<code>zed path[:line[:column]]</code>
						</li>
						<li>
							<strong>sublime</strong> —
							<code>subl -a path[:line[:column]]</code>
						</li>
						<li>
							<strong>kate</strong> —
							<code>kate [--line N] [--column N] path</code>
						</li>
					</ul>

					<h2 class="title is-5 mt-5">Calling from another local app</h2>
					<p>
						API routes allow CORS from
						<code>http://localhost:*</code> and
						<code>http://127.0.0.1:*</code>
						(including port 6006). Same-origin pages on this server do not
						need CORS. The 6006 app can
						<code>fetch('http://localhost:3000/…')</code>
						with JSON bodies; no cookies are used.
					</p>
					<p>
						Directory and workspace endpoints stay catalog-id based
						(<code>ide</code> / <code>opener</code> /
						<code>projectIds</code> /
						<code>folderId</code>). This file endpoint is path-based and
						uses <code>editor</code>. Those field names are not the same;
						do not rename them when composing calls.
					</p>
					<p>
						Discover directory ids with
						<code>GET /api/projects</code> and
						<code>GET /api/computing-folders</code>
						if the caller does not already store them. File open does not
						need an id.
					</p>

					<h3 class="title is-6 mt-4">Open a project, then a file</h3>
					<pre><code>await fetch('http://localhost:3000/api/projects/open', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		ide: 'vscode',
		projectIds: ['graft-key::tree-name'],
	}),
})

await fetch('http://localhost:3000/api/files/open', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		editor: 'vscode',
		path: '/absolute/path/to/file.ts',
		line: 42,
	}),
})</code></pre>

					<h3 class="title is-6 mt-4">Open a computing folder, then a file</h3>
					<pre><code>await fetch('http://localhost:3000/api/computing-folders/open', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({ folderId: 'programs', opener: 'zed' }),
})

await fetch('http://localhost:3000/api/files/open', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		editor: 'zed',
		path: '/abs/file.rs',
		line: 10,
	}),
})</code></pre>

					<h2 class="title is-5 mt-5">Errors</h2>
					<ul>
						<li>
							<code>400</code> if
							<code>editor</code> is not one of
							${codeList(FILE_EDITOR_IDS)}
						</li>
						<li>
							<code>400</code> if
							<code>path</code> is missing, relative, not a file, or
							does not exist
						</li>
						<li>
							<code>400</code> if
							<code>line</code> / <code>column</code> is not an integer
							≥ 1, or <code>column</code> is set without
							<code>line</code>
						</li>
						<li>
							<code>400</code> if the editor binary is not found on
							<code>PATH</code>
						</li>
					</ul>
				</div>
			</div>
		`,
	}
}
