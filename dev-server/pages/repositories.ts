import { signal } from '@preact/signals'
import { Nav } from '#components/Nav.ts'
import { execa } from 'execa'
import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import { getCachedRepositoryConfig } from '#utilities/repositories.ts'
import type { ClonedReposConfig } from '#utilities/repositories.ts'

export async function Server() {
	return {
		repositoryConfig: await getCachedRepositoryConfig(),
	}
}

export function Page({ repositoryConfig }: { repositoryConfig: ClonedReposConfig }) {
	const [selectedRepository, setSelectedRepository] = useState(
		repositoryConfig.repositoryGroups[0].name,
	)
	const selectedRepositoryGroup = repositoryConfig.repositoryGroups.find(
		(group) => group.name === selectedRepository,
	)
	function onClick(newName: string) {
		setSelectedRepository(newName)
	}
	function cloneAll() {}
	function openRepository(repository: string) {
		const [owner, name] = repository.split('/')
		fetch('/api/repositories/')
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
						${repositoryConfig.repositoryGroups.map((group) => {
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
						<button class="button" onClick=${cloneAll}>Clone All</button>
						<hr />
						<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
							${selectedRepositoryGroup.repositories.map((repo) => {
								return html`
									<div style="border: 1px solid lightgray;">
										<h3 class="title is-5 mb-1">${repo}</h3>
										<button class="button is-primary mr-1" onClick=${() => openRepository(repo)}>Open</button>
										<button class="button">Clone</button>
										<p>Behind 1 ahead 2</p>

								</li>`
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	`
}
