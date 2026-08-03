import htm from 'htm'

const voidElements = new Set([
	'area',
	'base',
	'br',
	'col',
	'embed',
	'hr',
	'img',
	'input',
	'link',
	'meta',
	'param',
	'source',
	'track',
	'wbr',
])

/** Already-rendered HTML — not escaped when nested in another template. */
export class Html {
	readonly value: string
	constructor(value: string) {
		this.value = value
	}
	toString() {
		return this.value
	}
}

export function raw(value: string): Html {
	return new Html(value)
}

function escape(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
}

function serialize(child: unknown): string {
	if (child == null || child === false || child === true) return ''
	if (child instanceof Html) return child.value
	if (Array.isArray(child)) return child.map(serialize).join('')
	if (typeof child === 'number') return String(child)
	return escape(String(child))
}

function h(
	type: string | ((props: Record<string, unknown>) => unknown),
	props: Record<string, unknown> | null,
	...children: unknown[]
): Html {
	if (typeof type === 'function') {
		return new Html(serialize(type({ ...(props ?? {}), children })))
	}

	let attrs = ''
	if (props) {
		for (const [key, value] of Object.entries(props)) {
			if (value == null || value === false) continue
			const name = key === 'className' ? 'class' : key
			if (value === true) attrs += ` ${name}`
			else attrs += ` ${name}="${escape(String(value))}"`
		}
	}

	if (voidElements.has(type)) {
		return new Html(`<${type}${attrs}>`)
	}

	return new Html(`<${type}${attrs}>${children.map(serialize).join('')}</${type}>`)
}

export const html = htm.bind(h)

export function render(node: Html | string): string {
	return typeof node === 'string' ? node : node.value
}
