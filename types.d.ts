declare global {
	var skipTerminalCleanup: boolean
	var ws: WebSocket
}

export type FormatConfig = {
	filetypes?: Record<string, string | false>
}

export type ToolConfig = {
	filetypes: string[]
	run: string[]
}

export type ManifestConfig = {
	package_json_author: string
	package_json_publisher: string
	funding_yml_github: string
}

// Fix.
export type Config = {
	fullname: string
	public_email: string
	website: string
	manifest: ManifestConfig
	formatters: Record<string, ToolConfig>
	linters: Record<string, ToolConfig>
	rules?: Record<string, 'off'>
	updateVersionDirectories?: string[]
	format?: FormatConfig
}

// Individual files contain partial overrides; loadConfig returns a complete Config.
export type ConfigFile = Partial<Omit<Config, 'manifest' | 'formatters' | 'linters'>> & {
	manifest?: Partial<ManifestConfig>
	formatters?: Record<string, Partial<ToolConfig>>
	linters?: Record<string, Partial<ToolConfig>>
}

export type Project =
	| {
			type: 'only-directory'
			rootDir: string
			name: string
	  }
	| {
			type: 'with-vcs'
			rootDir: string
			name: string
			branchName: string
	  }
	| {
			type: 'with-remotevcs'
			rootDir: string
			name: string
			branchName: string
			remoteName: string
			remoteUrl: string
			owner: string
	  }

export type Issues = (arg0: { project: Project; config: Config }) => AsyncGenerator<Issue>

export type Issue =
	| {
			id: string
			message: string | string[]
			fix?: (() => void) | (() => Promise<void>)
			strict?: boolean
			skip?: false
	  }
	| { skip: true; message: string }
