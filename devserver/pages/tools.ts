import { html } from 'htm/preact'
import { useEffect, useState } from 'preact/hooks'
import type { PageSchemaT } from './tools.server.ts'
import { Fragment } from 'preact'
import { Navigation } from '#components/Navigation.ts'

export function Page({}: PageSchemaT) {
	return html`
		<${Fragment}>
			<${Navigation} />
			<h1>Tools</h1>
		<//>
		`
}
