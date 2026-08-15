import { html } from 'hono/html'
import { IDE_IDS } from '../server/open-projects.ts'

function codeList(values: readonly string[]) {
	return values.map((value) => html`<code>${value}</code>`).reduce(
		(acc, item, index) =>
			index === 0 ? item : html`${acc}, ${item}`,
		html``,
	)
}

export function workspacesView() {
	return {
		title: 'Workspaces',
		content: html`
			<div class="p-4" id="workspaces-page">
				<div class="mb-4">
					<h1 class="title mb-1">Workspaces</h1>
					<p class="subtitle is-6 mb-0">
						Open several directories at once in VSCode, Cursor, Zed, or
						another editor
					</p>
				</div>

				<div class="content">
					<p>
						<a href="/projects">Software Project Manager</a>
						calls
						<code>POST /api/projects/open</code>
						with a list of garden or pinned project ids. One id opens that
						folder directly (see
						<a href="/docs/open-directory">Open directory</a>).
						Two or more ids open a <strong>workspace</strong> so every
						folder appears in the same editor window. To jump to a file
						inside that window, see
						<a href="/docs/open-file">Open file</a>.
					</p>
					<p>
						<strong>Editors:</strong>
						${codeList(IDE_IDS)}
					</p>

					<h2 class="title is-5">Request</h2>
					<p>
						Discover ids with
						<code>GET /api/projects</code>.
						Each id is either a garden entry
						(<code>graft-key::tree-name</code>) or a pinned folder
						(<code>pinned::/absolute/path</code>).
					</p>
					<pre><code>POST /api/projects/open
Content-Type: application/json

{
	"ide": "vscode",
	"projectIds": [
		"graft-key::first-tree",
		"graft-key::second-tree"
	]
}</code></pre>
					<p>Success response:</p>
					<pre><code>{
	"ide": "vscode",
	"opened": "/tmp/dev-project-manager-&lt;uuid&gt;/workspace.code-workspace",
	"projectCount": 2
}</code></pre>
					<p>
						<code>opened</code> is the path passed to the editor: a
						<code>.code-workspace</code> file for VSCode/Cursor, or a
						temporary directory of symlinks for Zed, Kate, and CLion.
					</p>

					<h2 class="title is-5 mt-5">VSCode and Cursor</h2>
					<p>
						These editors natively support multi-root workspaces. The
						server writes a temporary
						<code>workspace.code-workspace</code>
						file and launches
						<code>code</code> or
						<code>cursor</code>
						with that file:
					</p>
					<pre><code>{
	"folders": [
		{ "name": "first-tree", "path": "/absolute/path/to/first" },
		{ "name": "second-tree", "path": "/absolute/path/to/second" }
	]
}</code></pre>
					<p>
						Each workspace folder keeps its real path, so editor settings,
						git status, and terminals inside each root work as usual.
					</p>

					<h2 class="title is-5 mt-5">Zed, Kate, and CLion</h2>
					<p>
						These editors open a single directory. For multiple projects
						the server creates a temporary directory
						(<code>/tmp/dev-project-manager-&lt;uuid&gt;</code>) and
						symlinks each project into it, then launches
						<code>zed</code>,
						<code>kate</code>, or CLion on that directory.
					</p>
					<p>
						Symlink names are the project names. If two projects share a
						name, the category id is prefixed, then a numeric suffix if
						needed.
					</p>
					<pre><code>/tmp/dev-project-manager-&lt;uuid&gt;/
	first-tree -> /absolute/path/to/first
	second-tree -> /absolute/path/to/second</code></pre>

					<h2 class="title is-5 mt-5">Errors</h2>
					<ul>
						<li>
							<code>400</code> if
							<code>ide</code> is not one of
							${codeList(IDE_IDS)}
						</li>
						<li>
							<code>400</code> if
							<code>projectIds</code> is missing or empty
						</li>
						<li>
							<code>400</code> if an id is unknown, or a project path
							does not exist on disk
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
