#!/usr/bin/env bun

import { build } from "./lib/build.js";
import { startDevServer } from "./lib/dev-server.js";
import path from "path";

const defaultPublicDir = "./public";
const defaultBuildDir = "./build";
const defaultTemplatesDir = "./templates";

function printUsage() {
  console.log(`
Usage: bun run cli.js <command> [options]

Commands:
  build     Build the static site
  serve     Start the development server

Options:
  --public <dir>     Public directory (default: ${defaultPublicDir})
  --build <dir>      Build directory (default: ${defaultBuildDir})
  --templates <dir>  Templates directory (default: ${defaultTemplatesDir})

Examples:
  bun run cli.js build
  bun run cli.js serve --public ./src --build ./dist
`);
}

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  printUsage();
  process.exit(1);
}

const options = {
  public: defaultPublicDir,
  build: defaultBuildDir,
  templates: defaultTemplatesDir,
};

for (let i = 1; i < args.length; i += 2) {
  const option = args[i];
  const value = args[i + 1];
  if (option === "--public") options.public = value;
  if (option === "--build") options.build = value;
  if (option === "--templates") options.templates = value;
}

const publicDir = path.resolve(process.cwd(), options.public);
const buildDir = path.resolve(process.cwd(), options.build);
const templatesDir = path.resolve(process.cwd(), options.templates);

switch (command) {
  case "build":
    build(publicDir, buildDir);
    break;
  case "serve":
    const stopServer = startDevServer(publicDir, buildDir, templatesDir);
    process.on("SIGINT", () => {
      console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
      stopServer();
      process.exit();
    });
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}
