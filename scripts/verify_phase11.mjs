import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(new URL('..', import.meta.url).pathname);
const required = [
  'supabase/hfms_phase7_financial_core.sql',
  'supabase/hfms_phase8_production_core.sql',
  'supabase/hfms_phase9_completion.sql',
  'supabase/hfms_phase10_enterprise.sql',
  'supabase/hfms_phase11_final_controls.sql',
  'netlify/functions/import-financials.js',
  'netlify/functions/reconciliation-match.js',
  'netlify/functions/recurring-post.js',
  'netlify/functions/branch-executive.js',
  'netlify/functions/financial-security-audit.js'
];
const missing=required.filter(f=>!fs.existsSync(path.join(root,f)));
if(missing.length){console.error('Missing files:',missing);process.exit(1);}
const importer=fs.readFileSync(path.join(root,'netlify/functions/import-financials.js'),'utf8');
if(importer.includes("direction:'inflow'")||importer.includes("direction:'outflow'")){console.error('Legacy direction vocabulary remains in importer');process.exit(1);}
console.log('Phase 11 static verification: PASS');
console.log(`Checked ${required.length} required artifacts.`);
