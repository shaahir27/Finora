const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const replacements = [
  { search: /bg-\[#0F1115\]/g, replace: 'bg-surface' },
  { search: /bg-\[#0A0C0F\]/g, replace: 'bg-base' },
  { search: /bg-\[#1B1712\]/g, replace: 'bg-base' },
  { search: /bg-\[#14555C\]/g, replace: 'bg-accent-core' },
  { search: /bg-\[#3F9AA3\]/g, replace: 'bg-accent-teal' },
  { search: /text-\[#F5EFE3\]/g, replace: 'text-text-primary' },
  { search: /text-\[#3F9AA3\]/g, replace: 'text-accent-teal' },
  { search: /text-\[#6BBF82\]/g, replace: 'text-accent-emerald' },
  { search: /text-\[#F2C94C\]/g, replace: 'text-accent-gold' },
  { search: /text-\[#1B1712\]/g, replace: 'text-base' },
  { search: /border-\[#3F9AA3\]/g, replace: 'border-accent-teal' },
  { search: /border-\[#F5EFE3\]/g, replace: 'border-text-primary' },
  { search: /from-\[#3F9AA3\]/g, replace: 'from-accent-teal' },
  { search: /via-\[#6BBF82\]/g, replace: 'via-accent-emerald' },
  { search: /to-\[#14555C\]/g, replace: 'to-accent-core' },
  { search: /to-\[#3F9AA3\]/g, replace: 'to-accent-teal' },
  { search: /shadow-\[#3F9AA3\]/g, replace: 'shadow-accent-teal' },
  { search: /focus:ring-\[#8E7F65\]/g, replace: 'focus:ring-accent-core' },
  { search: /bg-\[#25201A\]/g, replace: 'bg-surface-glass' },
  { search: /bg-\[#B4A083\]/g, replace: 'bg-accent-core' }
];

walkDir('./apps/web/src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    for (let r of replacements) {
      content = content.replace(r.search, r.replace);
    }
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filePath}`);
    }
  }
});
