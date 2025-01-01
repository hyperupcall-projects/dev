import { Nav } from '#components/Nav.ts'
import { execa } from 'execa'
import { html } from 'htm/preact'
import stripAnsi from 'strip-ansi'

export async function Server() {
	const [devCommand] = await Promise.all([
		execa('dev', ['lint', '/home/edwin/Documents/Programming/bookmark-manager']).catch(
			(err) => err,
		),
	])

	return {
		devCommand: stripAnsi(devCommand.stdout),
	}
}

export function Page({ devCommand }) {
	return html`
		<div>
			<${Nav} />
			<div class="mx-1">
				<pre>${devCommand}</pre>
			</div>
		</div>
	`
}
