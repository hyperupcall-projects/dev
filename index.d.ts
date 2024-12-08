declare global {
	var skipTerminalCleanup: boolean
}

export type CommandNewOptions = {
	ecosystem?: string
	templateName?: string
	projectName?: string
	force?: boolean
	options?: string
}

export type CommandFixOptions = {
	yes?: boolean
	match?: string[]
	exclude?: string[]
	only?: string[]
}

export type CommandInstallOptions = {}

export type CommandReposOptions = {}

export type CommandScriptOptions = {}

export type CommandStartServerOptions = {}

// Fix.
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
	message: string | string[]
	fix?: (() => void) | (() => Promise<void>)
}

// Install.
type InstalledProjectData = {
	isCloned: boolean
	isInstalled: boolean
	gitRef: string
	latestGitRef: string
	versions: string[]
}

export type InstalledProject = {
	name: string
	url: string
	install: string
	uninstall: string
	installed: () => Promise<boolean>
	data?: ProjectData
}
