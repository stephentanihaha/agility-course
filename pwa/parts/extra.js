// --- fitur aplikasi (di luar artifact) ---
let pngBlob=null;
const safeName=()=>(course.name||'course-agility').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').toLowerCase()||'course-agility';
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
async function shareFile(blob,name,type){const f=new File([blob],name,{type});
  if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:course.name||'Course agility'});}catch(e){}}else saveBlob(blob,name);}
const canShareFiles=(()=>{try{return !!(navigator.canShare&&navigator.canShare({files:[new File(['x'],'x.png',{type:'image/png'})]}));}catch(e){return false;}})();
$('#pngShare').hidden=!canShareFiles;$('#fileShare').hidden=!canShareFiles;
$('#pngDl').onclick=()=>{if(pngBlob)saveBlob(pngBlob,safeName()+'.png');};
$('#pngShare').onclick=()=>{if(pngBlob)shareFile(pngBlob,safeName()+'.png','image/png');};
const courseBlob=()=>new Blob([JSON.stringify(course,null,1)],{type:'application/json'});
$('#fileDl').onclick=()=>{saveBlob(courseBlob(),safeName()+'.json');$('#shareMsg').textContent='File course diunduh. Kirim ke anggota lain, lalu buka dengan tombol Buka file course.';};
$('#fileShare').onclick=()=>shareFile(courseBlob(),safeName()+'.json','application/json');
$('#fileIn').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=()=>{try{const c=JSON.parse(r.result);if(!Array.isArray(c.items)||!c.w||!c.h)throw 0;c.items=c.items.filter(i=>DEFS[i.type]);pushHist();course=migrate(c);sel=null;syncInputs();commit();$('#shareMsg').textContent='Course "'+(course.name||'tanpa nama')+'" dibuka.';}
    catch(err){$('#shareMsg').textContent='File ini bukan file course yang bisa dibaca.';}e.target.value='';};
  r.readAsText(f);};
// pasang aplikasi
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('#installBox').hidden=false;});
$('#installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice.catch(()=>{});deferredInstall=null;$('#installBox').hidden=true;};
window.addEventListener('appinstalled',()=>{$('#installBox').hidden=true;});
// offline
if('serviceWorker' in navigator&&location.protocol!=='file:'){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}
