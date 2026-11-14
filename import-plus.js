/* TVNova Import Plus v0.5 — install after player.js / remote.js.
 * One-file M3U merging; distinguish HLS manifests from channel lists.
 * This extension does not bypass CORS, mixed content, codecs or provider restrictions.
 */
(function(){
 'use strict';
 var fileInput=document.getElementById('playlistFile');
 var uploadButton=document.getElementById('importM3u');
 var message=document.getElementById('importMessage');
 if(!fileInput || !window.TVN)return;
 if(uploadButton)uploadButton.textContent='Add M3U / M3U8 file';
 var p=uploadButton && uploadButton.parentNode && uploadButton.parentNode.parentNode;
 if(p){var note=document.createElement('p');note.textContent='Imported channels are added to your current list. Duplicate stream URLs are skipped.';note.style.color='#8bb6a3';p.appendChild(note)}
 function status(s){if(message)message.textContent=s;var t=document.getElementById('toast');if(t){t.textContent=s;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},4500)}}
 function isHlsManifest(s){return /^\s*#EXT-X-(?:TARGETDURATION|MEDIA-SEQUENCE|STREAM-INF|VERSION|ENDLIST|PLAYLIST-TYPE|KEY|MAP|PART|INF|DISCONTINUITY)/mi.test(s)}
 function escaped(s){return String(s||'').replace(/"/g,"'").replace(/[\r\n]/g,' ')}
 function serialChannel(c){return '#EXTINF:-1 tvg-id="'+escaped(c.epgId)+'" tvg-logo="'+escaped(c.logo)+'" group-title="'+escaped(c.group)+'",'+String(c.name||'Channel').replace(/[\r\n]/g,' ')+'\n'+c.url}
 function serialPlaylist(channels){return '#EXTM3U\n'+channels.map(serialChannel).join('\n')+'\n'}
 function currentChannels(){return TVN.parseM3U(TVN.load().m3u)}
 function mergeChannels(newChannels){
   var state=TVN.load();
   var existing=TVN.parseM3U(state.m3u);
   var seen={};existing.forEach(function(ch){seen[ch.url]=true});
   var added=0;newChannels.forEach(function(ch){if(!seen[ch.url]){seen[ch.url]=true;existing.push(ch);added++}});
   if(!added){status('No new channels found; '+newChannels.length+' streams were already saved.');return}
   var combined=serialPlaylist(existing);
   if(combined.length>2500000){status('Playlist is too large for TVNova local storage (2.5 MB limit).');return}
   state.m3u=combined;
   if(!TVN.save(state)){status('Cannot save channels: browser storage is full or blocked.');return}
   status('Added '+added+' channels. Total: '+existing.length+'. Reloading player…');
   // The core player caches state in its closure; reload to refresh menus safely.
   setTimeout(function(){window.location.reload()},1000);
 }
 function importHlsManifest(text){
   status('This is one HLS stream, not a channel list. The original live URL is required.');
   var url=window.prompt('This file contains video segments, not channel links. Paste the ORIGINAL live .m3u8 URL to add it as one channel (Cancel to skip):','');
   if(!url)return;
   url=url.trim();
   if(!/^https?:\/\//i.test(url)){status('Please enter an HTTP(S) stream address.');return}
   var name=window.prompt('Channel name:','My Live Channel')||'My Live Channel';
   mergeChannels([{name:name,group:'My Channels',logo:'',epgId:'',url:url}]);
   if(/^http:\/\//i.test(url) && location.protocol==='https:'){
    // A warning cannot guarantee whether the browser's upgrade policy permits playback.
    console.warn('TVNova: HTTP video on HTTPS GitHub Pages may be blocked by browser security.');
   }
 }
 function importFile(file){
  if(!file)return;
  var reader=new FileReader();
  reader.onerror=function(){status('Unable to read file. Please try again.')};
  reader.onload=function(){
   var data=String(reader.result||'').replace(/^\uFEFF/,'');
   if(isHlsManifest(data)){importHlsManifest(data);return}
   var parsed=TVN.parseM3U(data);
   if(!parsed.length){status('No channel URLs found. Use an M3U channel list or supply the original HLS URL.');return}
   mergeChannels(parsed);
  };
  reader.readAsText(file,'UTF-8');
 }
 // Capture phase overrides v0.1's replace-all listener without changing player.js.
 fileInput.addEventListener('change',function(ev){
   ev.preventDefault();ev.stopImmediatePropagation();
   var f=this.files&&this.files[0];this.value='';
   importFile(f);
 },true);
})();
