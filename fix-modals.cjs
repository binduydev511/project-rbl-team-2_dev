const fs = require('fs');
const path = require('path');
const dir = path.join(process.cwd(), 'src/pages/Admin');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(f => {
  const p = path.join(dir, f);
  let c = fs.readFileSync(p, 'utf8');
  
  c = c.replace(/alignItems: 'center', justifyContent: 'center', zIndex: 9999,\s*padding: '1rem'/g, 
    "alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999,\n  padding: '5rem 1rem 2rem', overflowY: 'auto'");
    
  c = c.replace(/maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto',/g, 
    "maxWidth: '550px', margin: 'auto',");
    
  // For files that were already modified partially or have slightly different max-height
  c = c.replace(/maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',/g, 
    "maxWidth: '700px', margin: 'auto',");
    
  fs.writeFileSync(p, c);
  console.log('Updated ' + f);
});
