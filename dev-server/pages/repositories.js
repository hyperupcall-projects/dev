import { signal } from '@preact/signals'
import { Nav } from '#components/Nav.js'
import { execa } from 'execa'
import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { getCachedRepositoryConfig } from '#utilities/repositories.js'

export async function Server() {
	return {
		RepositoryConfig: await getCachedRepositoryConfig(),
	}
}

export function Page({ RepositoryConfig }) {
	const [selectedRepository, setSelectedRepository] = useState(
		RepositoryConfig.repositoryGroups[0].name,
	)
	const selectedRepositoryGroup = RepositoryConfig.repositoryGroups.find(
		(group) => group.name === selectedRepository,
	)
	function onClick(newName) {
		setSelectedRepository(newName)
	}
	return html`
		<div>
			<${Nav} />
			<div class="mx-1">
				<button
					class="button"
					onClick=${() => {
						fetch('/api/repositories/refresh', { method: 'POST' }).then(() => {
							alert('Done')
						})
					}}
				>
					Refresh Repository List
				</button>
				<div style="display: grid; grid-template-columns: 220px 1fr;">
					<aside
						style="border-inline-end: 1px solid lightgray; padding-inline-end: 2px; margin-inline-end: 2px;"
					>
						${RepositoryConfig.repositoryGroups.map((group) => {
							return group.name === selectedRepository
								? html`<b style="cursor: pointer" onClick=${() => onClick(group.name)}
										>${group.name}</b
									>`
								: html`<p style="cursor: pointer" onClick=${() => onClick(group.name)}>
										${group.name}
									</p>`
						})}
					</aside>
					<div>
						<ul>
							${selectedRepositoryGroup.repositories.map((repo) => {
								return html`<li>${repo}</li>`
							})}
						</ul>
					</div>
				</div>
			</div>
		</div>
	`
}
