import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const functions = path.join(root, 'netlify', 'functions');
const required = ['system-health.js','ai-cfo.js','profit-first-control.js','reconciliation-center.js','financial-statements-enterprise.js','tax-intelligence.js','executive-management.js','automation-center.js','security-center.js'];
let errors=0;
for (const file of required) {
  const p=path.join(functions,file);
  if(!fs.existsSync(p)){console.error(`ERROR missing function: ${file}`);errors++;continue;}
  const text=fs.readFileSync(p,'utf8');
  if(!text.includes('requireUser')){console.error(`ERROR missing auth guard: ${file}`);errors++;}
}
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const needle of ["id:'system_health'", "viewSystemHealth", "/api/system-health"]) {
  if(!index.includes(needle)){console.error(`ERROR UI integration missing: ${needle}`);errors++;}
}
const phaseNotes=[];
function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else if(/^PHASE\d+.*\.(md|txt)$/i.test(ent.name)||/^MERGE_NOTES\.md$/i.test(ent.name))phaseNotes.push(path.relative(root,p));}}
walk(root);
if(phaseNotes.length){console.error('ERROR phase notes remain:',phaseNotes);errors+=phaseNotes.length;}
console.log(`HFMS audit: ${errors} error(s)`);
process.exit(errors?1:0);
