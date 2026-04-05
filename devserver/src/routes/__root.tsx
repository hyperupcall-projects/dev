import 'bulma/css/bulma.css'
import * as Solid from 'solid-js'
import { onMount } from 'solid-js'
import {
	HeadContent,
	Outlet,
	Scripts,
	createRootRoute,
} from '@tanstack/solid-router'
import { HydrationScript } from 'solid-js/web'

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1.0',
			},
		],
		links: [
			{ rel: 'stylesheet', href: '/css/global.css' },
		],
	}),
	component: RootComponent,
})

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	)
}

function RootDocument(props: Readonly<{ children: Solid.JSX.Element }>) {
	onMount(() => {
		const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
		try {
			;(globalThis as typeof globalThis & { ws?: WebSocket }).ws = new WebSocket(wsUrl)
		} catch {
			// Keep app functional even if websocket endpoint is unavailable.
		}
	})

	return (
		<html>
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body>
				<Solid.Suspense>{props.children}</Solid.Suspense>
				<Scripts />
			</body>
		</html>
	)
}
