const fs = require('fs');
const path = require('path');

const clientDir = __dirname;
const pagesDir = path.join(clientDir, 'src', 'pages');
const compDir = path.join(clientDir, 'src', 'components');

const classMap = [
  // Backgrounds & Surfaces
  { regex: /bg-slate-950/g, rep: 'bg-[var(--bg-primary)]' },
  { regex: /bg-slate-900/g, rep: 'bg-[var(--bg-card)]' },
  { regex: /bg-slate-800\/50/g, rep: 'bg-[var(--accent-soft)]' },
  { regex: /bg-slate-800\/80/g, rep: 'bg-[var(--accent-soft)]' },
  { regex: /bg-slate-800/g, rep: 'bg-[var(--bg-secondary)]' },
  { regex: /bg-slate-700\/50/g, rep: 'bg-[var(--accent-soft)]' },
  { regex: /bg-slate-700/g, rep: 'bg-[var(--bg-secondary)]' },
  { regex: /bg-slate-600/g, rep: 'bg-[var(--border-color)]' },
  { regex: /hover:bg-slate-700/g, rep: 'hover:bg-[var(--border-color)]' },
  { regex: /hover:bg-slate-600/g, rep: 'hover:bg-[var(--text-muted)]' },
  
  // Gradients
  { regex: /from-slate-900/g, rep: 'from-[var(--bg-primary)]' },
  { regex: /via-slate-900\/80/g, rep: 'via-[var(--bg-primary)]/80' },
  
  // Borders
  { regex: /border-slate-800\/50/g, rep: 'border-[var(--border-color)]' },
  { regex: /border-slate-800/g, rep: 'border-[var(--card-border)]' },
  { regex: /border-slate-700\/60/g, rep: 'border-[var(--border-color)]' },
  { regex: /border-slate-700/g, rep: 'border-[var(--border-color)]' },
  { regex: /border-l-slate-500/g, rep: 'border-l-[var(--text-muted)]' },
  { regex: /divide-slate-800\/50/g, rep: 'divide-[var(--border-color)]' },
  { regex: /divide-slate-800/g, rep: 'divide-[var(--card-border)]' },
  
  // Text Colors
  { regex: /text-slate-100/g, rep: 'text-[var(--text-primary)]' },
  { regex: /text-slate-200/g, rep: 'text-[var(--text-primary)]' },
  { regex: /text-slate-300/g, rep: 'text-[var(--text-secondary)]' },
  { regex: /text-slate-400/g, rep: 'text-[var(--text-secondary)]' },
  { regex: /text-slate-500/g, rep: 'text-[var(--text-muted)]' },
  { regex: /text-slate-600/g, rep: 'text-[var(--text-muted)]' },
  
  // Fix double mapped text primary
  { regex: /text-\[var\(--on-accent\)\](.*?)text-\[var\(--text-primary\)\]/g, rep: 'text-[var(--on-accent)]$1' },
];

function processFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processFiles(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      let changed = false;
      for (const { regex, rep } of classMap) {
        if (regex.test(content)) {
          content = content.replace(regex, rep);
          changed = true;
        }
      }
      
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', file);
      }
    }
  }
}

processFiles(pagesDir);
processFiles(compDir);
console.log('Global cleanup script finished.');
