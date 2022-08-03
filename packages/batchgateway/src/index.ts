import { makeApp } from './server';
import { Command } from 'commander';
const program = new Command();
program.option('-p --port <number>', 'Port number to serve on', '8081');
program.parse(process.argv);
const options = program.opts();
const app = makeApp('/');
console.log(`Serving on port ${options.port}`);
app.listen(parseInt(options.port));

module.exports = app;
