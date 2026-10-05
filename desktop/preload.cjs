const {contextBridge,ipcRenderer,webUtils}=require('electron');
const channels=['state','pick','import','pinterest','favorite','remove','apply','stop','pause','settings','key','testKey','process','cancel','export','openExternal'];
const api=Object.fromEntries(channels.map(name=>[name,async(...args)=>{const r=await ipcRenderer.invoke(`velora:${name}`,...args);if(!r.ok)throw new Error(r.error);return r.value;}]));
api.filePath=file=>webUtils.getPathForFile(file);
api.subscribe=fn=>{const handler=(_,data)=>fn(data);ipcRenderer.on('velora:state',handler);return()=>ipcRenderer.removeListener('velora:state',handler);};
contextBridge.exposeInMainWorld('velora',api);
