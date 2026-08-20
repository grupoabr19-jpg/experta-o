const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const name of ['index.html', 'styles.css', 'app.js']) {
  fs.copyFileSync(path.join(root, 'public', name), path.join(dist, name));
}
fs.copyFileSync(path.join(root, 'expertaço.png'), path.join(dist, 'expertaço.png'));
console.log('Build concluído em dist/.');
