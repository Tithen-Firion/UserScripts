// ==UserScript==
// @name        Netflix - subtitle downloader
// @description Allows you to download subtitles from Netflix
// @license     MIT
// @version     3.5.0
// @namespace   tithen-firion.github.io
// @include     https://www.netflix.com/*
// @grant       unsafeWindow
// @require     https://cdn.jsdelivr.net/gh/Stuk/jszip@579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.jsdelivr.net/gh/eligrey/FileSaver.js@283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// ==/UserScript==

class ProgressBar { 
  constructor(max) {
    this.current = 0;
    this.max = max;

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

    this.progressElement = document.createElement('div');
    this.progressElement.innerHTML = 'Click to stop';
    this.progressElement.style.cursor = 'pointer';
    this.progressElement.style.fontSize = '16px';
    this.progressElement.style.textAlign = 'center';
    this.progressElement.style.width = '100%';
    this.progressElement.style.height = '20px';
    this.progressElement.style.background = 'transparent';
    this.stop = new Promise(resolve => {
      this.progressElement.addEventListener('click', () => {resolve(STOP_THE_DOWNLOAD)});
    });

    container.appendChild(this.progressElement);
  }

  increment() {
    this.current += 1;
    if(this.current <= this.max) {
      let p = this.current / this.max * 100;
      this.progressElement.style.background = `linear-gradient(to right, green ${p}%, transparent ${p}%)`;
    }
  }

  destroy() {
    this.progressElement.remove();
  }
}

const STOP_THE_DOWNLOAD = 'NETFLIX_SUBTITLE_DOWNLOADER_STOP_THE_DOWNLOAD';
const MAIN_TITLE = '.player-status-main-title, .ellipsize-text>h4, .video-title>h4';
const TRACK_MENU = '#player-menu-track-settings, .audio-subtitle-controller';
const NEXT_EPISODE = '.player-next-episode:not(.player-hidden), .button-nfplayerNextEpisode';

const WEBVTT = 'webvtt-lssdh-ios8';
const DFXP = 'dfxp-ls-sdh';
const SIMPLE = 'simplesdh';
const ALL_FORMATS = [WEBVTT, DFXP, SIMPLE];

const FORMAT_NAMES = {};
FORMAT_NAMES[WEBVTT] = 'WebVTT';
FORMAT_NAMES[DFXP] = 'DFXP/XML';

const EXTENSIONS = {};
EXTENSIONS[WEBVTT] = 'vtt';
EXTENSIONS[DFXP] = 'dfxp';
EXTENSIONS[SIMPLE] = 'xml';

const DOWNLOAD_MENU = `<lh class="list-header">Netflix subtitle downloader</lh>
<li class="list-header">Netflix subtitle downloader</li>
<li class="track download">Download subs for this episode</li>
<li class="track download-all">Download subs from this ep till last available</li>
<li class="track ep-title-in-filename">Add episode title to filename: <span></span></li>
<li class="track force-all-lang">Force Netflix to show all languages: <span></span></li>
<li class="track lang-setting">Languages to download: <span></span></li>
<li class="track sub-format">Subtitle format: prefer <span></span></li>`;

const SCRIPT_CSS = `.player-timed-text-tracks, .track-list-subtitles{ border-right:1px solid #000 }
.player-timed-text-tracks+.player-timed-text-tracks, .track-list-subtitles+.track-list-subtitles{ border-right:0 }
.subtitle-downloader-menu { list-style:none }
#player-menu-track-settings .subtitle-downloader-menu li.list-header,
.audio-subtitle-controller .subtitle-downloader-menu lh.list-header{ display:none }`;

const SUB_TYPES = {
  'subtitles': '',
  'closedcaptions': '[cc]'
};

let idOverrides = {};
let zip;
let subCache = {};
let batch = false;

let epTitleInFilename = localStorage.getItem('NSD_ep-title-in-filename') === 'true';
let forceSubs = localStorage.getItem('NSD_force-all-lang') !== 'false';
let langs = localStorage.getItem('NSD_lang-setting') || '';
let subFormat = localStorage.getItem('NSD_sub-format') || WEBVTT;

const setEpTitleInFilename = () => {
  document.querySelector('.subtitle-downloader-menu > .ep-title-in-filename > span').innerHTML = (epTitleInFilename ? 'on' : 'off');
};
const setForceText = () => {
  document.querySelector('.subtitle-downloader-menu > .force-all-lang > span').innerHTML = (forceSubs ? 'on' : 'off');
};
const setLangsText = () => {
  document.querySelector('.subtitle-downloader-menu > .lang-setting > span').innerHTML = (langs === '' ? 'all' : langs);
};
const setFormatText = () => {
  document.querySelector('.subtitle-downloader-menu > .sub-format > span').innerHTML = FORMAT_NAMES[subFormat];
};

const toggleEpTitleInFilename = () => {
  epTitleInFilename = !epTitleInFilename;
  if(epTitleInFilename)
    localStorage.setItem('NSD_ep-title-in-filename', epTitleInFilename);
  else
    localStorage.removeItem('NSD_ep-title-in-filename');
  document.location.reload();
};
const toggleForceLang = () => {
  forceSubs = !forceSubs;
  if(forceSubs)
    localStorage.removeItem('NSD_force-all-lang');
  else
    localStorage.setItem('NSD_force-all-lang', forceSubs);
  document.location.reload();
};
const setLangToDownload = () => {
  const result = prompt('Languages to download, comma separated. Leave empty to download all subtitles.\nExample: en,de,fr', langs);
  if(result !== null) {
    langs = result;
    if(langs === '')
      localStorage.removeItem('NSD_lang-setting');
    else
      localStorage.setItem('NSD_lang-setting', langs);
    setLangsText();
  }
};
const setSubFormat = () => {
  if(subFormat === WEBVTT) {
    localStorage.setItem('NSD_sub-format', DFXP);
    subFormat = DFXP;
  }
  else {
    localStorage.removeItem('NSD_sub-format');
    subFormat = WEBVTT;
  }
  setFormatText();
};

const asyncSleep = (seconds, value) => new Promise(resolve => {
  window.setTimeout(resolve, seconds * 1000, value);
});

const popRandomElement = arr => {
  return arr.splice(arr.length * Math.random() << 0, 1)[0];
};

const fixTitle = element => element.textContent.trim().replace(/[:*?"<>|\\\/]+/g, '_').replace(/ /g, '.');

// get show name or full name with episode number
const __getTitle = full => {
  if(typeof full === 'undefined')
    full = true;
  const titleElement = document.querySelector(MAIN_TITLE);
  if(titleElement === null)
    return null;
  const title = [fixTitle(titleElement)];
  if(full) {
    const episodeElement = titleElement.nextElementSibling;
    if(episodeElement) {
      const m = episodeElement.textContent.match(/^[^\d]*(\d+)[^\d]+(\d+)[^\d]*$/);
      if(episodeElement.nextElementSibling && m && m.length == 3) {
        title.push(`S${m[1].padStart(2, '0')}E${m[2].padStart(2, '0')}`);
        if(epTitleInFilename) {
          title.push(fixTitle(episodeElement.nextElementSibling));
        }
      }
      else {
        title.push(fixTitle(episodeElement));
      }
    }
    title.push('WEBRip.Netflix');
  }
  return title.join('.');
};
// helper function, periodically checking for the title and resolving promise if found
const _getTitle = (full, resolve) => {
  const title = __getTitle(full);
  if(title === null)
    window.setTimeout(_getTitle, 200, full, resolve);
  else
    resolve(title);
};
// promise of a title
const getTitle = full => new Promise(resolve => {
  _getTitle(full, resolve);
});

const processSubInfo = async result => {
  const tracks = result.timedtexttracks;
  const titleP = getTitle();
  const subs = {};
  for(const track of tracks) {
    if(track.isNoneTrack)
      continue;

    let type = SUB_TYPES[track.rawTrackType];
    if(typeof type === 'undefined')
      type = `[${track.rawTrackType}]`;
    const lang = track.language + type + (track.isForcedNarrative ? '-forced' : '');

    const formats = {};
    for(let format of ALL_FORMATS) {
      if(typeof track.ttDownloadables[format] !== 'undefined')
        formats[format] = [Object.values(track.ttDownloadables[format].downloadUrls), EXTENSIONS[format]];
    }

    if(Object.keys(formats).length > 0)
      subs[lang] = formats;
  }
  subCache[result.movieId] = {titleP, subs};

  if(batch) {
    downloadAll();
  }
};

const getSubsFromCache = () => {
  const id = window.location.pathname.split('/').pop();
  if(subCache.hasOwnProperty(id))
    return subCache[id];

  let newID = undefined;
  try {
    newID = unsafeWindow.netflix.falcorCache.videos[id].current.value[1];
  }
  catch(ignore) {}
  if(typeof newID !== 'undefined' && subCache.hasOwnProperty(newID))
    return subCache[newID];

  newID = idOverrides[id];
  if(typeof newID !== 'undefined' && subCache.hasOwnProperty(newID))
    return subCache[newID];

  alert("Couldn't find subs, try refreshing the page.");
  throw '';
};

const pickFormat = formats => {
  const preferred = ALL_FORMATS.slice();
  if(subFormat === DFXP)
    preferred.push(preferred.shift());

  for(let format of preferred) {
    if(typeof formats[format] !== 'undefined')
      return formats[format];
  }
};


const _save = async (_zip, title) => {
  const content = await _zip.generateAsync({type:'blob'});
  saveAs(content, title + '.zip');
};

const _download = async _zip => {
  const showTitle = getTitle(false);
  const {titleP, subs} = getSubsFromCache();
  const downloaded = [];

  let filteredLangs;
  if(langs === '')
    filteredLangs = Object.keys(subs);
  else {
    const regularExpression = new RegExp(
      '^(' + langs
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\-/g, '\\-')
        .replace(/\s/g, '')
        .replace(/,/g, '|')
      + ')'
    );
    filteredLangs = [];
    for(const lang of Object.keys(subs)) {
      if(lang.match(regularExpression))
        filteredLangs.push(lang);
    }
  }

  const progress = new ProgressBar(filteredLangs.length);
  let stop = false;
  for(const lang of filteredLangs) {
    const [urls, extension] = pickFormat(subs[lang]);
    while(urls.length > 0) {
      let url = popRandomElement(urls);
      const resultPromise = fetch(url, {mode: "cors"});
      let result;
      try {
        // Promise.any isn't supported in all browsers, use Promise.race instead
        result = await Promise.race([resultPromise, progress.stop, asyncSleep(30, STOP_THE_DOWNLOAD)]);
      }
      catch(e) {
        // the only promise that can be rejected is the one from fetch
        // if that happens we want to stop the download anyway
        result = STOP_THE_DOWNLOAD;
      }
      if(result === STOP_THE_DOWNLOAD) {
        stop = true;
        break;
      }
      progress.increment();
      const data = await result.text();
      if(data.length > 0) {
        downloaded.push({lang, data, extension});
        break;
      }
    }
    if(stop)
      break;
  }
  const title = await titleP;

  downloaded.forEach(x => {
    const {lang, data, extension} = x;
    _zip.file(`${title}.${lang}.${extension}`, data);
  });

  if(await Promise.race([progress.stop, {}]) === STOP_THE_DOWNLOAD)
    stop = true;
  progress.destroy();

  return [await showTitle, stop];
};

const downloadThis = async () => {
  const _zip = new JSZip();
  const [showTitle, stop] = await _download(_zip);
  _save(_zip, showTitle);
};

const downloadAll = async () => {
  zip = zip || new JSZip();
  batch = true;
  const [showTitle, stop] = await _download(zip);
  const nextEp = document.querySelector(NEXT_EPISODE);
  if(!stop && nextEp)
    nextEp.click();
  else {
    await _save(zip, showTitle);
    zip = undefined;
    batch = false;
  }
};

const processMessage = e => {
  const override = e.detail.id_override;
  if(typeof override !== 'undefined')
    idOverrides[override[0]] = override[1];
  else
    processSubInfo(e.detail);
}

const injection = () => {
  const WEBVTT = 'webvtt-lssdh-ios8';
  const MANIFEST_PATTERN = new RegExp('manifest|licensedManifest');
  const forceSubs = localStorage.getItem('NSD_force-all-lang') !== 'false';

  // hijack JSON.parse and JSON.stringify functions
  ((parse, stringify) => {
    JSON.parse = function (text) {
      const data = parse(text);
      if (data && data.result && data.result.timedtexttracks && data.result.movieId) {
        window.dispatchEvent(new CustomEvent('netflix_sub_downloader_data', {detail: data.result}));
      }
      return data;
    };
    JSON.stringify = function (data) {
      /*{
        let text = stringify(data);
        if (text.includes('dfxp-ls-sdh'))
          console.log(text, data);
      }*/
      if (data && typeof data.url === 'string' && data.url.search(MANIFEST_PATTERN) > -1) {
        for (let v of Object.values(data)) {
          try {
            if (v.profiles)
              v.profiles.unshift(WEBVTT);
            if (v.showAllSubDubTracks != null && forceSubs)
              v.showAllSubDubTracks = true;
          }
          catch (e) {
            if (e instanceof TypeError)
              continue;
            else
              throw e;
          }
        }
      }
      if(data && typeof data.movieId === 'number') {
        try {
          let videoId = data.params.sessionParams.uiplaycontext.video_id;
          if(typeof videoId === 'number' && videoId !== data.movieId)
            window.dispatchEvent(new CustomEvent('netflix_sub_downloader_data', {detail: {id_override: [videoId, data.movieId]}}));
        }
        catch(ignore) {}
      }
      return stringify(data);
    };
  })(JSON.parse, JSON.stringify);
}

window.addEventListener('netflix_sub_downloader_data', processMessage, false);

// inject script
const sc = document.createElement('script');
sc.innerHTML = '(' + injection.toString() + ')()';
document.head.appendChild(sc);
document.head.removeChild(sc);

// add CSS style
const s = document.createElement('style');
s.innerHTML = SCRIPT_CSS;
document.head.appendChild(s);

// add menu when it's not there
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      if(node.nodeName.toUpperCase() == 'DIV') {
        let trackMenu = (node.parentNode || node).querySelector(TRACK_MENU);
        if(trackMenu !== null && trackMenu.querySelector('.subtitle-downloader-menu') === null) {
          let ol = document.createElement('ol');
          ol.setAttribute('class', 'subtitle-downloader-menu player-timed-text-tracks track-list track-list-subtitles');
          ol.innerHTML = DOWNLOAD_MENU;
          trackMenu.appendChild(ol);
          ol.querySelector('.download').addEventListener('click', downloadThis);
          ol.querySelector('.download-all').addEventListener('click', downloadAll);
          ol.querySelector('.ep-title-in-filename').addEventListener('click', toggleEpTitleInFilename);
          ol.querySelector('.force-all-lang').addEventListener('click', toggleForceLang);
          ol.querySelector('.lang-setting').addEventListener('click', setLangToDownload);
          ol.querySelector('.sub-format').addEventListener('click', setSubFormat);
          setEpTitleInFilename();
          setForceText();
          setLangsText();
          setFormatText();
        }
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });
