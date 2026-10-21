(function(){
'use strict';
var S=TVN.load(); TVN.save(S);
var channels=[],category='All Channels',query='',selected=-1,toastTimer=0,attempt=0;
var hlsEngine=null,dashEngine=null,libraryLoads={};
function el(id){return document.getElementById(id)}
function txt(id,value){el(id).textContent=value}
function showToast(message){var node=el('toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){node.classList.remove('show')},3400)}
function time(){try{txt('timeNow',new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}))}catch(e){txt('timeNow','TVNova')}}
time();setInterval(time,30000);
txt('deviceCode',S.deviceId);txt('settingsDeviceId',S.deviceId);
function htmlSafeImage(url){return /^https?:\/\//i.test(url||'')?url:''}
function groupIcon(group){var g=group.toLowerCase();if(g==='all channels')return '▦';if(g==='favorites')return '♡';if(/news|новини/.test(g))return '▤';if(/sport|спорт/.test(g))return '◉';if(/mov|film|кіно|фільм/.test(g))return '▣';if(/kid|child|дит/.test(g))return '☻';if(/music|муз/.test(g))return '♫';return '◈'}
function filtered(){return channels.filter(function(c){return (category==='All Channels'||category==='Favorites'&&S.favorites.indexOf(c.url)!==-1||category===c.group)&&(!query||c.name.toLowerCase().indexOf(query)!==-1||c.group.toLowerCase().indexOf(query)!==-1)})}
function categories(){var counts={};channels.forEach(function(c){counts[c.group]=(counts[c.group]||0)+1});return ['All Channels','Favorites'].concat(Object.keys(counts).sort())}
function drawCategory(){var nav=el('categoryNav');nav.innerHTML='';categories().forEach(function(g){var b=document.createElement('button');b.type='button';b.className='cat-item'+(g===category?' is-active':'');var icon=document.createElement('span');icon.className='cat-icon';icon.textContent=groupIcon(g);var label=document.createElement('span');label.textContent=g;b.append(icon,label);b.addEventListener('click',function(){category=g;drawCategory();drawChannels()});nav.appendChild(b)})}
function loadLibrary(url,globalName){
 if(window[globalName])return Promise.resolve(window[globalName]);
 if(libraryLoads[globalName])return libraryLoads[globalName];
 libraryLoads[globalName]=new Promise(function(resolve,reject){
  var script=document.createElement('script');script.src=url;script.async=true;
  script.onload=function(){window[globalName]?resolve(window[globalName]):reject(Error('Player library not available'))};
  script.onerror=function(){delete libraryLoads[globalName];reject(Error('Could not download playback library. Check network connection.'))};
  document.head.appendChild(script);
 });return libraryLoads[globalName];
}
function stopStream(){
 if(hlsEngine){hlsEngine.destroy();hlsEngine=null}
 if(dashEngine){dashEngine.reset();dashEngine=null}
 var v=el('videoPlayer');v.pause();v.removeAttribute('src');v.load();
}
function playVideo(v){
 var p=v.play();
 if(p&&typeof p.catch==='function')p.catch(function(err){
  txt('playbackStatus','Press Play to start ('+(err&&err.name||'autoplay restriction')+').');
 });
}
function startStream(channel,token){
 var url=channel.url, v=el('videoPlayer');
 var isHls=/\.m3u8(?:[?#]|$)/i.test(url);
 var isDash=/\.mpd(?:[?#]|$)/i.test(url);
 if(location.protocol==='https:'&&/^http:\/\//i.test(url)){
  txt('playbackStatus','HTTP source detected: an HTTPS page may block mixed-content video. Try an HTTPS stream URL.');
  showToast('HTTP stream may be blocked on GitHub Pages.');
  // HTTPS upgrade and mixed-content policies vary; do not prematurely prevent every HTTP source.
 }
 txt('playbackStatus','Connecting to '+channel.name+'…');
 function fail(message){if(token!==attempt)return;txt('playbackStatus',message);showToast(message)}
 if(isHls && v.canPlayType('application/vnd.apple.mpegurl')){
  v.src=url;playVideo(v);return;
 }
 if(isHls){
  loadLibrary('https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js','Hls').then(function(Hls){
   if(token!==attempt)return;
   if(!Hls.isSupported()){fail('HLS is not supported by this browser.');return}
   hlsEngine=new Hls({enableWorker:true,maxBufferLength:30});
   hlsEngine.on(Hls.Events.ERROR,function(evt,data){
    if(token!==attempt||!data||!data.fatal)return;
    if(data.type===Hls.ErrorTypes.NETWORK_ERROR)fail('HLS network error: source unreachable, HTTP blocked or CORS blocked.');
    else if(data.type===Hls.ErrorTypes.MEDIA_ERROR)fail('HLS media error: unsupported codec or broken segments.');
    else fail('HLS playback error: '+(data.details||'unknown reason'));
   });
   hlsEngine.on(Hls.Events.MANIFEST_PARSED,function(){if(token===attempt)playVideo(v)});
   hlsEngine.loadSource(url);hlsEngine.attachMedia(v);
  }).catch(function(err){fail(err.message)});return;
 }
 if(isDash){
  loadLibrary('https://cdn.jsdelivr.net/npm/dashjs@4/dist/dash.all.min.js','dashjs').then(function(dashjs){
   if(token!==attempt)return;
   if(typeof MediaSource==='undefined'){fail('DASH requires Media Source Extensions on this browser.');return}
   dashEngine=dashjs.MediaPlayer().create();
   dashEngine.on(dashjs.MediaPlayer.events.ERROR,function(){fail('DASH failed: source, CORS or codec may be unsupported.')});
   dashEngine.initialize(v,url,true);
  }).catch(function(err){fail(err.message)});return;
 }
 v.src=url;playVideo(v);
}
function channelClick(channel){
  var idx=channels.indexOf(channel);if(idx<0)return;selected=idx;S.lastChannel=channel.url;TVN.save(S);
  txt('playingTitle',channel.name);txt('playingGroup',channel.group);el('favoriteCurrent').hidden=false;refreshFavorite();drawChannels();
  attempt++;var token=attempt;
  stopStream();el('videoEmpty').hidden=true;el('videoEmpty').style.display='none';
  startStream(channel,token);
}
function refreshFavorite(){if(selected<0)return;var included=S.favorites.indexOf(channels[selected].url)!==-1;el('favoriteCurrent').textContent=(included?'♥':'♡')+'  '+(included?'Favorited':'Favorite')}
function drawChannels(){
  var list=el('channelList'),items=filtered();list.innerHTML='';txt('categoryHeading',category);txt('channelCount',items.length+' channels');
  if(!items.length){var note=document.createElement('p');note.textContent='No channels found';note.style.cssText='color:#849b90;padding:18px';list.appendChild(note);return}
  items.forEach(function(c,ix){
    var b=document.createElement('button');b.className='channel-item'+(channels.indexOf(c)===selected?' selected':'');b.type='button';b.title=c.name;
    var number=document.createElement('span');number.className='ch-number';number.textContent=('00'+(ix+1)).slice(-3);
    var logo=document.createElement('span');if(htmlSafeImage(c.logo)){var im=document.createElement('img');im.className='ch-logo';im.src=c.logo;im.loading='lazy';im.onerror=function(){im.replaceWith(Object.assign(document.createElement('span'),{className:'ch-logo ch-no-logo',textContent:'▶'}))};logo.appendChild(im)}else{logo.className='ch-logo ch-no-logo';logo.textContent='▶'}
    var info=document.createElement('span');info.className='ch-info';var name=document.createElement('b'),desc=document.createElement('small');name.textContent=c.name;desc.textContent=c.group;info.append(name,desc);
    var star=document.createElement('span');star.className='ch-star';star.textContent=S.favorites.indexOf(c.url)!==-1?'★':'';
    b.append(number,logo,info,star);b.addEventListener('click',function(){channelClick(c)});list.appendChild(b)
  });
}
function updateUI(){
  channels=TVN.parseM3U(S.m3u);txt('settingsCount',channels.length);
  var has=channels.length>0;el('watchLayout').hidden=!has;el('emptyLayout').hidden=has;
  txt('playlistInfo',channels.length+' channels saved locally');
  if(has){drawCategory();drawChannels();if(selected===-1&&S.lastChannel){var idx=channels.findIndex(function(c){return c.url===S.lastChannel});if(idx>=0){selected=idx;txt('playingTitle',channels[idx].name);txt('playingGroup',channels[idx].group);el('favoriteCurrent').hidden=false;refreshFavorite();drawChannels()}}}
}
function closeModal(){el('settingsModal').hidden=true}
function openModal(){el('settingsModal').hidden=false;txt('settingsDeviceId',S.deviceId);txt('settingsCount',channels.length);el('playlistUrl').value=S.url||'';txt('importMessage','')}
function importText(text){
 if(text.length>2500000)throw Error('File exceeds 2.5 MB prototype storage limit.');
 var parsed=TVN.parseM3U(text);if(!parsed.length)throw Error('No HTTP(S) channels were found in this file.');
 S.m3u=text;S.url='';S.lastChannel='';selected=-1;if(!TVN.save(S))throw Error('Cannot store playlist on this device.');
 updateUI();closeModal();showToast('Imported '+parsed.length+' channels. Saved locally.')
}
function importCfg(text){
 var config=JSON.parse(text);TVN.validateConfig(config,S.deviceId);
 if(!config.m3u&&!config.m3uUrl)throw Error('Config has neither M3U data nor URL.');
 S.epgUrl=config.epgUrl||'';
 if(config.m3u){importText(config.m3u)}else{loadFromUrl(config.m3uUrl)}
}
function loadFromUrl(url){
 if(!/^https?:\/\//i.test(url||'')){txt('importMessage','Use a valid http:// or https:// URL.');return}
 txt('importMessage','Fetching playlist (the server must permit TV/browser access)…');
 fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.text()}).then(function(text){importText(text);S.url=url;TVN.save(S)}).catch(function(err){txt('importMessage','Could not fetch URL: '+err.message+' (CORS/network limitations may apply).')})
}
function readFile(input,cb){var file=input.files&&input.files[0];input.value='';if(!file)return;var fr=new FileReader();fr.onload=function(){try{cb(String(fr.result))}catch(err){txt('importMessage',err.message);showToast(err.message)}};fr.onerror=function(){txt('importMessage','Unable to read file')};fr.readAsText(file,'UTF-8')}
el('settingsButton').addEventListener('click',openModal);el('manageButton').addEventListener('click',openModal);el('emptyImport').addEventListener('click',openModal);el('emptyAbout').addEventListener('click',function(){showToast('Import M3U in Settings. Remote sync will be built later.')});el('closeSettings').addEventListener('click',closeModal);el('settingsModal').addEventListener('click',function(e){if(e.target===el('settingsModal'))closeModal()});
el('importM3u').addEventListener('click',function(){el('playlistFile').click()});el('importConfig').addEventListener('click',function(){el('configFile').click()});el('playlistFile').addEventListener('change',function(){readFile(this,importText)});el('configFile').addEventListener('change',function(){readFile(this,importCfg)});el('saveUrl').addEventListener('click',function(){loadFromUrl(el('playlistUrl').value.trim())});
el('clearData').addEventListener('click',function(){if(!confirm('Clear all channels and favorites from this TV? Device ID will remain.'))return;S.m3u='';S.url='';S.epgUrl='';S.favorites=[];S.lastChannel='';TVN.save(S);selected=-1;attempt++;stopStream();updateUI();closeModal();showToast('Channels cleared')});
el('channelSearch').addEventListener('input',function(){query=this.value.trim().toLowerCase();drawChannels()});
el('favoriteCurrent').addEventListener('click',function(){if(selected<0)return;var url=channels[selected].url,index=S.favorites.indexOf(url);if(index>=0)S.favorites.splice(index,1);else S.favorites.push(url);TVN.save(S);refreshFavorite();drawCategory();drawChannels()});
el('fullScreen').addEventListener('click',function(){var v=el('videoPlayer');if(v.webkitEnterFullscreen){v.webkitEnterFullscreen()}else if(v.requestFullscreen){v.requestFullscreen()}else{showToast('Full screen is not available here.')}});
el('videoPlayer').addEventListener('playing',function(){txt('playbackStatus','Playing · Stream connection established')});el('videoPlayer').addEventListener('waiting',function(){txt('playbackStatus','Buffering…')});el('videoPlayer').addEventListener('error',function(){var e=this.error,code=e&&e.code||0;var reasons={1:'Playback was aborted.',2:'Network error or blocked media request.',3:'Decode failed: unsupported codec or corrupt segments.',4:'Media type, URL or codec is unsupported.'};txt('playbackStatus',reasons[code]||'Media failed. Check URL, CORS and codec.');showToast('Stream failed. See playback status for details.')});
window.addEventListener('keydown',function(e){
 if(!el('settingsModal').hidden){if(e.key==='Escape'||e.key==='Backspace'&&e.target.tagName!=='INPUT'){e.preventDefault();closeModal()}return}
 if(e.key==='Escape'||e.key==='Backspace'||e.key==='BrowserBack'){e.preventDefault();if(channels.length)openModal();return}
 if(document.activeElement===el('channelSearch')||document.activeElement===el('playlistUrl'))return;
 if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   if(!channels.length)return;var visible=filtered();if(!visible.length)return;e.preventDefault();var at=selected<0?-1:visible.indexOf(channels[selected]);var next=e.key==='ArrowDown'?Math.min(at+1,visible.length-1):Math.max(at-1,0);if(next<0)next=0;var buttons=el('channelList').querySelectorAll('.channel-item');if(buttons[next]){buttons[next].focus();buttons[next].scrollIntoView({block:'nearest'})}
 }else if((e.key==='Enter'||e.key===' ')){var focus=document.activeElement;if(focus&&focus.classList&&focus.classList.contains('channel-item'))focus.click()}
});
updateUI();
})();
