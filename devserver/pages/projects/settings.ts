import { html } from 'htm/preact'
import { Fragment } from 'preact'
import { useRef, useState } from 'preact/hooks'
import type { JSX, VNode } from 'preact'

import { Navigation } from '#components/Navigation.ts'
import type { RepoDetails, RepoGroups } from '#utilities/repositories.ts'
import type { RepoDestMaps, RepoDests } from '#pages/projects/settings.server.ts'

export function Page({
	repoGroups,
	repoDestinations: repoDestinationsInitial,
	repoDestinationMaps,
}: {
	repoGroups: RepoGroups
	repoDestinations: RepoDests[]
	repoDestinationMaps: RepoDestMaps
}) {
	const [tab, setTab] = useState('destinations-list')

	return html`<div style="display: grid; grid-template-rows: auto 1fr; height: 100%;">
		<${Navigation} />
		<div
			class="p-1"
			style="display: grid; grid-template-rows: auto auto auto auto 1fr; height: 100%"
		>
			<div class="tabs mb-0">
				<ul>
					<li
						class="${tab === 'destinations-list' ? 'is-active' : ''}"
						onClick=${() => setTab('destinations-list')}
					>
						<a>Clone Destinations</a>
					</li>
					<li
						class="${tab === 'repo-destination-mapping' ? 'is-active' : ''}"
						onClick=${() => setTab('repo-destination-mapping')}
					>
						<a>Repository Destination Mapping</a>
					</li>
				</ul>
			</div>
			${tab === 'destinations-list'
				? html`<${EditRepoDestinationsList}
						repoDestinations=${repoDestinationsInitial}
					/>`
				: ''}
			${tab === 'repo-destination-mapping'
				? html`<${EditRepoDestinationsMap}
						repoGroups=${repoGroups}
						repoDests=${repoDestinationsInitial}
						repoDestMaps=${repoDestinationMaps}
					/>`
				: ''}
		</div>
		<div></div>
	</div>`
}

export function EditRepoDestinationsList({
	repoDestinations: repoDestinationsInitial,
	show,
	setShow,
}: {
	repoDestinations: RepoDests
	show: boolean
	setShow: (show: boolean) => void
}) {
	const [formName, setFormName] = useState('')
	const [formDirectory, setFormDirectory] = useState('')
	const [repoDestinations, setRepoDestinations] = useState(repoDestinationsInitial)

	return html`<div>
		<h1 class="title mb-0">Configure Clone Destinations</h1>
		<p>Configure the possible directories that your repositories can be cloned to.</p>
		<hr class="my-1" />

		<form method="" class="mb-2" style="display: flex; gap: 2px; align-items: flex-end;">
			<label name="name" style="display: flex; flex-direction: column">
				Name
				<input
					class="input"
					type="text"
					onInput=${(ev) => setFormName(ev.currentTarget.value)}
				/>
			</label>
			<label name="directory" style="display: flex; flex-direction: column">
				Directory
				<input
					class="input"
					type="text"
					onInput=${(ev) => setFormDirectory(ev.currentTarget.value)}
				/>
			</label>
			<input
				type="button"
				class="button is-info"
				style="height: 100%;"
				onClick=${async () => {
					await addDestination()
					refreshDestinations()
				}}
				value="Add Destination"
			/>
		</form>
		<table class="table mb-2">
			<thead>
				<tr>
					<th>Name</th>
					<th>Directory</th>
					<th>Action</th>
				</tr>
			</thead>
			<tbody>
				${repoDestinations.map(({ name, destination }) => {
					return html`<tr>
						<td>${name}</td>
						<td>${destination}</td>
						<td>
							<button
								class="button is-danger"
								onClick=${async () => {
									await removeDestination(name, destination)
									refreshDestinations()
								}}
							>
								Delete
							</button>
						</td>
					</tr>`
				})}
			</tbody>
		</table>
		<hr class="mt-2 mb-4" />
		<button class="button is-primary" onClick=${() => setShow(false)}>Close</button>
	</div>`

	async function addDestination() {
		if (!formName || !formDirectory) {
			alert('Name and Directory must both be non-empty')
			return
		}

		await fetch('/api/projects/add-destination', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: formName,
				destination: formDirectory,
			}),
		})
	}

	async function removeDestination(name: string, destination: string) {
		await fetch('/api/projects/remove-destination', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				name: name,
				destination: destination,
			}),
		})
	}

	function refreshDestinations() {
		fetch('/api/projects/list-destinations', { method: 'POST' })
			.then((response) => response.json())
			.then((destinations) => {
				setRepoDestinations(destinations)
			})
	}
}

export function EditRepoDestinationsMap({
	repoGroups,
	repoDests,
	repoDestMaps,
}: {
	repoGroups: RepoGroups
	repoDests: RepoDests
	repoDestMaps: RepoDestMaps
}) {
	return html`<${Fragment}>
		<h1 class="title mb-0">Repository Destination Mapping</h1>
		<p>Choose the directories that your repositories will be cloned to.</p>
		<hr class="mt-1 mb-2" />
		<${DisplayRepository}
			repoGroups=${repoGroups}
			repoDests=${repoDests}
			repoDestMaps=${repoDestMaps}
			displayOrg=${({ groupId }: { groupId: string }) => {
				return html`<div class="m-2">
					<p>Write destination for all repositories in organization ${groupId}</p>
					<label>
						Choose a destination${' '}
						<div class="select is-small">
							<select onChange=${(ev) => onChange(ev, groupId)}>
								${repoDests.map((item) => {
									return html`<option
										value=${item.name}
										selected=${repoDestMaps?.[groupId] === item.name}
									>
										${item.name}
									</option>`
								})}
							</select>
						</div>
					</label>
					<hr class="my-2" />
				</div>`

				function onChange(ev, groupId: string) {
					const newDest = (ev.target as HTMLSelectElement).value
					fetch('/api/projects/set-repo-destination-all', {
						method: 'POST',
						body: JSON.stringify({ groupId, destinationName: newDest }),
						headers: {
							'Content-Type': 'application/json',
						},
					})
				}
			}}
			displayComponent=${({ fullName }: { fullName: string }) => {
				return html`<div class="m-2 p-1" style="border: 1px solid gray; height: 100%">
					<div><b>${fullName}</b></div>
					<label>
						Choose a destination:${' '}
						<div class="select is-small">
							<select onChange=${(ev) => onChange(ev, fullName)}>
								${repoDests.map((item) => {
									return html`<option
										value=${item.name}
										selected=${repoDestMaps?.[fullName] === item.name}
									>
										${item.name}
									</option>`
								})}
							</select>
						</div>
					</label>
				</div>`

				function onChange(ev, fullName: string) {
					const newDest = (ev.target as HTMLSelectElement).value
					fetch('/api/projects/set-repo-destination', {
						method: 'POST',
						body: JSON.stringify({ repoName: fullName, destinationName: newDest }),
						headers: {
							'Content-Type': 'application/json',
						},
					})
				}
			}}
		/>
	</${Fragment}>`
}

function DisplayRepository({
	repoGroups,
	repoDests,
	repoDestMaps,
	displayComponent,
	displayOrg,
}: {
	repoGroups: RepoGroups
	repoDests: RepoDests
	repoDestMaps: RepoDestMaps
	displayComponent: VNode
	displayOrg: VNode
}) {
	const [curRepoGroupId, setCurRepoGroupId] = useState(repoGroups[0].groupId)
	const curRepoGroup = repoGroups.find(({ groupId }) => groupId === curRepoGroupId) ?? {
		repos: [],
	}

	return html`<div
		style="display: grid; grid-template-columns: 230px 1fr; gap: 4px; padding-block-end: 4px; height: 100%;"
	>
		<aside
			class="p-1"
			style="background-color: lavender; border-radius: 4px; margin-block-start: 4px; margin-inline-start: 4px;"
		>
			${repoGroups.map(({ groupName, groupId, repos }) => {
				return groupId === curRepoGroupId
					? html`<b
							class="hover-bold"
							style="cursor: pointer"
							onClick=${() => setCurRepoGroupId(groupId)}
							>${groupName}</b
						>`
					: html`<p
							class="hover-bold"
							style="cursor: pointer"
							onClick=${() => setCurRepoGroupId(groupId)}
						>
							${groupName}
						</p>`
			})}
		</aside>
		<div style="height: 100%; position: relative;">
			<div
				class="pr-1"
				style="display: flex; flex-direction: column; gap: 4px; padding-block-start: 4px; position: absolute; inset: 0; overflow: auto;"
			>
				<${displayOrg} orgName=${curRepoGroup.groupId} />
				<div style="display: flex; flex-direction: column;">
					${curRepoGroup.repos.map((fullName) => {
						return html`<${displayComponent} fullName=${fullName} />`
					})}
				</div>
			</div>
		</div>
	</div>`
}
