import { html } from 'htm/preact'
import { Fragment } from 'preact'
import { useRef, useState } from 'preact/hooks'

import { Navigation } from '#components/Navigation.ts'
import type { RepoDetails, RepoGroups } from '#utilities/repositories.ts'
import type { RepoDestinations } from '#pages/repositories/settings.util.ts'

export async function Server() {
	const [
		{ getCachedRepositoryGroups, getCachedRepositoryDetails },
		{ getRepoDestinations },
	] = await Promise.all([
		import('#utilities/repositories.ts'),
		import('#pages/repositories/settings.util.ts'),
	])

	const [repoGroups, repoDetails, repoDestinations] = await Promise.all([
		getCachedRepositoryGroups(),
		getCachedRepositoryDetails(),
		getRepoDestinations(),
	])

	return {
		repoGroups,
		repoDetails,
		repoDestinations,
	}
}

export function Page({
	repoGroups,
	repoDestinations: repoDestinationsInitial,
}: {
	repoGroups: RepoGroups
	repoDestinations: RepoDestinations[]
}) {
	const [tab, setTab] = useState('destinations-list')

	return html`<div>
		<${Navigation} />
		<div class="p-1">
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
				? html`<${DestinationsList} repoDestinations=${repoDestinationsInitial} />`
				: ''}
			${tab === 'repo-destination-mapping'
				? html`<${RepoDestMapping} repoGroups=${repoGroups} />`
				: ''}
		</div>
	</div>`
}

export function DestinationsList({
	repoDestinations: repoDestinationsInitial,
	show,
	setShow,
}: {
	repoDestinations: RepoDestinations
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

		await fetch('/api/repositories/add-destination', {
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
		await fetch('/api/repositories/remove-destination', {
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
		fetch('/api/repositories/list-destinations', { method: 'POST' })
			.then((response) => response.json())
			.then((destinations) => {
				setRepoDestinations(destinations)
			})
	}
}

export function RepoDestMapping({ repoGroups }: { repoGroups: RepoGroups }) {
	const [curGroupId, setCurGroupId] = useState<string | null>(null)

	return html`<div>
		<h1 class="title mb-0">Repository Destination Mapping</h1>
		<p>Choose the directories that your repositories will be cloned to.</p>
		<hr class="mt-1 mb-2" />
		<div style="display: flex;">
			<div>
				<ul>
					${repoGroups.map(({ groupName, groupId }) => {
						return html`<li
							style="cursor: hover; ${groupId === curGroupId ? 'font-weight: bold;' : ''}"
							onClick=${() => setCurGroupId(groupId)}
						>
							${groupName}
						</li>`
					})}
				</ul>
			</div>
			<div>
				<ul>
					${repoGroups
						.find(({ groupId }) => groupId === curGroupId)
						?.repos.map((repo) => {
							return html`<li>${repo}</li>`
						})}
				</ul>
			</div>
		</div>
	</div>`
}
