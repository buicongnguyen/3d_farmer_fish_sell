// Print the Vietnamese translation of each argument: node scripts/vi-t.mjs "Some text" ...
import {t,setLanguage} from '../src/i18n.mjs';
setLanguage('vi');
for(const s of process.argv.slice(2))console.log(JSON.stringify(s),'=>',JSON.stringify(t(s)));
