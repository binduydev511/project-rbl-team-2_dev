const fs = require('fs');

const files = [
  'src/pages/Admin/BlogsView.jsx',
  'src/pages/Admin/IndustriesView.jsx',
  'src/pages/Admin/UsersView.jsx',
  'src/pages/Admin/SubscriptionPlansView.jsx',
  'src/pages/Admin/QuestionBankView.jsx',
  'src/pages/Admin/MentorsView.jsx',
  'src/pages/Admin/ChallengesView.jsx',
  'src/pages/Admin/EmployersView.jsx',
  'src/pages/User/MentorDirectory.jsx',
  'src/pages/Auth/Profile.jsx',
  'src/pages/Mentor/MentorSession.jsx',
  'src/pages/Mentor/MentorSchedule.jsx',
  'src/pages/Mentor/MentorBlogManagement.jsx',
  'src/pages/Recruiter/JobManagement.jsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('window.confirm') && !content.includes('useConfirm')) {
    const depth = file.split('/').length - 2;
    let prefix = '';
    for(let i=0; i<depth; i++) prefix += '../';
    const importStr = `\nimport { useConfirm } from '${prefix}utils/ConfirmContext';`;
    
    const importMatches = [...content.matchAll(/^import .*$/gm)];
    if (importMatches.length > 0) {
      const lastMatch = importMatches[importMatches.length - 1];
      const endOfLastImport = lastMatch.index + lastMatch[0].length;
      content = content.slice(0, endOfLastImport) + importStr + content.slice(endOfLastImport);
    } else {
      content = importStr + '\n' + content;
    }

    const componentRegex = /const\s+([A-Z][a-zA-Z0-9_]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/;
    const functionRegex = /export\s+default\s+function\s+([A-Z][a-zA-Z0-9_]*)\s*\([^)]*\)\s*\{/;
    
    const componentMatch = content.match(componentRegex);
    const functionMatch = content.match(functionRegex);
    
    if (componentMatch) {
      const injectIndex = componentMatch.index + componentMatch[0].length;
      content = content.slice(0, injectIndex) + `\n  const confirm = useConfirm();` + content.slice(injectIndex);
    } else if (functionMatch) {
      const injectIndex = functionMatch.index + functionMatch[0].length;
      content = content.slice(0, injectIndex) + `\n  const confirm = useConfirm();` + content.slice(injectIndex);
    }
    changed = true;
  }
  
  if (file.includes('MentorDirectory.jsx')) {
    content = content.replace(/onClick=\{\(\)\s*=>\s*\{/g, 'onClick={async () => {');
  }

  // Handle Pattern 1: if (window.confirm(`msg`)) {
  content = content.replace(/if\s*\(\s*window\.confirm\(\s*(['"`].*?['"`])\s*\)\s*\)\s*\{/gs, (match, msg) => {
    changed = true;
    return `const isConfirmed = await new Promise(resolve => confirm({ message: ${msg}, isDanger: true, onConfirm: () => resolve(true), onCancel: () => resolve(false) }));\n    if (isConfirmed) {`;
  });

  // Handle Pattern 2: if (!window.confirm('msg')) return;
  content = content.replace(/if\s*\(\s*!\s*window\.confirm\(\s*(['"`].*?['"`])\s*\)\s*\)\s*return;/gs, (match, msg) => {
    changed = true;
    return `const isConfirmed = await new Promise(resolve => confirm({ message: ${msg}, isDanger: true, onConfirm: () => resolve(true), onCancel: () => resolve(false) }));\n    if (!isConfirmed) return;`;
  });

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Processed:', file);
  }
});
