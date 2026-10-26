// Same production compiler, with one worker for machines with limited RAM.
const os = require('node:os');
const path = require('node:path');
os.availableParallelism = () => 1;
const cpus = os.cpus();
os.cpus = () => cpus.slice(0, 1);
process.chdir(path.join(__dirname, '..'));
require('react-scripts/scripts/build');
