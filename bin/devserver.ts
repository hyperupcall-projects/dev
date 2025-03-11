#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { startServer } from '../devserver/webframework.ts'

startServer(process.argv)
