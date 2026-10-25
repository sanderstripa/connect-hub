import fs from 'node:fs';
const reports=[];
export async function checkBrand(page,output,stage) {
 await page.waitForTimeout(350); // Allow the existing theme transitions to settle.
 await page.evaluate(async()=>{await document.fonts.load('400 14px Montserrat','Настройки Connect. Hub');await document.fonts.load('italic 400 14px Montserrat','Настройки');await document.fonts.ready;});
 const proof=await page.evaluate(()=>{
  const visible=[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&([...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())||el.matches('input,textarea,select')));
  const wrong=visible.filter(el=>!/^['"]?Montserrat/.test(getComputedStyle(el).fontFamily)).map(el=>({tag:el.tagName,font:getComputedStyle(el).fontFamily}));
  return {wrong,checked:visible.length,dark:document.body.classList.contains('dark'),background:getComputedStyle(document.body).backgroundColor,loaded:[...document.fonts].filter(f=>f.family==='Montserrat'&&f.status==='loaded').length,thirdTheme:document.documentElement.hasAttribute('data-theme')};
 });
 if(proof.wrong.length||proof.loaded<2||proof.thirdTheme)throw Error('Brand font/theme regression: '+JSON.stringify(proof));
 const expected=proof.dark?'rgb(11, 11, 11)':'rgb(247, 247, 245)';
 if(proof.background!==expected)throw Error('Unexpected reference theme background: '+proof.background);
 const externalFonts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\.woff2/.test(e.name)&&new URL(e.name).origin!==location.origin).map(e=>e.name));
 if(externalFonts.length)throw Error('Fonts must remain local');
 const selector=await page.locator('.brand-name:visible,.brand-text:visible').first().count()?'.brand-name,.brand-text':null;
 if(selector){
  const client=await page.context().newCDPSession(page);await client.send('DOM.enable');await client.send('CSS.enable');
  const {root}=await client.send('DOM.getDocument');const {nodeId}=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector});
  if(nodeId){const {fonts}=await client.send('CSS.getPlatformFontsForNode',{nodeId});if(fonts.some(f=>f.glyphCount>0&&!f.familyName.includes('Montserrat')))throw Error('Actual font fallback: '+JSON.stringify(fonts));proof.platformFonts=fonts.map(f=>f.familyName);}
  await client.detach();
 }
 const name=`connect-hub-${stage}-${proof.dark?'dark':'light'}`;
 await page.screenshot({path:output+'/'+name+'.png',fullPage:true});
 reports.push({stage,...proof});fs.writeFileSync(output+'/connect-font-audit.json',JSON.stringify(reports,null,2));
 console.log('PASS: '+name+', '+proof.checked+' visible elements use local Montserrat');
}
