import type { Express } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'

export function Api(app: Express) {
	app.get('/api/services', async (req, res) => {
		const serviceData = await getServiceData()
		res.json(serviceData)
	})
}
