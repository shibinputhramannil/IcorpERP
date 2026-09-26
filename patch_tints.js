const fs = require('fs');
const path = require('path');

const filesToPatch = {
    'CompaniesPage.jsx': [
        {
            search: /backgroundColor:\s*comp\.is_active\s*\?\s*'#eff6ff'\s*:\s*'#f1f5f9'/g,
            replace: "backgroundColor: comp.is_active ? (theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.1)' : '#eff6ff') : 'background.subtle'"
        }
    ],
    'DocumentsPage.jsx': [
        {
            search: /bgcolor:\s*selectedFile\s*\?\s*'#f0fdf4'\s*:\s*'background\.subtle'/g,
            replace: "bgcolor: selectedFile ? (theme => theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.15)' : '#f0fdf4') : 'background.subtle'"
        }
    ],
    'EmailPage.jsx': [
        {
            search: /\?\s*'#f0fdf4'/g,
            replace: "? (theme => theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.15)' : '#f0fdf4')"
        }
    ],
    'EmployeesPage.jsx': [
        {
            search: /backgroundColor:\s*'#eff6ff'/g,
            replace: "backgroundColor: theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.1)' : '#eff6ff'"
        }
    ],
    'FinancePage.jsx': [
        {
            search: /bgcolor:\s*Number\(pnlData\.net_profit\)\s*>=\s*0\s*\?\s*'#ecfdf5'\s*:\s*'#fef2f2'/g,
            replace: "bgcolor: Number(pnlData.net_profit) >= 0 ? (theme => theme.palette.mode === 'dark' ? 'rgba(16,185,129,0.1)' : '#ecfdf5') : (theme => theme.palette.mode === 'dark' ? 'rgba(239,68,68,0.1)' : '#fef2f2')"
        }
    ],
    'NotificationsPage.jsx': [
        {
            search: /bgcolor:\s*isUnread\s*\?\s*'#eff6ff'\s*:\s*'background\.subtle'/g,
            replace: "bgcolor: isUnread ? (theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'background.subtle'"
        }
    ],
    'WorkspacePage.jsx': [
        {
            search: /bgcolor:\s*roleName\s*===\s*'Company Admin'\s*\?\s*'#eff6ff'\s*:\s*'#f1f5f9'/g,
            replace: "bgcolor: roleName === 'Company Admin' ? (theme => theme.palette.mode === 'dark' ? 'rgba(59,130,246,0.15)' : '#eff6ff') : 'background.subtle'"
        }
    ]
};

const srcDir = path.join(__dirname, 'frontend', 'src', 'pages');

for (const [filename, rules] of Object.entries(filesToPatch)) {
    const filePath = path.join(srcDir, filename);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;
        for (const rule of rules) {
            if (content.match(rule.search)) {
                content = content.replace(rule.search, rule.replace);
                changed = true;
            }
        }
        if (changed) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${filename}`);
        }
    }
}
