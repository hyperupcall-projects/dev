import { createSignal, For, onCleanup, onMount } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { getServiceData, launchServiceTerminal } from '#utilities/util.ts'
import { Navigation } from '../components/Navigation'

const getServicesData = createServerFn({ method: 'GET' }).handler(async () => {
	return { services: await getServiceData() }
})

const launchTerminalAction = createServerFn({ method: 'POST' })
	.inputValidator((data: unknown) => data as { service: string; action: 'status' | 'journal' })
	.handler(async ({ data }) => {
		return launchServiceTerminal(data.service, data.action)
	})

export const Route = createFileRoute('/services')({
	component: ServicesPage,
	loader: () => getServicesData(),
})

type ServiceInfo = {
	name: string
	isActive: boolean
	activeState: string
}

function ServiceActionsDropdown(props: { service: ServiceInfo }) {
	const [isOpen, setIsOpen] = createSignal(false)
	let dropdownRef: HTMLDivElement | undefined

	onMount(() => {
		const handleOutsideClick = (e: MouseEvent) => {
			if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('click', handleOutsideClick)
		onCleanup(() => document.removeEventListener('click', handleOutsideClick))
	})

	const handleAction = async (action: 'status' | 'journal') => {
		setIsOpen(false)
		try {
			await launchTerminalAction({ data: { service: props.service.name, action } })
		} catch (e) {
			// eslint-disable-next-line no-alert
			alert(`Failed to launch terminal: ${e instanceof Error ? e.message : String(e)}`)
		}
	}

	return (
		<div class={`dropdown${isOpen() ? ' is-active' : ''}`} ref={dropdownRef}>
			<div class="dropdown-trigger">
				<button
					type="button"
					class="button is-small"
					aria-haspopup="true"
					aria-controls={`dropdown-menu-${props.service.name}`}
					onClick={(e: MouseEvent) => {
						e.stopPropagation()
						setIsOpen(!isOpen())
					}}
				>
					<span>Actions</span>
					<span class="icon is-small" aria-hidden="true">▾</span>
				</button>
			</div>
			<div
				class="dropdown-menu"
				id={`dropdown-menu-${props.service.name}`}
				role="menu"
			>
				<div class="dropdown-content">
					<button
						type="button"
						class="dropdown-item button is-ghost has-text-left"
						style="width: 100%; justify-content: flex-start; border: none; box-shadow: none;"
						onClick={() => handleAction('status')}
					>
						<span class="icon is-small mr-1">🖥</span>
						Status in Terminal
					</button>
					<button
						type="button"
						class="dropdown-item button is-ghost has-text-left"
						style="width: 100%; justify-content: flex-start; border: none; box-shadow: none;"
						onClick={() => handleAction('journal')}
					>
						<span class="icon is-small mr-1">📋</span>
						Journal (follow)
					</button>
				</div>
			</div>
		</div>
	)
}

function ServicesPage() {
	console.log('test')
	const data = Route.useLoaderData()

	return (
		<div>
			<Navigation />
			<div class="p-4">
				<h1 class="title mb-1">Services</h1>
				<p class="subtitle is-6 mb-4">User-level systemd services</p>
				<table class="table is-fullwidth is-striped is-hoverable">
					<thead>
						<tr>
							<th>Name</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<For each={data().services}>
							{(service) => (
								<tr>
									<td style="vertical-align: middle;">
										<code>{service.name}</code>
									</td>
									<td style="vertical-align: middle;">
										<span
											class={`tag is-medium${service.isActive ? ' is-success' : ' is-danger'}`}
										>
											{service.activeState}
										</span>
									</td>
									<td style="vertical-align: middle;">
										<ServiceActionsDropdown service={service} />
									</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</div>
		</div>
	)
}
