const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'src', 'pages');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Replace #f8fafc with background.subtle
    if (content.includes("'#f8fafc'")) {
        content = content.replace(/'#f8fafc'/g, "'background.subtle'");
        changed = true;
    }

    // Replace #ffffff with background.paper in bgcolor/backgroundColor/border
    if (content.includes("'#ffffff'")) {
        // We only want to replace #ffffff if it is used as a background.
        // Simple regex to target bgcolor/backgroundColor
        content = content.replace(/(bg|background)Color:\s*'#ffffff'/g, "$1Color: 'background.paper'");
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${path.basename(filePath)}`);
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
