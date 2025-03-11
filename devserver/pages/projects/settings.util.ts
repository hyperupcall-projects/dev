import fs from 'node:fs/promises'
import path from 'node:path'

const dataFile = path.join(import.meta.dirname, '../../../.data/repo-destmaps.json')

export async function setRepoDestination(
	repoName: string,
	destinationName: string,
): Promise<boolean> {
	try {
		const json = JSON.parse(await fs.readFile(dataFile, 'utf-8'))
		json[repoName] = destinationName
		await fs.writeFile(dataFile, JSON.stringify(json, null, '\t'))
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
		const json = JSON.parse(await fs.readFile(dataFile, 'utf-8'))
		for (const repoName in json) {
			if (repoName.startsWith(`${groupId}/`)) {
				json[repoName] = destinationName
			}
		}
		json[groupId] = destinationName
		await fs.writeFile(dataFile, JSON.stringify(json, null, '\t'))
		return true
	} catch (err) {
		console.error(err)
		return false
	}
}

export async function getRepoDestinationMaps() {
	const json = JSON.parse(await fs.readFile(dataFile, 'utf-8'))
	return json
}
