#!/usr/bin/env node
// Compatibility entry point. GitLab mirroring is paused by Jakob's request.
console.error('GitLab mirroring is paused; using the GitHub-only delivery helper.');
const { main } = await import('./push-github-work.mjs');
main();
