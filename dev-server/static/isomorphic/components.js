import { h } from 'preact'
import { useState, useCallback } from 'preact/hooks'
import { html } from 'htm/preact'

export function Nav() {
	const [isActive, setActive] = useState(false)
	function activate() {
		console.log('working')
		setActive(!isActive)
	}
	return html`<nav class="navbar" role="navigation" aria-label="main navigation">
		<div class="navbar-brand">
			<a class="navbar-item">
				<b>Dev</b>
			</a>

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
