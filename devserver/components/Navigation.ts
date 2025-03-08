import { h } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import { html } from 'htm/preact'

export function Navigation() {
	const [isActive, setActive] = useState(false)

	return html`<nav
		class="navbar"
		role="navigation"
		aria-label="main navigation"
		style="border-bottom: 1px solid lightgray"
	>
		<div class="navbar-brand">
			<a
				role="button"
				class="navbar-burger"
				onClick=${() => setActive(!isActive)}
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
				<a class="navbar-item" href="/services">Services</a>
				<div class="navbar-item has-dropdown is-hoverable">
					<a href="/repositories" class="navbar-link">Repositories</a>

					<div class="navbar-dropdown">
						<a href="/repositories/settings" class="navbar-item">Settings</a>
					</div>
				</div>
			</div>
		</div>
	</nav>`
}
