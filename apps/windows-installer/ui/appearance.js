const appearance = window.CONNECT_PALETTES;
const paletteSelect = document.getElementById('palette');
for (const id of appearance.ids) paletteSelect.add(new Option(appearance.names[id], id));
try {
 const saved = localStorage.getItem('connect-hub-palette');
 document.body.dataset.palette = appearance.ids.includes(saved) ? saved : appearance.default;
 document.body.dataset.theme = localStorage.getItem('dark-mode') === 'false' ? 'light' : 'dark';
} catch {}
paletteSelect.value = document.body.dataset.palette;
paletteSelect.addEventListener('change', () => {document.body.dataset.palette = paletteSelect.value;});
let restoring=false;
window.installer.appearance().then(response=>{
 if(!response.ok)return;
 restoring=true;
 document.body.dataset.palette=response.value.palette;
 document.body.dataset.theme=response.value.dark?'dark':'light';
 paletteSelect.value=response.value.palette;
 queueMicrotask(()=>{restoring=false;});
}).catch(()=>{});
new MutationObserver(() => {
 try {
  localStorage.setItem('connect-hub-palette', document.body.dataset.palette);
  localStorage.setItem('dark-mode', String(document.body.dataset.theme === 'dark'));
 } catch {}
 if(!restoring)window.installer.appearance({palette:document.body.dataset.palette,dark:document.body.dataset.theme==='dark'}).catch(()=>{});
}).observe(document.body, {attributes:true, attributeFilter:['data-palette','data-theme']});
