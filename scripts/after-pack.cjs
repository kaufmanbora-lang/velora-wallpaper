const fs=require('node:fs/promises'),path=require('node:path');
exports.default=async context=>{
 const root=path.resolve(context.appOutDir,'resources','app.asar.unpacked','node_modules','ffprobe-static','bin');
 const platform=context.electronPlatformName;
 for(const name of await fs.readdir(root).catch(()=>[])){
  if(name===platform)continue;
  const target=path.resolve(root,name);
  if(!target.startsWith(root+path.sep))throw new Error('Unsafe packaging path');
  await fs.rm(target,{recursive:true,force:true});
 }
 const platformRoot=path.resolve(root,platform);
 for(const name of await fs.readdir(platformRoot).catch(()=>[])){
  if(name==='x64')continue;
  const target=path.resolve(platformRoot,name);
  if(!target.startsWith(platformRoot+path.sep))throw new Error('Unsafe packaging path');
  await fs.rm(target,{recursive:true,force:true});
 }
};
