/* Local offline storage for the Intifaac / War-idad student system. */
(function(){
  const DB_NAME='intifaac-student-offline-v1', DB_VERSION=1;
  let opening;
  function openDB(){
    if(opening)return opening;
    opening=new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const d=req.result;
        if(!d.objectStoreNames.contains('records')){
          const s=d.createObjectStore('records',{keyPath:'key'});
          s.createIndex('owner_table_school','owner_table_school',{unique:false});
        }
        if(!d.objectStoreNames.contains('queue')){
          const q=d.createObjectStore('queue',{keyPath:'qid',autoIncrement:true});
          q.createIndex('owner_created','owner_created',{unique:false});
        }
        if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    return opening;
  }
  async function tx(store,mode,work){
    const d=await openDB();return new Promise((resolve,reject)=>{
      const t=d.transaction(store,mode),s=t.objectStore(store);let result;
      try{result=work(s)}catch(e){reject(e);return;}
      t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('IndexedDB transaction aborted'));
    });
  }
  const scope=(owner,table,school)=>owner+'|'+table+'|'+(school||'');
  async function putRows(owner,table,school,rows){
    const d=await openDB();return new Promise((resolve,reject)=>{
      const t=d.transaction('records','readwrite'),s=t.objectStore('records'),sc=scope(owner,table,school);
      (rows||[]).forEach(row=>s.put({key:sc+'|'+row.id,owner_table_school:sc,owner,table,school,row,updatedAt:Date.now()}));
      t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);
    });
  }
  async function getRows(owner,table,school){
    const d=await openDB();return new Promise((resolve,reject)=>{
      const t=d.transaction('records','readonly'),idx=t.objectStore('records').index('owner_table_school'),r=idx.getAll(scope(owner,table,school));
      r.onsuccess=()=>resolve((r.result||[]).map(x=>x.row));r.onerror=()=>reject(r.error);
    });
  }
  async function putRow(owner,table,school,row){return putRows(owner,table,school,[row]);}
  async function removeRow(owner,table,school,id){return tx('records','readwrite',s=>s.delete(scope(owner,table,school)+'|'+id));}
  async function enqueue(owner,table,school,operation,row,id){
    const d=await openDB();return new Promise((resolve,reject)=>{
      const t=d.transaction('queue','readwrite'),s=t.objectStore('queue');s.add({owner,owner_created:owner+'|'+Date.now(),table,school,operation,row:row||null,recordId:id||row?.id||null,createdAt:Date.now()});
      t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);
    });
  }
  async function getQueue(owner){
    const d=await openDB();return new Promise((resolve,reject)=>{
      const t=d.transaction('queue','readonly'),r=t.objectStore('queue').getAll();
      r.onsuccess=()=>resolve((r.result||[]).filter(x=>x.owner===owner).sort((a,b)=>a.createdAt-b.createdAt));r.onerror=()=>reject(r.error);
    });
  }
  async function deleteQueue(qid){return tx('queue','readwrite',s=>s.delete(qid));}
  async function setMeta(key,value){return tx('meta','readwrite',s=>s.put({key,value}));}
  async function getMeta(key){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction('meta','readonly').objectStore('meta').get(key);r.onsuccess=()=>resolve(r.result?.value);r.onerror=()=>reject(r.error);});}
  window.OfflineStore={openDB,putRows,getRows,putRow,removeRow,enqueue,getQueue,deleteQueue,setMeta,getMeta};
})();
