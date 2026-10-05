const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),{setTimeout:delay}=require('node:timers/promises');
const {run,ffmpeg}=require('../desktop/media.cjs');
(async()=>{
 const qa=path.resolve('../qa');await fs.mkdir(qa,{recursive:true});
 const env={...process.env,VELORA_DATA_DIR:path.join(qa,'profile-'+Date.now())};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:['.','--disable-gpu'],env,timeout:60000});
 try{
  const w=await app.firstWindow();await w.waitForSelector('h1',{timeout:60000});
  const errors=[];w.on('pageerror',e=>errors.push(e.message));
  const initial=await w.evaluate(()=>window.velora.state());if(initial.items.length<4)throw new Error('Samples missing');
  await delay(1000);await w.screenshot({path:path.join(qa,'velora-library.png')});
  await w.getByRole('button',{name:'Настройки',exact:true}).click();await w.getByText('Подключение Gemini',{exact:true}).waitFor();
  await w.screenshot({path:path.join(qa,'velora-settings.png')});
  await w.getByRole('button',{name:/Мои обои/}).click();
  const fixture=path.join(qa,'motion.mp4');
  await run(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc2=size=640x360:rate=24','-t','1','-c:v','libx264','-pix_fmt','yuv420p',fixture]);
  const imported=await w.evaluate(p=>window.velora.import([p]),fixture);
  await w.evaluate(id=>window.velora.process(id,{mode:'enhance',width:3840,height:2160,fit:'contain',ultra:true}),imported[0].id);
  let result;
  for(let i=0;i<300;i++){result=await w.evaluate(()=>window.velora.state());if(result.job?.done)break;await delay(500);}
  if(!result.job?.done)throw new Error('Processing timeout');if(result.job.error)throw new Error(result.job.error);
  const output=result.items.find(x=>x.id===result.job.outputId);
  if(output.width!==3840||output.height!==2160)throw new Error('4K output invalid');
  await w.evaluate(id=>window.velora.favorite(id),output.id);
  const favorite=await w.evaluate(()=>window.velora.state());
  if(!favorite.items.find(x=>x.id===output.id).favorite)throw new Error('favorite failed');
  let live;
  try{live=await w.evaluate(async id=>{const s=await window.velora.state();return window.velora.apply(id,s.displays.find(x=>x.primary).id,'cover');},imported[0].id);await delay(1500);const state=await w.evaluate(()=>window.velora.state());if(state.active?.id!==imported[0].id)throw new Error('Wallpaper not active');await w.evaluate(()=>window.velora.pause());await w.evaluate(()=>window.velora.stop());}catch(e){live={error:e.message};}
  await w.screenshot({path:path.join(qa,'velora-4k.png')});
  await fs.writeFile(path.join(qa,'report.json'),JSON.stringify({rendererErrors:errors,samples:initial.items.length,imported:imported[0],output,job:result.job,live},null,2));
  if(errors.length)throw new Error(errors.join(';'));
  console.log(JSON.stringify({ok:true,samples:initial.items.length,output:{width:output.width,height:output.height,duration:output.duration,ultra:output.ultra},live,qa}));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exit(1);});
