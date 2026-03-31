import { createSignal } from 'solid-js'

export function Navigation() {
	const [isActive, setIsActive] = createSignal(false)

	return (
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
					onClick={() => setIsActive(!isActive())}
					aria-label="menu"
					aria-expanded="false"
					data-target="navbarBasicExample"
				>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
					<span aria-hidden="true"></span>
				</button>
			</div>

			<div id="navbarBasicExample" class={isActive() ? 'navbar-menu is-active' : 'navbar-menu'}>
				<div class="navbar-start has-dropdown">
					<a class="navbar-item" href="/">Home</a>
					<a class="navbar-item" href="/catalogs">Catalogs</a>
					<div class="navbar-item has-dropdown is-hoverable">
						<a href="/tools" class="navbar-item">Tools</a>
						<div class="navbar-dropdown">
							<a href="/tools/dictionary-watcher" class="navbar-item">Dictionary Watcher</a>
						</div>
					</div>
				</div>
			</div>
		</nav>
	)
}
