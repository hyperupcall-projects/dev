import { renderToString } from 'preact-render-to-string'
import { h } from 'preact'

export function Layout(pagePath, Page, imports, serverData) {
	const content = renderToString(h(() => Page(serverData.data ?? {}), {}))

	return `<!DOCTYPE html>
		<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Site</title>
				<script type="importmap">
					{
						"imports": ${imports}
					}
				</script>
				<script type="module">
					import { h, hydrate, render } from "preact";
					import { Page } from "${pagePath}";
					fetch((new URL(document.URL)).pathname, { method: "POST" })
						.then((res) => res.json())
						.then((json) => {
							hydrate(
								h(() => Page(json.data), {}),
								document.querySelector("body")
							);
						});
				</script>
				${serverData.head ? serverData.head : ''}
			</head>
			<body>
				${content ? content : ''}
			</body>
		</html>`
}
