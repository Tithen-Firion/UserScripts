// ==UserScript==
// @name        Netflix - subtitle downloader
// @description Allows you to download subtitles from Netflix
// @license     MIT
// @version     2.0.4
// @namespace   tithen-firion.github.io
// @include     https://www.netflix.com/*
// @grant       none
// @require     https://cdn.rawgit.com/Tithen-Firion/UserScripts/7bd6406c0d264d60428cfea16248ecfb4753e5e3/libraries/xhrHijacker.js?version=1.0
// @require     https://cdn.rawgit.com/sizzlemctwizzle/GM_config/232c002a7421f10b666c6205b9f495367ba9dac2/gm_config.js?version=2016-11-03
// @require     https://cdn.rawgit.com/Stuk/jszip/28d10c924285063b17b73b7db1572e1375f4b924/dist/jszip.min.js?version=3.1.4
// @require     https://cdn.rawgit.com/eligrey/FileSaver.js/5ed507ef8aa53d8ecfea96d96bc7214cd2476fd2/FileSaver.min.js?version=1.3.3
// ==/UserScript==

var MAIN_TITLE = '.player-status-main-title, .ellipsize-text>h4, .video-title>h4';
var TRACK_MENU = '#player-menu-track-settings, .audio-subtitle-controller';
var NEXT_EPISODE = '.player-next-episode:not(.player-hidden), .button-nfplayerNextEpisode';
var SELECTED_SUBS = '.player-timed-text-tracks > .player-track-selected';

var DOWNLOAD_MENU = `<lh class="list-header">Netflix subtitle downloader</lh>
<li class="list-header">Netflix subtitle downloader</li>
<li class="track options">Options</li>
<li class="track download">Download subs for this episode</li>
<li class="track download-all">Download subs from this ep till last available</li>`;

var SCRIPT_CSS = `.player-timed-text-tracks, .track-list-subtitles{ border-right:1px solid #000 }
.player-timed-text-tracks+.player-timed-text-tracks, .track-list-subtitles+.track-list-subtitles{ border-right:0 }
#player-menu-track-settings .subtitle-downloader-menu li.list-header,
.audio-subtitle-controller .subtitle-downloader-menu lh.list-header{ display:none }`;
var OPTIONS_CSS = `#NetflixSubtitleDownloaderConfig_wrapper{ text-align:center }
.config_var{ display:inline-block; padding:10px }
.config_var>*{ vertical-align:middle }`;

var DOWNLOADED_WITH = 'Subtitles downloaded with "Netflix subtitle downloader" UserScript by Tithen-Firion.';

// INIT
(function(){
  // default settings
  GM_config.init({
    'id': 'NetflixSubtitleDownloaderConfig',
    'title': 'Script Settings',
    'fields': {
      'b': {
        'label': 'bold (&lt;b>...&lt;/b>)',
        'type': 'checkbox',
        'default': true
      },
      'i': {
        'label': 'italics (&lt;i>...&lt;/i>)',
        'type': 'checkbox',
        'default': true
      },
      'u': {
        'label': 'underline (&lt;u>...&lt;/u>)',
        'type': 'checkbox',
        'default': true
      },
      'font': {
        'label': 'colour (&lt;font color="...">...&lt;/font>)',
        'type': 'checkbox',
        'default': true
      },
      'position': {
        'label': 'position ({\\an8})',
        'type': 'checkbox',
        'default': false
      }
    },
    'css': OPTIONS_CSS
  });

  // add CSS style
  var s = document.createElement('style');
  s.innerHTML = SCRIPT_CSS;
  document.head.appendChild(s);

  // add menu when it's not there
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if(node.nodeName.toUpperCase() == 'DIV') {
          let trackMenu = (node.parentNode || node).querySelector(TRACK_MENU);
          if(trackMenu !== null && trackMenu.querySelector('.subtitle-downloader-menu') === null) {
            let ol = document.createElement('ol');
            ol.setAttribute('class', 'subtitle-downloader-menu player-timed-text-tracks track-list track-list-subtitles');
            ol.innerHTML = DOWNLOAD_MENU;
            trackMenu.appendChild(ol);
            ol.querySelector('.options').addEventListener('click', GM_config.open.bind(GM_config));
            ol.querySelector('.download').addEventListener('click', downloadThis);
            ol.querySelector('.download-all').addEventListener('click', downloadAll);
          }
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// XML to SRT
(function(self) {
  var TRANSFORMATION = [ // a(ttribute), v(alue), t(ag)
    { 'a': 'tts:fontWeight', 'v': 'bold', 't': 'b' },
    { 'a': 'tts:fontStyle', 'v': 'italic', 't': 'i' },
    { 'a': 'tts:textDecoration', 'v': 'underline', 't': 'u' },
    { 'a': 'tts:color', 'v': 'white', 't': 'font', 'color': true }
  ];
  var getStyles = function(xmlDoc) {
    var styles = {};
    var styleElems = xmlDoc.querySelectorAll('styling style');
    for(let i=0, l=styleElems.length; i < l; ++i) {
      let id = styleElems[i].getAttribute('xml:id');
      styles[id] = {start: '', end: ''};
      for(let j=0, m=TRANSFORMATION.length; j < m; ++j) {
        if(GM_config.get(TRANSFORMATION[j].t) && styleElems[i].hasAttribute(TRANSFORMATION[j].a)) {
          let value = styleElems[i].getAttribute(TRANSFORMATION[j].a).trim();
          let equal = value === TRANSFORMATION[j].v;
          let color = 'color' in TRANSFORMATION[j];
          if(equal != color) {
            styles[id].start += '<' + TRANSFORMATION[j].t + ('color' in TRANSFORMATION[j] ? ' color="' + value + '"': '') + '>';
            styles[id].end = '</' + TRANSFORMATION[j].t + '>' + styles[id].end;
          }
        }
      }
      if(styles[id].start === '')
        delete styles[id];
    }
    return styles;
  };
  var getRegions = function(xmlDoc) {
    var regions = {};
    if(GM_config.get('position')) {
      let regionElems = xmlDoc.querySelectorAll('layout region');
      for(let i = 0; i < regionElems.length; ++i) {
        let id = regionElems[i].getAttribute('xml:id');
        let value = regionElems[i].getAttribute('tts:displayAlign');
        if(value === null) {
          let styles = regionElems[i].querySelectorAll('style');
          for(let j = 0; j < styles.length; ++j) {
            if(styles[j].hasAttribute('tts:displayAlign')) {
              value = styles[j].getAttribute('tts:displayAlign');
              break;
            }
          }
        }
        value = value.trim();
        if(value == 'before')
          regions[id] = '{\\an8}';
      }
    }
    return regions;
  };
  var toText = function(node, styles, regions) {
    var txt = '';
    var children = node.childNodes;
    for(let i = 0; i < children.length; ++i) {
      if(children[i].nodeType === 3)
        txt += children[i].textContent;
      else if(children[i].nodeType === 1) {
        if(children[i].nodeName.toUpperCase() === 'BR')
          txt += '\n';
        else
          txt += toText(children[i], styles);
      }
    }
    if(node.hasAttribute('style')) {
      let s = node.getAttribute('style');
      if(s in styles)
        txt = styles[s].start + txt + styles[s].end;
    }
    if(node.hasAttribute('region')) {
      let r = node.getAttribute('region');
      if(r in regions)
        txt = regions[r] + txt;
    }
    return txt;
  };
  var getLines = function(xmlDoc, styles, regions) {
    var prevStart = -1, subs = [];
    var subElems = xmlDoc.querySelectorAll('div p');
    for(let i = 0; i < subElems.length; ++i) {
      let el = subElems[i];
      let start = Math.round(parseInt(el.getAttribute('begin'))/10000);
      let end = Math.round(parseInt(el.getAttribute('end'))/10000);
      let text = toText(el, styles, regions);
      if(start === prevStart)
        subs[subs.length-1].text += "\n" + text;
      else
        subs.push({start: start, end: end, text: text});
      prevStart = start;
    }
    var lastEndTime = subs[subs.length-1].end;
    subs.push({start: lastEndTime + 2000, end: lastEndTime + 4000, text: DOWNLOADED_WITH});
    return subs;
  };
  var formatTime = function(time) {
    var str = (time%1000).toString().padStart(3, '0');
    time = Math.floor(time/1000);
    str = (time%60).toString().padStart(2, '0') + ',' + str;
    time = Math.floor(time/60);
    str = (time%60).toString().padStart(2, '0') + ':' + str;
    str = (Math.floor(time/60)).toString().padStart(2, '0') + ':' + str;
    return str;
  };
  var xmlToSrt = function(xmlString) {
    try {
      let parser = new DOMParser();
      var xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    }
    catch(e) {
      console.error(e);
      alert('Failed to parse XML subtitle file');
      return null;
    }
    var styles = getStyles(xmlDoc);
    var regions = getRegions(xmlDoc);
    var lines = getLines(xmlDoc, styles, regions);
    var srtLines = [];
    lines.forEach(function(line, i) {
      srtLines.push(i+1);
      srtLines.push(formatTime(line.start) + ' --> ' + formatTime(line.end));
      srtLines.push(line.text);
      srtLines.push('');
    });
    return srtLines.join('\n');
  };
  self.xmlToSrt = xmlToSrt;
})(this);

// get show name or full name with episode number
function getTitle(full) {
  full = full || false;
  var titleElement = document.querySelector(MAIN_TITLE);
  if(titleElement === null)
    return null;
  var title = titleElement.innerText.replace(/[:*?"<>|\\\/]+/g, '_').replace(/ /g, '.');
  if(full) {
    title += '.';
    var episodeElement = titleElement.nextElementSibling;
    if(episodeElement) {
      var m = episodeElement.innerText.match(/^[^\d]*?(\d+)[^\d]*?(\d+)?[^\d]*?$/);
      if(m && m.length == 3) {
        if(typeof m[2] == 'undefined') // example: Stranger Things season 1
          title += 'S01E' + m[1].padStart(2, '0') + '.';
        else
          title += 'S' + m[1].padStart(2, '0') + 'E' + m[2].padStart(2, '0') + '.';
      }
    }
    title += 'WEBRip.Netflix';
    var selectedSubs = document.querySelector(SELECTED_SUBS);
    if(selectedSubs !== null)
      title += '.' + selectedSubs.getAttribute('data-id').split(';')[2];
  }
  return title;
}

function setCurrentSubFile(name, content, count) {
  if(typeof currentSubFile == 'undefined' || currentSubFile.count < count) {
    currentSubFile = {
      name: name,
      content: content,
      count: count
    };
    if(batch)
      downloadAll();
  }
}

// convert XML subs to SRT and set as current subs
function processXmlSubs(responseText, count) {
  var title = getTitle(true);
  if(title === null)
    window.setTimeout(processXmlSubs, 200, responseText, count);
  else {
    var srt = xmlToSrt(responseText);
    if(srt !== null)
      setCurrentSubFile(title + '.srt', srt, count);
  }
}

// download and process subs in image format
function downloadImageSubs(url, count) {
  var req = new XMLHttpRequest();
  req.open('GET', url);
  req.responseType = 'blob';
  req.onload = function() {
    let title = getTitle(true);
    setCurrentSubFile(title + '.zip', req.response, count);
  };
  req.send(null);
}

// download subs for current episode
function downloadThis() {
  if(typeof currentSubFile == 'undefined')
    window.setTimeout(downloadThis, 100);
  else {
    var blob = currentSubFile.content instanceof Blob ?
               currentSubFile.content :
               new Blob([currentSubFile.content], {type: 'text/plain;charset=utf-8'});
    saveAs(blob, currentSubFile.name, true);
  }
}
//download subs from this ep till last available
function downloadAll() {
  batch = true;
  if(typeof currentSubFile == 'undefined')
    window.setTimeout(downloadAll, 100);
  else {
    zip = zip || new JSZip();
    zip.file(currentSubFile.name, currentSubFile.content);
    var nextEp = document.querySelector(NEXT_EPISODE);
    if(nextEp)
      nextEp.click();
    else
      zip.generateAsync({type:"blob"})
        .then(function(content) {
          saveAs(content, getTitle() + ".zip");
          zip = undefined;
          batch = false;
        });
  }
}



var IDs = {}, counter = 0, batch = false, currentImageSubs = '', currentSubFile, zip;
xhrHijacker(function(xhr, id, origin, args) {
  if(origin === 'open' && window.location.pathname.startsWith('/watch/')) {
    if(args[1].indexOf('/?o=') > -1) {
      IDs[id] = counter++;
    }
    else {
      var m = args[1].match(/^(.*?\/range\/)\d+-\d+(\?.*?)(&random=[^&]+)?$/);
      if(m !== null && typeof m[3] == 'undefined' && currentImageSubs != m[2]) {
        currentImageSubs = m[2];
        console.log('Image subs detected:', args[1]);
        downloadImageSubs(m[1] + '1-0' + m[2] + '&random=0', counter++);
      }
    }
  }
  else if(origin === 'load') {
    if(id in IDs && IDs.hasOwnProperty(id)) {
      let c = IDs[id];
      delete IDs[id];
      processXmlSubs(xhr.response, c);
    }
  }
});
