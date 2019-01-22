// ==UserScript==
// @name        Amazon Video - subtitle downloader
// @description Allows you to download subtitles from Amazon Video
// @license     MIT
// @version     1.5.0
// @namespace   tithen-firion.github.io
// @include     /^https:\/\/www\.amazon\.com\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/www\.amazon\.de\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/www\.amazon\.co\.uk\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/www\.amazon\.co\.jp\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/www\.primevideo\.com\/(gp\/video|(region\/.*?\/)?detail)/.+/
// @grant       unsafeWindow
// @require     https://cdn.jsdelivr.net/gh/Tithen-Firion/UserScripts@7bd6406c0d264d60428cfea16248ecfb4753e5e3/libraries/xhrHijacker.js?version=1.0
// @require     https://cdn.jsdelivr.net/gh/Stuk/jszip@579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.jsdelivr.net/gh/eligrey/FileSaver.js@283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// ==/UserScript==

// add CSS style
var s = document.createElement('style');
s.innerHTML = 'p.download:hover { cursor:pointer }';
document.head.appendChild(s);

// XML to SRT
function xmlToSrt(xmlString) {
  xmlString = xmlString.replace(/<tt:br\/>/gi, '\n');
  try {
    let parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  }
  catch(e) {
    console.error(e);
    alert('Failed to parse XML subtitle file');
    return null;
  }
  var lines = xmlDoc.querySelectorAll('body p');
  var srtLines = [];
  
  for(let i=0, l=lines.length; i < l; ++i) {
    let text = lines[i].innerHTML.trim();
    if(text != '') {
      srtLines.push(i+1);
      srtLines.push(lines[i].getAttribute('begin').replace('.',',') + ' --> ' + lines[i].getAttribute('end').replace('.',','));
      srtLines.push(text);
      srtLines.push('');
    }
  }
  return srtLines.join('\n');
}

// download subs and save them
function downloadSubs(url, title, downloadVars) {
  var req = new XMLHttpRequest();
  req.open('get', url);
  req.onload = function() {
    var srt = xmlToSrt(req.response);
    if(downloadVars) {
      downloadVars.zip.file(title, srt);
      --downloadVars.subCounter;
      if((downloadVars.subCounter|downloadVars.infoCounter) === 0)
        downloadVars.zip.generateAsync({type:"blob"})
          .then(function(content) {
            saveAs(content, 'subs.zip');
          });
    }
    else {
      var blob = new Blob([srt], {type: 'text/plain;charset=utf-8'});
      saveAs(blob, title, true);
    }
  };
  req.send(null);
}

// download episodes/movie info and start downloading subs
function downloadInfo(url, downloadVars) {
  var req = new XMLHttpRequest();
  req.open('get', url);
  req.withCredentials = true;
  req.onload = function() {
    var info = JSON.parse(req.response);
    try {
    var epInfo = info.catalogMetadata.catalog;
    var ep = epInfo.episodeNumber;
    var title, season;
    if(epInfo.type == 'MOVIE' || ep === 0)
      title = epInfo.title;
    else {
      info.catalogMetadata.family.tvAncestors.forEach(function(tvAncestor) {
        switch(tvAncestor.catalog.type) {
          case 'SEASON':
            season = tvAncestor.catalog.seasonNumber;
            break;
          case 'SHOW':
            title = tvAncestor.catalog.title;
            break;
        }
      });
      title += '.S' + season.toString().padStart(2, '0') + '.E' + ep.toString().padStart(2, '0');
    }
    title = title.replace(/[:*?"<>|\\\/]+/g, '_').replace(/ /g, '.');
    title += '.WEBRip.Amazon.';
    var languages = new Set();
    var subs = info.subtitleUrls;
    if(subs.length > 1 && !downloadVars) {
      downloadVars = {
        subCounter: 0,
        infoCounter: 1,
        zip: new JSZip()
      };
    }
    subs.forEach(function(subInfo) {
      let lang = subInfo.languageCode;
      if(languages.has(lang))
        lang += '.' + subInfo.index;
      else
        languages.add(lang);
      if(downloadVars)
        ++downloadVars.subCounter;
      downloadSubs(subInfo.url, title + lang + '.srt', downloadVars);
    });
    if(downloadVars)
      --downloadVars.infoCounter;
    }
    catch(e) {
      console.log(info);
      alert(e);
    }
  };
  req.send(null);
}

function downloadThis(e) {
  var id = e.target.getAttribute('data-id');
  downloadInfo(gUrl + id);
}
function downloadAll(e) {
  var IDs = e.target.getAttribute('data-id').split(';');
  var downloadVars = {
    subCounter: 0,
    infoCounter: IDs.length,
    zip: new JSZip()
  };
  IDs.forEach(function(id) {
    downloadInfo(gUrl + id, downloadVars);
  });
}

// remove unnecessary parameters from URL
function parseURL(url) {
  var filter = ['consumptionType', 'deviceID', 'deviceTypeID', 'firmware', 'gascEnabled', 'marketplaceID', 'userWatchSessionId', 'videoMaterialType', 'clientId', 'operatingSystemName', 'operatingSystemVersion', 'customerID', 'token'];
  var urlParts = url.split('?');
  var params = ['desiredResources=CatalogMetadata%2CSubtitleUrls'];
  urlParts[1].split('&').forEach(function(param) {
    var p = param.split('=');
    if(filter.indexOf(p[0]) > -1)
      params.push(param);
  });
  params.push('resourceUsage=CacheResources');
  params.push('titleDecorationScheme=primary-content');
  params.push('asin=');
  urlParts[1] = params.join('&');
  return urlParts.join('?');
}

function createDownloadButton(id, type) {
  var p = document.createElement('p');
  p.classList.add('download');
  p.setAttribute('data-id', id);
  p.innerHTML = 'Download subs for this ' + type;
  p.addEventListener('click', (type == 'season' ? downloadAll : downloadThis));
  return p;
}

// add download buttons
function init(url) {
  initialied = true;
  gUrl = parseURL(url);
  console.log(gUrl);
  var epList = document.querySelector('#dv-episode-list, .av-episode-list');
  if(epList) {
    let IDs = [];
    let epElems = epList.querySelectorAll('.dv-episode-container');
    if(epElems.length === 0)
      epElems = epList.querySelectorAll('.avu-context-card');
    for(let i=epElems.length; i--; ) {
      let id = epElems[i].getAttribute('data-aliases');
      let selector;
      if(id === null) {
        id = epElems[i].querySelector('input[name="ep-list-selector"]').value;
        selector = '.av-episode-meta-info';
      }
      else if(id)
        selector = '.dv-el-title';
      else
        continue;
      id = id.split(',')[0];
      epElems[i].querySelector(selector).parentNode.appendChild(createDownloadButton(id, 'episode'));
      IDs.push(id);
    }
    let seasonButton = createDownloadButton(IDs.join(';'), 'season');
    if(epList.previousElementSibling)
    	epList.previousElementSibling.appendChild(seasonButton);
    else
      epList.parentNode.insertBefore(seasonButton, epList);
  }
  else {
    let pathNames = window.location.pathname.split('/');
    let id;
    if(document.location.host.indexOf('primevideo') > -1)
      id = document.querySelector('input[name="itemId"]').value;
    else
      id = unsafeWindow.ue_pti;
    document.querySelector('#dv-main-bottom-section, .av-badges').appendChild(createDownloadButton(id, 'movie'));
  }
}

var initialied = false, gUrl;
// hijack xhr, we need to find out tokens and other parameters needed for subtitle info
xhrHijacker(function(xhr, id, origin, args) {
  if(!initialied && origin === 'open')
    if(args[1].indexOf('/GetPlaybackResources') > -1)
      init(args[1])
});
