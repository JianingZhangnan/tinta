import {chromium} from '@playwright/test';
import {server} from './server.mjs';
import fs from 'node:fs/promises';
const srv=server();await new Promise(r=>srv.listen(18734,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{
 await page.goto('http://127.0.0.1:18734/');
 await page.waitForFunction(()=>window.fpksDiagnostics?.().version==='4.1.3',{},{timeout:30000});
 await page.waitForSelector('mjx-container');
 await page.locator('button[data-mode="split"]').click();
 await page.waitForSelector('.cm-content',{timeout:30000});
 await page.waitForTimeout(250);
 const editor=page.locator('.cm-content');await editor.click();await page.keyboard.press('Control+End');await page.keyboard.press('Enter');await page.keyboard.type('mkddnt',{delay:30});await page.keyboard.type('3',{delay:30});await page.keyboard.press('Tab');
 console.log(JSON.stringify({diagnostics:await page.evaluate(()=>window.fpksDiagnostics()),text:await editor.innerText(),errors}));
 await page.screenshot({path:'../build-fpks/web-smoke.png',fullPage:true});
}catch(e){console.log(JSON.stringify({error:e.message,errors,body:await page.locator('body').innerText()}));throw e}finally{await browser.close();srv.close()}
