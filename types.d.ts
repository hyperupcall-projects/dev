declare global {
	var skipTerminalCleanup: boolean
	var ws: WebSocket
}

export type FormatConfig = {
	filetypes?: Record<string, string | false>
}

// Fix.
export type Config = {
	rules?: Record<string, 'off'>
	updateVersionDirectories?: string[]
	format?: FormatConfig
}
export type Project =
	| {
			type: 'only-directory'
			rootDir: string
			name: string
	  }
	| {
			type: 'under-version-control'
			rootDir: string
			name: string
			branchName: string
	  }
	| {
			type: 'with-remote-url'
			rootDir: string
			name: string
			branchName: string
			remoteName: string
			remoteUrl: string
			owner: string
	  }

export type Issues = (arg0: {
	project: Project
	config: {
		projectSize: 'small' | 'large'
		ignoredChecks: string[]
	}
}) => AsyncGenerator<Issue>

export type Issue = {
	id: string
	message: string | string[]
	fix?: (() => void) | (() => Promise<void>)
	strict?: boolean
	skip?: string
}
