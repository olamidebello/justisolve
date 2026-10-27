(()=>{
 const heading=document.getElementById('recovery-heading'),status=document.getElementById('recovery-status'),detail=document.getElementById('recovery-detail'),retry=document.getElementById('retry');
 let busy=false,attempts=0;
 async function check(){
  if(busy)return;
  if(navigator.onLine===false){heading.textContent='Your device is offline';status.textContent='Reconnect to Wi-Fi or mobile data. JustiSolve will check again when your device reconnects.';return;}
  busy=true;retry.disabled=true;attempts++;
  heading.textContent='Checking the JustiSolve service…';status.textContent='Your device reports a connection. Checking the sign-in page directly.';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
   /* A fetch is not a navigation: it bypasses the navigation fallback without deleting any local account data. */
   const response=await fetch('/?__justisolve_probe='+Date.now(),{cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
   const html=response.ok&&(response.headers.get('Content-Type')||'').includes('text/html')?await response.text():'';
   if(response.ok&&html.includes('/_next/')&&!html.includes('data-justisolve-recovery')&&!response.headers.get('X-JustiSolve-Recovery')){
    status.textContent='JustiSolve is available. Returning to sign-in…';window.location.replace('/?reconnected=1');return;
   }
   heading.textContent='The JustiSolve service is not ready';status.textContent='Your device reports a connection, but the application did not return its sign-in page. The server or its gateway may need repair.';
   detail.textContent='Check '+attempts+' · HTTP '+response.status+'. This page will retry while it is open.';
  }catch{
   heading.textContent='Unable to reach JustiSolve';status.textContent='The connection to JustiSolve failed. This may be a network, DNS, certificate or server issue; it does not establish that your phone is offline.';
   detail.textContent='Check '+attempts+'. Retrying automatically while this page is open.';
  }finally{clearTimeout(timer);busy=false;retry.disabled=false;}
 }
 retry.addEventListener('click',check);window.addEventListener('online',check);window.addEventListener('offline',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});setInterval(()=>{if(!document.hidden)check();},15000);check();
})();
