import fs from 'fs';
import assert from 'assert';
const required=['netlify/functions/financial-statements-pro.js','netlify/functions/opening-balances.js','supabase/hfms_phase13_financial_completion.sql','PHASE13_FINANCIAL_COMPLETION.md','PHASE13_DEPLOYMENT_CHECKLIST.md'];
for(const f of required) assert.ok(fs.existsSync(f),`Missing ${f}`);
for(const f of ['netlify/functions/financial-statements-pro.js','netlify/functions/opening-balances.js']){const s=fs.readFileSync(f,'utf8');assert.ok(!s.includes('TODO'),'TODO found in '+f);}
console.log('Phase 13 artifact verification passed.');
