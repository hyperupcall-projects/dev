import { h } from 'preact'
import { useCallback, useState } from 'preact/hooks'
import { html } from 'htm/preact'

export function Navigation() {
	const [isActive, setActive] = useState(false)

	return html`
		<nav
			class="navbar"
			role="navigation"
			aria-label="main navigation"
			style="border-bottom: 1px solid lightgray"
		>
			<div class="navbar-brand">
				<a
					role="button"
					class="navbar-burger"
					onClick="${() => setActive(!isActive)}"
					aria-label="menu"
					aria-expanded="false"
					data-target="navbarBasicExample"
				>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
				</a>
			</div>

			<div
				id="navbarBasicExample"
				class="${isActive ? 'navbar-menu is-active' : 'navbar-menu'}"
			>
				<div class="navbar-start has-dropdown">
					<a class="navbar-item" href="/">Home</a>
					<div class="navbar-item has-dropdown is-hoverable">
						<a href="/tools" class="navbar-item">Tools</a>

						<div class="navbar-dropdown">
							<a href="/tools/dictionary-watcher" class="navbar-item">Dictionary Watcher</a>
						</div>
					</div>
				</div>
			</div>
		</nav>
	`
}
