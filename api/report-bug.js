// Compatibility route: the frontend posts to /api/report-bug
// Vercel-style routing maps file names to paths, so keep this thin wrapper.
module.exports = require("./reportBug");
