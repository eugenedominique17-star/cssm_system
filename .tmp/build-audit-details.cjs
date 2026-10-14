const os = require('node:os');
const path = require('node:path');
const cpu = os.cpus()[0];
os.cpus = () => [cpu];
os.availableParallelism = () => 1;
process.chdir(path.resolve(__dirname, '../frontend'));
process.env.BUILD_PATH = 'build-activity-details-check';
process.env.GENERATE_SOURCEMAP = 'false';
require(path.join(process.cwd(), 'node_modules/react-scripts/scripts/build.js'));
