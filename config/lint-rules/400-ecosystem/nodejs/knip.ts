import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { pkgRoot } from '#common'
import type { Issues } from '#types'

export const skip = true

export const issues: Issues = async function* issues({ project }) {}
