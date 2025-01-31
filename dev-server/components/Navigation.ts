import { h } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import { html } from 'htm/preact'

export function Navigation() {
	const [isActive, setActive] = useState(false)
	function activate() {
		console.error('working')
		setActive(!isActive)
	}

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
			<div class="navbar-start">
				<a class="navbar-item" href="/">Home</a>
				<a class="navbar-item" href="/services">Services</a>
				<a class="navbar-item" href="/lint">Lint</a>
				<a class="navbar-item" href="/repositories">Repositories</a>
			</div>

			<div class="navbar-end">
				<div class="navbar-item">
					<!-- <div class="buttons">
						<a class="button is-primary">
							<strong>Sign up</strong>
						</a>
						<a class="button is-light"> Log in </a>
					</div> -->
				</div>
			</div>
		</div>
	</nav>`
}
