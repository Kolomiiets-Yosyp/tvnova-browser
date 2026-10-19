(function(global){
  'use strict';
  var STORAGE='tvnova.poc.v1';
  function safeStorageGet(key){try{return global.localStorage.getItem(key)}catch(e){return null}}
  function safeStorageSet(key,value){try{global.localStorage.setItem(key,value);return true}catch(e){return false}}
  function newId(){
    var b=new Uint8Array(4);
    if(global.crypto&&global.crypto.getRandomValues){global.crypto.getRandomValues(b)}else{for(var i=0;i<4;i++)b[i]=Math.floor(Math.random()*256)}
    return 'TVN-'+Array.prototype.map.call(b.slice(0,2),function(x){return ('0'+x.toString(16)).slice(-2)}).join('').toUpperCase()+'-'+Array.prototype.map.call(b.slice(2),function(x){return ('0'+x.toString(16)).slice(-2)}).join('').toUpperCase();
  }
  function safeLoad(){
    var s;try{s=JSON.parse(safeStorageGet(STORAGE)||'{}')}catch(e){s={}}
    if(!s||typeof s!=='object')s={};
    if(!s.deviceId||!/^TVN-[A-F0-9]{4}-[A-F0-9]{4}$/.test(s.deviceId))s.deviceId=newId();
    if(typeof s.m3u!=='string')s.m3u='';
    if(typeof s.url!=='string')s.url='';
    if(typeof s.epgUrl!=='string')s.epgUrl='';
    if(!Array.isArray(s.favorites))s.favorites=[];
    if(typeof s.lastChannel!=='string')s.lastChannel='';
    return s;
  }
  function save(s){return safeStorageSet(STORAGE,JSON.stringify(s))}
  function attr(meta,key){var m=meta.match(new RegExp('(?:^|\\s)'+key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'="([^"]*)"','i'));return m?m[1]:''}
  function parseM3U(content){
    if(typeof content!=='string')return [];
    var lines=content.replace(/^\uFEFF/,'').split(/\r?\n/),result=[],info=null,groupHint='';
    for(var i=0;i<lines.length;i++){
      var ln=lines[i].trim();if(!ln)continue;
      if(/^#EXTINF:/i.test(ln)){
        var ix=ln.lastIndexOf(',');var props=ix===-1?ln:ln.slice(0,ix);
        info={name:ix===-1?'Unknown Channel':ln.slice(ix+1).trim(),group:attr(props,'group-title')||groupHint||'Other',logo:attr(props,'tvg-logo'),epgId:attr(props,'tvg-id')};
      }else if(/^#EXTGRP:/i.test(ln)){groupHint=ln.slice(8).trim();if(info)info.group=groupHint}
      else if(ln.charAt(0)!=='#'){
        if(/^https?:\/\//i.test(ln)){
          var n=info&&info.name?info.name:'Channel '+(result.length+1);
          result.push({name:n,group:(info&&info.group)||'Other',logo:(info&&info.logo)||'',epgId:(info&&info.epgId)||'',url:ln,id:'ch'+result.length});
        }
        info=null;groupHint='';
      }
    }
    return result;
  }
  function validateConfig(config,currentId){
    if(!config||config.format!=='tvnova-config-v1')throw Error('Not a TVNova config file.');
    if(config.deviceId!==currentId)throw Error('Device ID does not match this television.');
    if(config.m3u!==undefined&&typeof config.m3u!=='string')throw Error('Invalid M3U content.');
    if(config.m3uUrl!==undefined&&typeof config.m3uUrl!=='string')throw Error('Invalid playlist URL.');
    if(config.m3uUrl&&!/^https?:\/\//i.test(config.m3uUrl))throw Error('Playlist URL must be HTTP or HTTPS.');
    if(config.m3u&&config.m3u.length>2500000)throw Error('Playlist too large for prototype local storage.');
    return true;
  }
  function downloadFile(name,text,mime){
    var b=new Blob([text],{type:mime||'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},5000);
  }
  global.TVN={STORAGE:STORAGE,newId:newId,load:safeLoad,save:save,parseM3U:parseM3U,validateConfig:validateConfig,downloadFile:downloadFile};
})(window);
