#!/usr/bin/env node
import { version } from "../package.json";

const args = process.argv.slice(2);
if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
  console.log(version);
} else {
  console.error("Usage: cardstock --version");
  process.exitCode = 1;
}
