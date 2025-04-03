import { Navigation } from '#components/Navigation.ts'
import type { Sortable } from '@shopify/draggable'
import { html } from 'htm/preact'
import { Fragment } from 'preact'
import { useEffect, useRef } from 'preact/hooks'

export function Page() {
	const sortableRef = useRef(null)

	useEffect(() => {
		let sortable: Sortable | null = null
		import('@shopify/draggable').then(({ Sortable }) => {
			const containers = document.querySelectorAll('.StackedList')
			if (sortableRef.current === null) {
				console.log('NULL sortableRef')
				return
			}

			if (containers.length === 0) {
				return
			}

			sortable = new Sortable(containers, {
				draggable: '.StackedListItem',
				handle: '.StackedListHandle',
				mirror: {
					appendTo: sortableRef.current,
					constrainDimensions: true,
				},
			})
		})

		return () => {
			if (sortable) {
				sortable.destroy()
			}
		}
	}, [])

	const arr = ['A', 'B', 'C']
	const arr2 = ['C']

	return html`<${Fragment}>
		<${Navigation} />
		<h1 class="title mb-0">Edit Queries</h1>
		<p>
			Edit the list of project queries to include all desired projects for modification.
		</p>
		<hr class="mt-0 mb-2" />
		<div style="display: flex; gap: 24px;">
			<ul class="StackedList" ref=${sortableRef}>
				${arr.map((name) => {
					return html`<li class="StackedListItem">
						<div style="display: flex; align-items: center; gap: 4px;" class="m-2">
							<div
								class="StackedListHandle"
								style="height: 50px; width: 50px; background-color: lightgoldenrodyellow;"
							></div>
							<div>
								<p class="subtitle mb-0">${name}</p>
								<${Options} />
							</div>
						</div>
					</li>`
				})}
			</ul>
			<ul>
				${arr2.map((name) => {
					return html`<li>${name}</li>`
				})}
			</ul>
		</div>
	<//>`
}

function Options() {
	return html`<div>More Options</div>`
}
