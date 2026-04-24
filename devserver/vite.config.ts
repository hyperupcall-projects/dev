import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'
import path from 'node:path'

export default defineConfig({
	server: {
		port: Number(process.env.PORT) || 3000,
	},
	preview: {
		port:Number(process.env.PORT) || 4173,
	},
	publicDir: path.resolve(process.cwd(), 'static'),
	plugins: [
		tanstackStart(),
		viteSolid({ ssr: true }),
	],
})
