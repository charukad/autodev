#!/usr/bin/env node

import { runCli } from "./app";

async function main(): Promise<void> {
  process.exitCode = await runCli(process.argv.slice(2));
}

void main();
