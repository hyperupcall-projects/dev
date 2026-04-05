import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'
import path from 'node:path'

export default defineConfig({
	root: path.resolve(process.cwd(), 'start'),
	server: {
		port: 3000,
	},
	publicDir: path.resolve(process.cwd(), 'static'),
	plugins: [
		tanstackStart(),
		viteSolid({ ssr: true }),
	],
})
