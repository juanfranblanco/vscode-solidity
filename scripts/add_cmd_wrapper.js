const fs = require('fs');
const path = require('path');

const cliPath = path.resolve('dist/cli/server.js'); // CLI script path
const cmdPath = cliPath.replace('.js', '.cmd'); // Convert to Windows `.cmd` file

const cmdContent = `@echo off\nnode "%~dp0/server.js" %*`;

if (process.platform === 'win32') {
    fs.writeFile(cmdPath, cmdContent, (err) => {
        if (err) {
            console.error(`Error writing CMD wrapper: ${err}`);
            process.exit(1);
        }
        console.log(`CMD wrapper created: ${cmdPath}`);
    });
}