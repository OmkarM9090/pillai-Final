const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('src/pages', (filePath) => {
  if (!filePath.endsWith('.tsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Pattern 1: fetch(url) -> fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
  content = content.replace(/fetch\((['"`])(http:\/\/localhost:5000[^'"`]+)\1\)/g, 
    `fetch($1$2$1, { headers: { Authorization: \`Bearer \${localStorage.getItem('token')}\` } })`);

  // Pattern 2: fetch(url, { ... }) -> fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, ... }, ... })
  content = content.replace(/fetch\(([^,]+),\s*\{([\s\S]*?)\}\s*\)/g, (match, url, optionsInner) => {
    // If it already has headers
    if (optionsInner.includes('Authorization')) return match;
    
    if (optionsInner.includes('headers: {')) {
      return `fetch(${url}, {${optionsInner.replace('headers: {', "headers: { Authorization: \`Bearer \${localStorage.getItem('token')}\`,")}})`;
    } else {
      return `fetch(${url}, { headers: { Authorization: \`Bearer \${localStorage.getItem('token')}\` }, ${optionsInner} })`;
    }
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log('Updated', filePath);
  }
});
