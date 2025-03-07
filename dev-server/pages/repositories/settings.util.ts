import path from 'node:path'
import fs from 'node:fs/promises'

export type RepoDestinations = {
	name: string
	destination: string
}[]

const dataFile = path.join(import.meta.dirname, '../../../.data/repo-destinations.json')

export async function addRepoDestination(name: string, destination: string) {
	let json = []
	try {
		json = JSON.parse(await fs.readFile(dataFile, 'utf-8'))
	} catch (err) {
		if (err.code === 'ENOENT') {
			json = []
		} else {
			throw err
		}
	}
	json.push({ name, destination })

	await fs.writeFile(dataFile, JSON.stringify(json, null, '\t'))
}

export async function removeRepoDestination(name: string, destination: string) {
	const json = JSON.parse(await fs.readFile(dataFile, 'utf-8'))

	const index = json.findIndex(
		(item: { name: string; destination: string }) =>
			item.name === name && item.destination === destination,
	)

	if (index !== -1) {
		json.splice(index, 1)
		await fs.writeFile(dataFile, JSON.stringify(json, null, '\t'))
	}
}

export async function getRepoDestinations() {
	const json = JSON.parse(await fs.readFile(dataFile, 'utf-8'))
	return json
}
