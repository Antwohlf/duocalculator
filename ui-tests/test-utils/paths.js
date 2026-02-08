const path = require('path');

function projectRoot() {
  // ui-tests/ lives at <repo>/ui-tests
  return path.resolve(__dirname, '..', '..');
}

function tmpDir() {
  return path.resolve(__dirname, '..', '.tmp');
}

function artifactsDir() {
  return path.resolve(__dirname, '..', 'artifacts');
}

module.exports = {
  projectRoot,
  tmpDir,
  artifactsDir,
};
