const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),{setTimeout:delay}=require('node:timers/promises');
(async()=>{const qa=path.resolve('.qa'),profile=path.join(qa,'packaged-'+Date.now());await fs.mkdir(qa,{recursive:true});const env={...process.env,VELORA_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;
 const executablePath=process.env.VELORA_EXE||path.resolve('release/win-unpacked/velora.exe');
 const results=[];
 for(let cycle=0;cycle<2;cycle++){
  const app=await electron.launch({executablePath,args:[],env,timeout:60000});
  try{const w=await app.firstWindow();await w.waitForSelector('h1',{timeout:60000});let s;
   for(let i=0;i<40;i++){s=await w.evaluate(()=>window.velora.state());if(s.active)break;await delay(500);}
   if(s.active?.type!=='video')throw new Error('Automatic wallpaper startup failed: '+JSON.stringify(s.job));
   if(!s.settings.launchAtLogin||!s.settings.restoreWallpaper)throw new Error('Startup default missing');
   await delay(1000);await w.screenshot({path:path.join(qa,`packaged-${cycle}.png`)});
   results.push({cycle,active:s.active,launchAtLogin:s.settings.launchAtLogin,restoreWallpaper:s.settings.restoreWallpaper,items:s.items.length});
   if(cycle===1)await w.evaluate(()=>window.velora.stop());
  }finally{await app.close();}
 }
 await fs.writeFile(path.join(qa,'packaged-report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({ok:true,results}));
})().catch(e=>{console.error(e);process.exit(1);});
