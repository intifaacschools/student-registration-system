const CACHE_NAME = "intifaac-student-shell-v4";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./offline-db.js"];
const CDN_ASSETS = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"];
self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Cache Supabase JS during the first online visit so the app can reopen offline.
    for(const url of CDN_ASSETS){try{const response=await fetch(url,{mode:"cors",cache:"reload"});if(response.ok)await cache.put(url,response.clone());}catch(e){console.warn("Could not cache optional CDN asset",url,e);}}
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));await self.clients.claim();})());
});
self.addEventListener("fetch", event => {
  const req=event.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin===self.location.origin){
    event.respondWith((async()=>{try{const response=await fetch(req);if(response.ok){const cache=await caches.open(CACHE_NAME);cache.put(req,response.clone());}return response;}catch(e){return (await caches.match(req))||(req.mode==="navigate"?await caches.match("./index.html"):Response.error());}})());
  }else if(CDN_ASSETS.includes(req.url) || (((url.hostname==="cdn.jsdelivr.net" && url.pathname.startsWith("/npm/@supabase/supabase-js@2")) || (url.hostname==="unpkg.com" && url.pathname.startsWith("/@supabase/supabase-js@2/"))))){
    event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{return await fetch(req);}catch(e){return Response.error();}})());
  }
});
