import { html, raw, render, type Html } from './html.ts'

function navigation(): Html {
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
					<a class="navbar-item" href="/computer">🗃️ Computer</a>
					<a class="navbar-item" href="/knowledge">🧠 Knowledge Manager</a>
					<a class="navbar-item" href="/activity">📁 Project Manager</a>
					<a class="navbar-item" href="/projects">💻 SW Project Manager</a>
					<a class="navbar-item" href="/services">⚙️ Service Manager</a>
					<a class="navbar-item" href="/dictionary">📖 Dictionary Manager</a>
					<div class="navbar-item has-dropdown is-hoverable" id="nav-apis">
						<a class="navbar-link" href="#" id="nav-apis-link">🔌 APIs</a>
						<div class="navbar-dropdown">
							<a class="navbar-item" href="/apis/blocklists">Blocklists</a>
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
		var apis = document.getElementById('nav-apis')
		var apisLink = document.getElementById('nav-apis-link')
		if (apis && apisLink) {
			apisLink.addEventListener('click', function (event) {
				event.preventDefault()
				apis.classList.toggle('is-active')
			})
		}
		try {
			var protocol = location.protocol === 'https:' ? 'wss' : 'ws'
			window.ws = new WebSocket(protocol + '://' + location.host + '/ws')
		} catch (e) {}
	})()
</script>
`)

export function page(options: {
	title: string
	body: Html | string
	scripts?: Html | string
}): Response {
	const document = html`
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>${options.title}</title>
				<link rel="icon" href="/favicon.ico" sizes="any" />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<link rel="stylesheet" href="/vendor/bulma.min.css" />
				<link rel="stylesheet" href="/css/global.css" />
			</head>
			<body>
				${navigation()}
				${options.body}
				${sharedClientScript}
				${options.scripts ?? ''}
			</body>
		</html>
	`

	return new Response(`<!DOCTYPE html>${render(document)}`, {
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	})
}
