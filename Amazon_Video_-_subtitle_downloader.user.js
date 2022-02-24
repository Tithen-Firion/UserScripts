// ==UserScript==
// @name        Amazon Video - subtitle downloader
// @description Allows you to download subtitles from Amazon Video
// @license     MIT
// @version     1.9.1
// @namespace   tithen-firion.github.io
// @include     /^https:\/\/(www|smile)\.amazon\.com\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/(www|smile)\.amazon\.de\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/(www|smile)\.amazon\.co\.uk\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/(www|smile)\.amazon\.co\.jp\/(gp\/(video|product)|(.*?\/)?dp)\/.+/
// @include     /^https:\/\/www\.primevideo\.com\/(gp\/video|(region\/.*?\/)?detail)/.+/
// @grant       unsafeWindow
// @grant       GM.xmlHttpRequest
// @grant       GM_xmlhttpRequest
// @require     https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @require     https://cdn.jsdelivr.net/gh/Tithen-Firion/UserScripts@7bd6406c0d264d60428cfea16248ecfb4753e5e3/libraries/xhrHijacker.js?version=1.0
// @require     https://cdn.jsdelivr.net/gh/Stuk/jszip@579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.jsdelivr.net/gh/eligrey/FileSaver.js@283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// ==/UserScript==

class ProgressBar {
  constructor() {
    let container = document.querySelector('#userscript_progress_bars');
    if(container === null) {
      container = document.createElement('div');
      container.id = 'userscript_progress_bars'
      document.body.appendChild(container)
      container.style
      container.style.position = 'fixed';
      container.style.top = 0;
      container.style.left = 0;
      container.style.width = '100%';
      container.style.background = 'red';
      container.style.zIndex = '99999999';
    }
    self.container = container;
  }

  init() {
    this.current = 0;
    this.max = 0;

    this.progressElement = document.createElement('div');
    this.progressElement.style.width = 0;
    this.progressElement.style.height = '10px';
    this.progressElement.style.background = 'green';

    self.container.appendChild(this.progressElement);
  }

  increment() {
    this.current += 1;
    if(this.current <= this.max)
      this.progressElement.style.width = this.current / this.max * 100 + '%';
  }

  incrementMax() {
    this.max += 1;
    if(this.current <= this.max)
      this.progressElement.style.width = this.current / this.max * 100 + '%';
  }

  destroy() {
    this.progressElement.remove();
  }
}

var progressBar = new ProgressBar();

// add CSS style
var s = document.createElement('style');
s.innerHTML = 'p.download:hover { cursor:pointer }';
document.head.appendChild(s);

// XML to SRT
function parseTTMLLine(line, parentStyle, styles) {
  const topStyle = line.getAttribute('style') || parentStyle;
  let prefix = '';
  let suffix = '';
  if(topStyle !== null) {
    if(styles[topStyle][0]) {
      prefix = '<i>';
      suffix = '</i>';
    }
    if(styles[topStyle][1]) {
      prefix += '<b>';
      suffix = '</b>' + suffix;
    }
  }

  let result = '';

  for(const node of line.childNodes) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.split(':').pop().toUpperCase();
      if(tagName === 'BR') {
        result += '\n';
      }
      else if(tagName === 'SPAN') {
        result += parseTTMLLine(node, topStyle, styles);
      }
      else {
        console.log('unknown node:', node);
        throw 'unknown node';
      }
    }
    else if(node.nodeType === Node.TEXT_NODE) {
      result += prefix + node.textContent + suffix;
    }
  }

  return result;
}
function xmlToSrt(xmlString, lang) {
  try {
    let parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const styles = {};
    for(const style of xmlDoc.querySelectorAll('head styling style')) {
      const id = style.getAttribute('xml:id');
      if(id === null) throw "style ID not found";
      const italic = style.getAttribute('tts:fontStyle') === 'italic';
      const bold = style.getAttribute('tts:fontWeight') === 'bold';
      styles[id] = [italic, bold];
    }

    const regionsTop = {};
    for(const style of xmlDoc.querySelectorAll('head layout region')) {
      const id = style.getAttribute('xml:id');
      if(id === null) throw "style ID not found";
      const origin = style.getAttribute('tts:origin') || "0% 80%";
      const position = parseInt(origin.match(/\s(\d+)%/)[1]);
      regionsTop[id] = position < 50;
    }

    const topStyle = xmlDoc.querySelector('body').getAttribute('style');

    console.log(topStyle, styles, regionsTop);

    const lines = [];
    const textarea = document.createElement('textarea');

    let i = 0;
    for(const line of xmlDoc.querySelectorAll('body p')) {
      let parsedLine = parseTTMLLine(line, topStyle, styles);
      if(parsedLine != '') {
        if(lang.indexOf('ar') == 0)
          parsedLine = parsedLine.replace(/^(?!\u202B|\u200F)/gm, '\u202B');

        textarea.innerHTML = parsedLine;
        parsedLine = textarea.value;

        const region = line.getAttribute('region');
        if(regionsTop[region] === true) {
          parsedLine = '{\an8}' + parsedLine;
        }

        lines.push(++i);
        lines.push((line.getAttribute('begin') + ' --> ' + line.getAttribute('end')).replace('.',','));
        lines.push(parsedLine);
        lines.push('');
      }
    }
    return lines.join('\n');
  }
  catch(e) {
    console.error(e);
    alert('Failed to parse XML subtitle file, see browser console for more details');
    return null;
  }
}

// download subs and save them
function downloadSubs(url, title, downloadVars, lang) {
  GM.xmlHttpRequest({
    url: url,
    method: 'get',
    onload: function(resp) {

    progressBar.increment();
    var srt = xmlToSrt(resp.responseText, lang);
    if(srt === null) {
      srt = resp.responseText;
      title = title.replace(/\.[^\.]+$/, '.ttml2');
    }
    if(downloadVars) {
      downloadVars.zip.file(title, srt);
      --downloadVars.subCounter;
      if((downloadVars.subCounter|downloadVars.infoCounter) === 0)
        downloadVars.zip.generateAsync({type:"blob"})
          .then(function(content) {
            saveAs(content, 'subs.zip');
            progressBar.destroy();
          });
    }
    else {
      var blob = new Blob([srt], {type: 'text/plain;charset=utf-8'});
      saveAs(blob, title, true);
      progressBar.destroy();
    }

    }
  });
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
      title += '.' + epInfo.title;
    }
    title = title.replace(/[:*?"<>|\\\/]+/g, '_').replace(/ /g, '.');
    title += '.WEBRip.Amazon.';
    var languages = new Set();

    var forced = info.forcedNarratives || [];
    forced.forEach(function(forcedInfo) {
      forcedInfo.languageCode += '-forced';
    });

    var subs = (info.subtitleUrls || []).concat(forced);

    subs.forEach(function(subInfo) {
      let lang = subInfo.languageCode;
      if(subInfo.type === 'subtitle' || subInfo.type === 'subtitle') {}
      else if(subInfo.type === 'shd')
        lang += '[cc]';
      else
        lang += `[${subInfo.type}]`;
      if(languages.has(lang)) {
        let index = 0;
        let newLang;
        do {
          newLang = `${lang}_${++index}`;
        } while(languages.has(newLang));
        lang = newLang;
      }
      languages.add(lang);
      ++downloadVars.subCounter;
      progressBar.incrementMax();
      downloadSubs(subInfo.url, title + lang + '.srt', downloadVars, lang);
    });
    }
    catch(e) {
      console.log(info);
      alert(e);
    }
    if(--downloadVars.infoCounter === 0 && downloadVars.subCounter === 0) {
      alert("No subs found, make sure you're logged in and you have access to watch this video!");
      progressBar.destroy();
    }
  };
  req.send(null);
}

function downloadThis(e) {
  progressBar.init();
  var id = e.target.getAttribute('data-id');
  var downloadVars = {
    subCounter: 0,
    infoCounter: 1,
    zip: new JSZip()
  };
  downloadInfo(gUrl + id, downloadVars);
}
function downloadAll(e) {
  progressBar.init();
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
  var params = ['desiredResources=CatalogMetadata%2CSubtitleUrls%2CForcedNarratives'];
  urlParts[1].split('&').forEach(function(param) {
    var p = param.split('=');
    if(filter.indexOf(p[0]) > -1)
      params.push(param);
  });
  params.push('resourceUsage=CacheResources');
  params.push('titleDecorationScheme=primary-content');
  params.push('subtitleFormat=TTMLv2');
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

function findMovieID() {
  for(const templateElement of document.querySelectorAll('script[type="text/template"]')) {
    let data;
    try {
      data = JSON.parse(templateElement.innerHTML);
    }
    catch(ignore) {
      continue;
    }
    const args = data.initArgs || data.args;
    if(typeof args !== 'undefined' && typeof args.titleID !== 'undefined')
      return args.titleID;
  }
  throw Error("Couldn't find movie ID");
}

function allLoaded(resolve, epCount) {
  if(epCount !== document.querySelectorAll('.js-node-episode-container').length)
    resolve();
  else
    window.setTimeout(allLoaded, 200, resolve, epCount);
}

function showAll() {
  return new Promise(resolve => {
    let btn = document.querySelector('[data-automation-id="ep-expander"]');
    if(btn === null)
      resolve();

    let epCount = document.querySelectorAll('.js-node-episode-container').length;
    btn.click();
    allLoaded(resolve, epCount);
  });
}

// add download buttons
async function init(url) {
  initialied = true;
  gUrl = parseURL(url);
  console.log(gUrl);

  await showAll();

  let button;
  let epElems = document.querySelectorAll('.dv-episode-container, .avu-context-card, .js-node-episode-container');
  if(epElems.length > 0) {
    let IDs = [];
    for(let i=epElems.length; i--; ) {
      let selector, id, el;
      if((el = epElems[i].querySelector('input[name="highlight-list-selector"]')) !== null) {
        id = el.id.replace('selector-', '');
        selector = '.js-episode-offers';
      }
      else if((el = epElems[i].querySelector('input[name="ep-list-selector"]')) !== null) {
        id = el.value;
        selector = '.av-episode-meta-info';
      }
      else if(id = epElems[i].getAttribute('data-aliases'))
        selector = '.dv-el-title';
      else
        continue;
      id = id.split(',')[0];
      epElems[i].querySelector(selector).parentNode.appendChild(createDownloadButton(id, 'episode'));
      IDs.push(id);
    }
    button = createDownloadButton(IDs.join(';'), 'season');
  }
  else {
    let id = findMovieID();
    id = id.split(',')[0];
    button = createDownloadButton(id, 'movie');
  }
  document.querySelector('.dv-node-dp-badges, .av-badges').appendChild(button);
}

var initialied = false, gUrl;
// hijack xhr, we need to find out tokens and other parameters needed for subtitle info
xhrHijacker(function(xhr, id, origin, args) {
  if(!initialied && origin === 'open')
    if(args[1].indexOf('/GetPlaybackResources') > -1) {
      init(args[1])
        .catch(error => {
          console.log(error);
          alert(`subtitle downloader error: ${error.message}`);
        });
    }
});
