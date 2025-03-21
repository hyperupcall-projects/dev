import fs from 'node:fs/promises'
import path from 'node:path'
import * as v from 'valibot'

const DataFile = path.join(import.meta.dirname, '../../../.data/repo-destmaps.json')

export async function setRepoDestination(
	repoName: string,
	destinationName: string,
): Promise<boolean> {
	try {
		const json = JSON.parse(await fs.readFile(DataFile, 'utf-8'))
		json[repoName] = destinationName
		await fs.writeFile(DataFile, JSON.stringify(json, null, '\t'))
		return true
	} catch (err) {
		console.error(err)
		return false
	}
}

export async function setRepoDestinationAll(
	groupId: string,
	destinationName: string,
): Promise<boolean> {
	try {
		const json = JSON.parse(await fs.readFile(DataFile, 'utf-8'))
		for (const repoName in json) {
			if (repoName.startsWith(`${groupId}/`)) {
				json[repoName] = destinationName
			}
		}
		json[groupId] = destinationName
		await fs.writeFile(DataFile, JSON.stringify(json, null, '\t'))
		return true
	} catch (err) {
		console.error(err)
		return false
	}
}

export async function getRepoDestinationMaps() {
	const json = JSON.parse(await fs.readFile(DataFile, 'utf-8'))
	return json
}

const DataFile2 = path.join(import.meta.dirname, '../../../.data/repo-clonedirs.json')

export async function addRepoDestination(name: string, destination: string) {
	let json = [{ name: 'UNSET', destination: null }]
	try {
		json = JSON.parse(await fs.readFile(DataFile2, 'utf-8'))
	} catch (err) {
		if (err.code === 'ENOENT') {
			json = []
		} else {
			throw err
		}
	}
	json.push({ name, destination })

	await fs.writeFile(DataFile2, JSON.stringify(json, null, '\t'))
}

export async function removeRepoDestination(name: string, destination: string) {
	const json = JSON.parse(await fs.readFile(DataFile2, 'utf-8'))

	const index = json.findIndex(
		(item: { name: string; destination: string }) =>
			item.name === name && item.destination === destination,
	)

	if (index !== -1) {
		json.splice(index, 1)
		await fs.writeFile(DataFile2, JSON.stringify(json, null, '\t'))
	}
}

export async function getRepoDestinations() {
	const json = JSON.parse(await fs.readFile(DataFile2, 'utf-8'))
	return json
}
