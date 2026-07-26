const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'src/pages/Admin');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  let changed = false;

  // Only process if file has isEditing state
  if (c.includes('const [isEditing, setIsEditing]')) {
    
    // Add createPortal import if not present
    if (!c.includes('createPortal')) {
      c = c.replace(/import React(.*?);/, "import React$1;\nimport { createPortal } from 'react-dom';");
      changed = true;
    }

    // Convert {isEditing && ( ... )} to {isEditing && createPortal( ... , document.body)}
    if (c.includes('{isEditing && (')) {
      c = c.replace(/\{isEditing && \(\s*<div style=\{modalOverlayStyle\}>([\s\S]*?)<\/div>\s*\n\s*\)\}/, 
        "{isEditing && createPortal(\n        <div style={modalOverlayStyle}>$1</div>,\n        document.body\n      )}");
      changed = true;
    }

    // Add scroll lock effect
    if (!c.includes('document.body.style.overflow')) {
      const scrollEffect = `\n  useEffect(() => {\n    if (isEditing) {\n      document.body.style.overflow = 'hidden';\n    } else {\n      document.body.style.overflow = 'unset';\n    }\n    return () => { document.body.style.overflow = 'unset'; };\n  }, [isEditing]);\n`;
      c = c.replace(/(const \[isEditing, setIsEditing\] = useState\(false\);)/, `$1\n${scrollEffect}`);
      changed = true;
    }
    
    if (changed) {
      fs.writeFileSync(p, c);
      console.log('Updated ' + f);
    }
  }
});
