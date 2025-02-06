const fs = require('fs');
const path = require('path');

// Paths to package.json and server source file
const packageJsonPath = path.resolve(__dirname, '../package.json');
const serverFilePath = path.resolve(__dirname, '../src/server.ts'); // Adjust path if necessary

// Read and modify package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
packageJson.name = "vscode-solidity-server";
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

// Read and modify the server file
let serverCode = fs.readFileSync(serverFilePath, 'utf8');
serverCode = serverCode.replace(/const standAloneServerSide\s*=\s*false;/, 'const standAloneServerSide = true;');
fs.writeFileSync(serverFilePath, serverCode, 'utf8');

console.log("✅ Package renamed and standAloneServerSide set to true!");