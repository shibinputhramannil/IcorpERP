const fs = require('fs');
const path = require('path');

function replaceAll(content, search, replacement) {
    return content.split(search).join(replacement);
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // Backgrounds
    content = replaceAll(content, "bgcolor: '#ffffff'", "bgcolor: 'background.paper'");
    content = replaceAll(content, "backgroundColor: '#ffffff'", "backgroundColor: 'background.paper'");
    content = replaceAll(content, "bgcolor: '#f8fafc'", "bgcolor: 'background.subtle'");
    content = replaceAll(content, "backgroundColor: '#f8fafc'", "backgroundColor: 'background.subtle'");
    content = replaceAll(content, "bgcolor: '#f1f5f9'", "bgcolor: 'action.hover'");
    content = replaceAll(content, "backgroundColor: '#f1f5f9'", "backgroundColor: 'action.hover'");
    content = replaceAll(content, "bgcolor: '#e0e7ff'", "bgcolor: 'action.selected'");
    content = replaceAll(content, "backgroundColor: '#e0e7ff'", "backgroundColor: 'action.selected'");
    content = replaceAll(content, "bgcolor: 'grey.100'", "bgcolor: 'background.subtle'");
    
    // Gradients
    content = replaceAll(content, "'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'", "(theme) => theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'");

    // Borders
    content = replaceAll(content, "border: '1px solid #e2e8f0'", "border: 1, borderColor: 'divider'");
    content = replaceAll(content, "borderBottom: '1px solid #e2e8f0'", "borderBottom: 1, borderColor: 'divider'");
    content = replaceAll(content, "borderTop: '1px solid #e2e8f0'", "borderTop: 1, borderColor: 'divider'");
    content = replaceAll(content, "borderRight: '1px solid #e2e8f0'", "borderRight: 1, borderColor: 'divider'");
    content = replaceAll(content, "borderLeft: '1px solid #e2e8f0'", "borderLeft: 1, borderColor: 'divider'");
    content = replaceAll(content, "borderColor: '#e2e8f0'", "borderColor: 'divider'");

    content = replaceAll(content, "border: '1px solid #cbd5e1'", "border: 1, borderColor: 'text.disabled'");
    content = replaceAll(content, "borderColor: '#cbd5e1'", "borderColor: 'text.disabled'");
    content = replaceAll(content, "border: '2px dashed #cbd5e1'", "border: '2px dashed', borderColor: 'text.disabled'");
    
    content = replaceAll(content, "borderBottom: '1px solid #f1f5f9'", "borderBottom: 1, borderColor: 'divider'");
    content = replaceAll(content, "borderTop: '1px solid #f1f5f9'", "borderTop: 1, borderColor: 'divider'");

    // Special fix for text color '#ffffff' in AI chat bubbles where it's white on primary.main (blue)
    // We want to KEEP this white even in dark mode because white on blue is always readable.
    // However, if there are '#ffffff' text colors on backgrounds that change, we must be careful.
    // The search above only replaced bgcolor/backgroundColor, which is safe.
    
    // Miscellaneous
    content = replaceAll(content, "color: '#cbd5e1'", "color: 'text.disabled'");

    if (content !== originalContent) {
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

walkDir(path.join(__dirname, 'frontend', 'src'));
