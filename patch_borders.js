const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (content.includes("'1px solid #e2e8f0'")) {
        // Need to change `border: '1px solid #e2e8f0'` to `border: 1, borderColor: 'divider'` but that requires refactoring the object structure which regex can't do perfectly.
        // Instead I can just replace '#e2e8f0' with 'divider' in borderColor
    }

    if (content.includes("'#e2e8f0'")) {
        content = content.replace(/borderColor:\s*'#e2e8f0'/g, "borderColor: 'divider'");
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated borders in ${path.basename(filePath)}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            processFile(fullPath);
        }
    }
}

walkDir(srcDir);
