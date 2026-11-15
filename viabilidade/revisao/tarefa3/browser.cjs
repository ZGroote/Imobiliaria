// Para a central: node viabilidade/revisao/tarefa3/browser.cjs (dispensa servidor).
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let chromium;
try { ({chromium} = require('playwright')); }
catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
  ({chromium} = require('C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const page = await browser.newPage();
    const alerts = [];
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
    await page.route('**/*', route => route.fulfill({status:404,body:''}));
    await page.setContent(fs.readFileSync(path.join(__dirname,'casos/xss-pavimentos.html'),'utf8'), {waitUntil:'networkidle'});
    const imgs = await page.locator('img[onerror]').count();
    const result = {chrome:browser.version(),imgs,alertas:alerts};
    fs.writeFileSync(path.join(__dirname,'evidencias/browser.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify(result));
    assert.equal(imgs,0,'O relatório não pode criar img com manipulador de evento.');
    assert.equal(alerts.length,0,'O relatório não pode executar código do estudo.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
