const fs = require('fs');
const [file, start = '1', end = '9999'] = process.argv.slice(2);
console.log(fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(+start - 1, +end).map((line, i) => `${+start + i}: ${line}`).join('\n'));
