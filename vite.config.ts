import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from 'vite-plugin-solid'
import path from 'node:path'

export default defineConfig({
	root: path.resolve(process.cwd(), 'devserver/start'),
	server: {
		port: 3000,
	},
	publicDir: path.resolve(process.cwd(), 'devserver/static'),
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tanstackStart(),
		viteSolid({ ssr: true }),
	],
})
