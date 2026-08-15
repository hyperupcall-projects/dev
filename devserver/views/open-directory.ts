import { html } from 'hono/html'
import {
	COMPUTING_FOLDER_IDS,
	COMPUTING_FOLDER_OPENERS,
} from '../server/computing-folders.ts'
import {
	KNOWLEDGE_OPENER_IDS,
	listKnowledgeFolders,
} from '../server/knowledge-folders.ts'
import { IDE_IDS } from '../server/open-projects.ts'

function codeList(values: readonly string[]) {
	return values.map((value) => html`<code>${value}</code>`).reduce(
		(acc, item, index) =>
			index === 0 ? item : html`${acc}, ${item}`,
		html``,
	)
}

export async function openDirectoryView() {
	const knowledgeFolders = await listKnowledgeFolders()

	return {
		title: 'Open directory',
		content: html`
			<div class="p-4" id="open-directory-page">
				<div class="mb-4">
					<h1 class="title mb-1">Open directory</h1>
					<p class="subtitle is-6 mb-0">
						HTTP routes that open a single folder in VSCode, Cursor, Zed,
						Obsidian, or another installed app
					</p>
				</div>

				<div class="content">
					<p>
						These endpoints spawn the chosen app detached from the web
						server. The binary must be on <code>PATH</code> (or configured
						in the dev config for Obsidian and CLion). Each request body is
						JSON. To open a specific file (optionally at a line) after a
						directory, see
						<a href="/docs/open-file">Open file</a>.
					</p>

					<h2 class="title is-5">Knowledge folders</h2>
					<p>
						Used by
						<a href="/directories">Directories</a>
						(Knowledge Manager).
						<code>POST /api/knowledge/open</code>
						opens one configured knowledge folder.
					</p>
					<p>
						<strong>Openers:</strong>
						${codeList(KNOWLEDGE_OPENER_IDS)}
					</p>
					<ul>
						<li>
							<strong>obsidian</strong> — launches
							<code>obsidian://open?path=…</code>
							(falls back to <code>xdg-open</code> if the Obsidian binary
							is missing)
						</li>
						<li>
							<strong>vscode</strong> — <code>code</code> or
							<code>code-insiders</code>
						</li>
						<li><strong>zed</strong> — <code>zed</code></li>
						<li><strong>zettlr</strong> — <code>zettlr</code></li>
						<li>
							<strong>file-manager</strong> —
							<code>xdg-open</code>, Dolphin, Nautilus, or Thunar
						</li>
					</ul>
					<p>Request:</p>
					<pre><code>POST /api/knowledge/open
Content-Type: application/json

{
	"folderId": "&lt;id&gt;",
	"opener": "obsidian"
}</code></pre>
					<p>Success response:</p>
					<pre><code>{
	"folderId": "&lt;id&gt;",
	"opener": "obsidian",
	"opened": "/absolute/path/to/folder"
}</code></pre>
					${knowledgeFolders.length === 0
						? html`<p class="has-text-grey">No knowledge folders are configured.</p>`
						: html`
								<p>Configured <code>folderId</code> values:</p>
								<ul>
									${knowledgeFolders.map(
										(folder) => html`
											<li>
												<code>${folder.id}</code>
												— ${folder.name}
												(<code>${folder.path}</code>)
												${!folder.exists
													? html`
															<span class="tag is-warning is-light is-size-7">
																missing
															</span>
														`
													: ''}
											</li>
										`,
									)}
								</ul>
							`}

					<h2 class="title is-5 mt-5">Computing folders</h2>
					<p>
						Used by
						<a href="/projects">Software Project Manager</a>.
						<code>POST /api/computing-folders/open</code>
						opens a folder under
						<code>~/Documents/Computing</code>, or one of its
						subdirectories.
					</p>
					<p>
						<strong>Openers:</strong>
						${codeList(COMPUTING_FOLDER_OPENERS)}
					</p>
					<p>
						List folders and subdirectory ids first with
						<code>GET /api/computing-folders</code>.
						Known top-level ids:
						${codeList(COMPUTING_FOLDER_IDS)}.
					</p>
					<p>Request:</p>
					<pre><code>POST /api/computing-folders/open
Content-Type: application/json

{
	"folderId": "programs",
	"subdirectoryId": "programs::some-dir",
	"opener": "vscode"
}</code></pre>
					<p>
						<code>subdirectoryId</code> is optional. Omit it to open the
						top-level computing folder. Subdirectory ids are
						<code>&lt;folderId&gt;::&lt;name&gt;</code>.
					</p>
					<p>Success response:</p>
					<pre><code>{
	"folderId": "programs",
	"opener": "vscode",
	"opened": "/home/…/Documents/Computing/Programs/some-dir"
}</code></pre>

					<h2 class="title is-5 mt-5">Garden and pinned projects</h2>
					<p>
						<code>POST /api/projects/open</code>
						opens one or more garden/pinned projects. With a
						<strong>single</strong>
						<code>projectIds</code> entry it opens that directory directly
						in the chosen editor — including Cursor.
					</p>
					<p>
						<strong>Editors:</strong>
						${codeList(IDE_IDS)}
					</p>
					<p>
						Discover ids with
						<code>GET /api/projects</code>
						(garden groups plus pinned local folders).
					</p>
					<p>Request (one directory):</p>
					<pre><code>POST /api/projects/open
Content-Type: application/json

{
	"ide": "cursor",
	"projectIds": ["graft-key::tree-name"]
}</code></pre>
					<p>Success response:</p>
					<pre><code>{
	"ide": "cursor",
	"opened": "/absolute/path/to/project",
	"projectCount": 1
}</code></pre>
					<p>
						To open several directories in one editor window, see
						<a href="/docs/workspaces">Workspaces</a>.
					</p>

					<h2 class="title is-5 mt-5">Activity folders</h2>
					<p>
						Used by
						<a href="/directories">Directories</a>
						(Project Manager).
						<code>POST /api/activity/open</code>
						opens a folder under the activity-projects root in the file
						manager only (not an editor).
					</p>
					<p>
						List folders with
						<code>GET /api/activity</code>.
						The path must stay under the configured activity-projects root.
					</p>
					<p>Request:</p>
					<pre><code>POST /api/activity/open
Content-Type: application/json

{
	"path": "/absolute/path/under/activity-root"
}</code></pre>
					<p>Success response:</p>
					<pre><code>{
	"opened": "/absolute/path/under/activity-root"
}</code></pre>
				</div>
			</div>
		`,
	}
}
