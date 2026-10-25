import fs from 'node:fs';
const reports=[];
const densityReports=[];
export async function checkDensity(page,output,stage) {
 const proof=await page.evaluate(()=>{
  const visible=el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0;
  const dimensions=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {width:r.width,height:r.height,padding:s.padding,classes:el.className,label:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,70)};};
  return {
   switches:[...document.querySelectorAll('.ant-switch')].filter(visible).map(dimensions),
   buttons:[...document.querySelectorAll('button')].filter(visible).map(dimensions),
   rows:[...document.querySelectorAll('.ant-table-tbody > tr[data-row-key]')].filter(visible).map(dimensions),
   cells:[...document.querySelectorAll('.ant-table-tbody > tr[data-row-key] > td')].filter(visible).map(el=>({padding:getComputedStyle(el).padding})),
   cards:[...document.querySelectorAll('.ant-card-body')].filter(visible).map(dimensions),
   brand:[...document.querySelectorAll('.sider-brand')].filter(visible).map(el=>{
    const text=el.querySelector('.brand-text')?.getBoundingClientRect(),actions=el.querySelector('.brand-actions')?.getBoundingClientRect(),box=el.getBoundingClientRect();
    return {aligned:!actions||!text||(text.right<=actions.left&&Math.abs((text.top+text.height/2)-(actions.top+actions.height/2))<1&&actions.right<=box.right)};
   }),
  };
 });
 const badSwitch=proof.switches.filter(x=>Math.abs(x.width-44)>.5||Math.abs(x.height-22)>.5);
 const badRows=proof.rows.filter(x=>x.height<63.5);
 const badButtons=proof.buttons.filter(x=>/ant-btn|sidebar-pin|sidebar-theme-cycle|ant-tabs-nav-more|opblock-control-arrow|authorization__btn|models-control|expand-operation/.test(x.classes)&&x.height<33.5);
 const badCells=proof.cells.filter(x=>x.padding!=='8px 12px');
 if(proof.brand.some(x=>!x.aligned))throw Error('Sidebar wordmark and controls must fit one line on '+stage);
 if(badSwitch.length||badRows.length||badCells.length||badButtons.length)throw Error('Inconsistent shared dimensions on '+stage+': '+JSON.stringify({badSwitch,badRows,badCells,badButtons}));
 densityReports.push({stage,...proof});fs.writeFileSync(output+'/connect-density-audit.json',JSON.stringify(densityReports,null,2));
 await page.screenshot({path:output+'/connect-density-'+stage+'.png',fullPage:true});
 console.log('PASS: shared dimensions '+stage+', '+proof.switches.length+' switches, '+proof.rows.length+' rows');
}
export async function checkBrand(page,output,stage) {
 await page.waitForTimeout(350); // Allow the existing theme transitions to settle.
 await page.evaluate(async()=>{await document.fonts.load('400 14px Montserrat','Настройки Connect. Hub');await document.fonts.load('italic 400 14px Montserrat','Настройки');await document.fonts.ready;});
 const proof=await page.evaluate(()=>{
  const visible=[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0&&([...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())||el.matches('input,textarea,select')));
  const wrong=visible.filter(el=>!/^['"]?Montserrat/.test(getComputedStyle(el).fontFamily)).map(el=>({tag:el.tagName,font:getComputedStyle(el).fontFamily}));
  return {wrong,checked:visible.length,dark:document.body.classList.contains('dark'),background:getComputedStyle(document.body).backgroundColor,loaded:[...document.fonts].filter(f=>f.family==='Montserrat'&&f.status==='loaded').length,thirdTheme:document.documentElement.hasAttribute('data-theme')};
 });
 if(proof.wrong.length||proof.loaded<2||proof.thirdTheme)throw Error('Brand font/theme regression: '+JSON.stringify(proof));
 const expected=proof.dark?'rgb(20, 22, 24)':'rgb(247, 247, 245)';
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
