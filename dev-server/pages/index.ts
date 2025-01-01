import { h } from 'preact'
import * as child_process from 'node:child_process'
import { useState, useCallback } from 'preact/hooks'
import { html } from 'htm/preact'
import { Nav } from '#components/Nav.ts'
import { execa } from 'execa'

function Counter() {
	const [value, setValue] = useState(0)
	const increment = useCallback(() => {
		setValue(value + 1)
	}, [value])

	return html`<div>
		<p>Counter: ${value}</p>
		<button class="button" onClick=${increment}>Increment</button>
	</div>`
}

export function Head() {
	return `<link rel="stylesheet" href="/vendor/bulma-v1.0.2/css/bulma.css" />`
}

export async function Server() {
	const [lsblkCommand, uptimeCommand] = await Promise.all([
		execa('lsblk'),
		execa('uptime', ['--pretty']),
	])

	return {
		lsblkOutput: lsblkCommand.stdout,
		uptimeOutput: uptimeCommand.stdout,
	}
}

export function Page({ lsblkOutput, uptimeOutput }) {
	return html`
		<div>
			<${Nav} />
			<div class="mx-1">
				<h1 class="title mb-0">Global Dev Server</h1>
				<pre>${lsblkOutput}</pre>
				<pre>${uptimeOutput}</pre>
				<p>My one-stop-shop for managing my computer and projects on my computer.</p>
				<hr />
				<${Counter} />
			</div>
		</div>
	`
}
