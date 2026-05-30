#!/usr/bin/env node

import("../dist/cli.js")
  .then(({ runCli }) => runCli(process.argv.slice(2)))
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
