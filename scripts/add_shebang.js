const fs = require('fs');
const path = require('path');

const filePath = process.argv[2]; // Get the file path argument
if (!filePath) {
    console.error("Usage: node scripts/add_shebang.js <file>");
    process.exit(1);
}

const resolvedPath = path.resolve(filePath);
const shebang = '#!/usr/bin/env node\n';

fs.readFile(resolvedPath, 'utf8', (err, data) => {
    if (err) {
        console.error(`Error reading file: ${err}`);
        process.exit(1);
    }

    // If the shebang is already there, do nothing
    if (data.startsWith(shebang)) {
        console.log(`Shebang already exists in ${filePath}`);
        return;
    }

    // Write the shebang to the top
    const updatedData = shebang + data;
    fs.writeFile(resolvedPath, updatedData, 'utf8', (err) => {
        if (err) {
            console.error(`Error writing file: ${err}`);
            process.exit(1);
        }
        console.log(`Shebang added to ${filePath}`);
    });
});
