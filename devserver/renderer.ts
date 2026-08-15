import { html, raw } from 'hono/html'
import type { MiddlewareHandler } from 'hono'

declare module 'hono' {
	interface ContextRenderer {
		(
			content: string | Promise<string>,
			head: { title: string; scripts?: string | Promise<string> },
		): Response | Promise<Response>
	}
}

function navigation() {
	return html`
		<nav
			class="navbar"
			role="navigation"
			aria-label="main navigation"
			style="border-bottom: 1px solid lightgray"
		>
			<div class="navbar-brand">
				<button
					type="button"
					role="button"
					class="navbar-burger"
					aria-label="menu"
					aria-expanded="false"
					data-target="navbarBasicExample"
					id="navbar-burger"
				>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
				</button>
			</div>
			<div id="navbarBasicExample" class="navbar-menu">
				<div class="navbar-start">
					<a class="navbar-item" href="/directories">📁 Directories</a>
					<a class="navbar-item" href="/projects">💻 SW Project Manager</a>
					<a class="navbar-item" href="/services">⚙️ Service Manager</a>
					<a class="navbar-item" href="/dictionary">📖 Dictionary Manager</a>
					<div class="navbar-item has-dropdown is-hoverable" id="nav-docs">
						<a class="navbar-link" href="#" id="nav-docs-link">📚 Documentation</a>
						<div class="navbar-dropdown">
							<a class="navbar-item" href="/docs/blocklists">Blocklists</a>
							<a class="navbar-item" href="/docs/open-directory">Open directory</a>
							<a class="navbar-item" href="/docs/open-file">Open file</a>
							<a class="navbar-item" href="/docs/workspaces">Workspaces</a>
						</div>
					</div>
				</div>
			</div>
		</nav>
	`
}

const sharedClientScript = raw(`
<script>
	(function () {
		var burger = document.getElementById('navbar-burger')
		var menu = document.getElementById('navbarBasicExample')
		if (burger && menu) {
			burger.addEventListener('click', function () {
				burger.classList.toggle('is-active')
				menu.classList.toggle('is-active')
			})
		}
		var docs = document.getElementById('nav-docs')
		var docsLink = document.getElementById('nav-docs-link')
		if (docs && docsLink) {
			docsLink.addEventListener('click', function (event) {
				event.preventDefault()
				docs.classList.toggle('is-active')
			})
		}
		try {
			var protocol = location.protocol === 'https:' ? 'wss' : 'ws'
			window.ws = new WebSocket(protocol + '://' + location.host + '/ws')
		} catch (e) {}
	})()
</script>
`)

export const renderer: MiddlewareHandler = async (c, next) => {
	c.setRenderer((content, head) =>
		c.html(html`<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1.0" />
					<title>${head.title}</title>
					<link rel="icon" href="/favicon.ico" sizes="any" />
					<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
					<link rel="stylesheet" href="/vendor/bulma.min.css" />
					<link rel="stylesheet" href="/css/global.css" />
				</head>
				<body>
					${navigation()}
					${content}
					${sharedClientScript}
					${head.scripts ?? ''}
				</body>
			</html>`),
	)
	await next()
}
