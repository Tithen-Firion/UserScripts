// ==UserScript==
// @name        Amazon Video - subtitle downloader
// @description Allows you to download subtitles from Amazon Video
// @license     MIT
// @version     1.2
// @namespace   tithen-firion.github.io
// @include     https://www.amazon.com/gp/video/*
// @include     https://www.amazon.com/gp/product/*
// @include     https://www.amazon.de/gp/video/*
// @include     https://www.amazon.de/gp/product/*
// @include     https://www.amazon.co.uk/gp/video/*
// @include     https://www.amazon.co.uk/gp/product/*
// @include     https://www.primevideo.com/gp/video/*
// @include     https://www.primevideo.com/detail/*
// @grant       none
// @require     https://cdn.rawgit.com/Tithen-Firion/UserScripts/7bd6406c0d264d60428cfea16248ecfb4753e5e3/libraries/xhrHijacker.js?version=1.0
// @require     https://cdn.rawgit.com/Stuk/jszip/28d10c924285063b17b73b7db1572e1375f4b924/dist/jszip.min.js?version=3.1.4
// @require     https://cdn.rawgit.com/eligrey/FileSaver.js/5ed507ef8aa53d8ecfea96d96bc7214cd2476fd2/FileSaver.min.js?version=1.3.3
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
  req.onload = function() {
    var info = JSON.parse(req.response);
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
  var filter = ['consumptionType', 'deviceID', 'deviceTypeID', 'firmware', 'gascEnabled', 'marketplaceID', 'resourceUsage', 'userWatchSessionId', 'videoMaterialType', 'clientId', 'operatingSystemName', 'operatingSystemVersion', 'titleDecorationScheme', 'customerID', 'token'];
  var urlParts = url.split('?');
  var params = ['desiredResources=CatalogMetadata%2CSubtitleUrls'];
  urlParts[1].split('&').forEach(function(param) {
    var p = param.split('=');
    if(filter.indexOf(p[0]) > -1)
      params.push(param);
  });
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
      if(id)
        selector = '.dv-el-title';
      else {
        id = epElems[i].querySelector('.av-play-icon').getAttribute('data-title-id');
        selector = '.av-episode-meta-info';
      }
      epElems[i].querySelector(selector).parentNode.appendChild(createDownloadButton(id, 'episode'));
      IDs.push(id);
    }
    epList.previousElementSibling.appendChild(createDownloadButton(IDs.join(';'), 'season'));
  }
  else {
    let pathNames = window.location.pathname.split('/');
    let id;
    if(pathNames[1] !== 'detail')
      id = pathNames[(pathNames[2] == 'video' ? 4 : 3)];
    else
      id = document.querySelector('input[name="itemId"]').value;
    document.querySelector('#dv-main-bottom-section, .av-badges').appendChild(createDownloadButton(id, 'movie'));
  }
}

var initialied = false, gUrl;
// hijack xhr, we need to find out tokens and other parameters needed for subtitle info
xhrHijacker(function(xhr, id, origin, args) {
  if(!initialied && origin === 'open')
    if(args[1].indexOf('GetPlaybackResources') > -1)
      init(args[1])
});
