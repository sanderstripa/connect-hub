import { chromium } from '../frontend/node_modules/playwright/index.mjs';
let input='';for await(const chunk of process.stdin)input+=chunk;
const cfg=JSON.parse(input);
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({ignoreHTTPSErrors:true,locale:'en-US'});
 await page.goto(cfg.url);
 await page.locator('input[autocomplete="username"]').fill(cfg.user);
 await page.locator('input[autocomplete="current-password"]').fill(cfg.password);
 await page.locator('button[type="submit"]').click();
 await page.waitForURL('**/panel/');
 const tag=page.locator('.ov-update-tag');
 await tag.filter({hasText:cfg.version}).waitFor({timeout:30000});
 await tag.click();
 const modal=page.getByRole('dialog');
 await modal.locator('.actions-row button').click();
 const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname.endsWith('/server/updatePanel'));
 await page.locator('.ant-modal-confirm-btns .ant-btn-primary').click();
 const result=await (await response).json();
 if(!result.success)throw Error(result.msg||'Update was rejected');
 process.stdout.write(JSON.stringify({runId:result.obj.runId})+'\n');
 await page.waitForFunction(expected=>window.X_UI_CUR_VER===expected,cfg.version.replace(/^v/,''),{timeout:180000});
 console.log('PASS: ordinary panel update button installed '+cfg.version);
}finally{await browser.close();}
