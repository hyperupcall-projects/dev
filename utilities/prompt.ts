const decoder = new TextDecoder()
const encoder = new TextEncoder()

async function write(text: string): Promise<void> {
	await Deno.stdout.write(encoder.encode(text))
}

async function readLine(): Promise<string> {
	const buffer = new Uint8Array(1024)
	let line = ""
	while (true) {
		const n = await Deno.stdin.read(buffer)
		if (n === null) break
		const chunk = decoder.decode(buffer.subarray(0, n))
		for (const char of chunk) {
			const code = char.charCodeAt(0)
			if (code === 10) { // \n
				return line
			}
			if (code === 13) { // \r
				continue
			}
			line += String.fromCharCode(code)
		}
	}
	return line
}

function clearLine(): void {
	Deno.stdout.writeSync(encoder.encode("\x1b[2K\r"))
}

function moveUp(lines: number): void {
	Deno.stdout.writeSync(encoder.encode(`\x1b[${lines}A`))
}

export interface InputOptions {
	message?: string
	default?: string
	validate?: (value: string) => string | boolean
}

export async function input(options: InputOptions = {}): Promise<string> {
	const { message = "Input:", default: defaultValue = "", validate } = options

	let value = ""
	let isValid = true
	let errorMessage = ""

	do {
		const promptText = defaultValue
			? `${message} [${defaultValue}]: `
			: `${message}: `
		await write(promptText)

		const line = await readLine()
		value = line.trim() || defaultValue

		if (validate) {
			const result = validate(value)
			if (result !== true) {
				isValid = false
				errorMessage = typeof result === "string" ? result : "Invalid input"
				await write(`\x1b[31m${errorMessage}\x1b[0m\n`)
			} else {
				isValid = true
			}
		}
	} while (!isValid)

	return value
}

export interface ConfirmOptions {
	message?: string
	default?: boolean
}

export async function confirm(options: ConfirmOptions = {}): Promise<boolean> {
	const { message = "Confirm:", default: defaultValue = false } = options

	const defaultText = defaultValue ? "Y/n" : "y/N"
	let value: boolean | null = null

	while (value === null) {
		await write(`${message} [${defaultText}]: `)
		const line = (await readLine()).trim().toLowerCase()

		if (line === "") {
			value = defaultValue
		} else if (line === "y" || line === "yes") {
			value = true
		} else if (line === "n" || line === "no") {
			value = false
		} else {
			await write('\x1b[31mPlease enter "y" or "n"\x1b[0m\n')
		}
	}

	return value
}

export interface SelectOption<T extends string = string> {
	name: string
	value: T
	description?: string
	disabled?: boolean
}

export interface SelectOptions<T extends string = string> {
	message?: string
	options: SelectOption<T>[]
	default?: T
}

export async function select<T extends string = string>(
	options: SelectOptions<T>,
): Promise<T> {
	const { message = "Select:", options: optList, default: defaultValue } = options

	const availableOptions = optList.filter((o) => !o.disabled)

	if (availableOptions.length === 0) {
		throw new Error("No available options")
	}

	await write(`${message}\n`)
	for (let i = 0; i < availableOptions.length; i++) {
		const opt = availableOptions[i]
		const isDefault = defaultValue !== undefined && opt.value === defaultValue
		await write(`  ${i + 1}. ${opt.name}${isDefault ? " (default)" : ""}\n`)
	}

	let selectedIndex = 0
	let isValid = false

	while (!isValid) {
		await write(`Enter a number (1-${availableOptions.length}): `)
		const line = (await readLine()).trim()

		if (line === "") {
			if (defaultValue !== undefined) {
				const idx = availableOptions.findIndex((o) => o.value === defaultValue)
				if (idx !== -1) {
					selectedIndex = idx
					isValid = true
				}
			}
		} else {
			const num = parseInt(line, 10)
			if (!isNaN(num) && num >= 1 && num <= availableOptions.length) {
				selectedIndex = num - 1
				isValid = true
			} else {
				await write('\x1b[31mInvalid selection\x1b[0m\n')
			}
		}
	}

	return availableOptions[selectedIndex].value
}

export interface SearchOptions<T extends string = string> {
	message?: string
	options: SelectOption<T>[]
	default?: T
	search?: boolean
	source?: (input: string) => Promise<SelectOption<T>[]>
}

export async function search<T extends string = string>(
	options: SearchOptions<T>,
): Promise<T> {
	const { message = "Search:", options: optList, default: defaultValue } = options

	const availableOptions = optList.filter((o) => !o.disabled)

	if (availableOptions.length === 0) {
		throw new Error("No available options")
	}

	await write(`${message}\n`)
	for (let i = 0; i < availableOptions.length; i++) {
		const opt = availableOptions[i]
		const isDefault = defaultValue !== undefined && opt.value === defaultValue
		await write(`  ${i + 1}. ${opt.name}${isDefault ? " (default)" : ""}\n`)
	}

	let selectedIndex = 0
	let isValid = false

	while (!isValid) {
		await write(`Enter a number (1-${availableOptions.length}): `)
		const line = (await readLine()).trim()

		if (line === "") {
			if (defaultValue !== undefined) {
				const idx = availableOptions.findIndex((o) => o.value === defaultValue)
				if (idx !== -1) {
					selectedIndex = idx
					isValid = true
				}
			}
		} else {
			const num = parseInt(line, 10)
			if (!isNaN(num) && num >= 1 && num <= availableOptions.length) {
				selectedIndex = num - 1
				isValid = true
			} else {
				await write('\x1b[31mInvalid selection\x1b[0m\n')
			}
		}
	}

	return availableOptions[selectedIndex].value
}
