const fs = require('fs');
const path = require('path');

function removeScrollbarOverrides(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeScrollbarOverrides(fullPath);
    } else if (fullPath.endsWith('.css') && !fullPath.endsWith('index.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Remove all CSS blocks that define ::-webkit-scrollbar
      // A block is something like selector::-webkit-scrollbar { ... }
      // This regex matches any selector ending with ::-webkit-scrollbar (and optionally more selectors) and its { block }
      
      // A robust way: since we want to remove scrollbar hiding, let's remove any rule containing ::-webkit-scrollbar
      // We can use a regex to match CSS rule blocks.
      // Match something { something } where 'something' before { has ::-webkit-scrollbar
      let newContent = content.replace(/[^{}]*::-webkit-scrollbar[^{]*{[^{}]*}/g, '');
      
      // Some rules might be nested (e.g. @media). The simple regex might miss them if they have nested braces.
      // Actually, standard CSS regex:
      // /[^}]+::-webkit-scrollbar[^\{]*\{[^\}]*\}/g
      newContent = newContent.replace(/(^|\})([^\}\{]*::-webkit-scrollbar[^\}\{]*\{[^\}]*\})/g, '$1');
      
      // Remove scrollbar-width: none;
      newContent = newContent.replace(/scrollbar-width\s*:\s*none\s*;/g, '');
      // Remove -ms-overflow-style: none;
      newContent = newContent.replace(/-ms-overflow-style\s*:\s*none\s*;/g, '');
      
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Cleaned:', fullPath);
      }
    }
  }
}

removeScrollbarOverrides(path.join(__dirname, 'src'));
console.log('Done!');
