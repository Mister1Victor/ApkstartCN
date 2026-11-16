'use strict';
const assert = require('assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { download, downloadParallel, downloadMulti } = require('../src/core/download');
(async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apkstart-range-'));
 const server = http.createServer((req, res) => {
  const r = req.headers.range;
  if (req.url === '/416') {
   if (r) { res.writeHead(416, {'Content-Range':'bytes */4'}); res.end(); }
   else { res.writeHead(200, {'Content-Length':'4'}); res.end('good'); }
  } else if (r === 'bytes=0-0') { res.writeHead(206, {'Content-Range':'bytes 0-0/8','Content-Length':'1'}); res.end('a'); }
  else { res.writeHead(206, {'Content-Range':'bytes 0-3/8','Content-Length':'4'}); res.end('abcd'); }
 });
 await new Promise(r => server.listen(0, '127.0.0.1', r));
 const base = `http://127.0.0.1:${server.address().port}`;
 try {
  const out = path.join(dir,'one'); fs.writeFileSync(out,'corrupt data');
  await download(base+'/416', out); assert.equal(fs.readFileSync(out,'utf8'), 'good');
  await assert.rejects(downloadParallel(base+'/bad', path.join(dir,'two'), {connections:2,minChunk:2,retries:1}), /范围/);
  await assert.rejects(downloadMulti([base+'/bad1',base+'/bad2'], path.join(dir,'three'), {connections:2,minChunk:2,retries:1}), /范围/);
  console.log('Range validation tests passed');
 } finally { server.close(); fs.rmSync(dir, {recursive:true, force:true}); }
})().catch(e => { console.error(e); process.exitCode=1; });
