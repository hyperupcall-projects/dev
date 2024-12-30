import { signal } from '@preact/signals'
import { Nav } from '#components/Nav.js'
import { execa } from 'execa'
import { html } from 'htm/preact'
import { useState } from 'preact/hooks'
import stripAnsi from 'strip-ansi'
import { getRepositoryConfig } from '#utilities/repositories.js'

export async function Server() {
	return {
		RepositoryConfig: await getRepositoryConfig(),
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
				<div style="display: grid; grid-template-columns: auto 1fr;">
					<aside>
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
