// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: Copyright 2023 Edwin Kofler

// shebang-command does not ship its own type definitions.
declare module 'shebang-command' {
	export default function shebangCommand(string?: string): string | null
}
