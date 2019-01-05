// ==UserScript==
// @name        Netflix - subtitle downloader
// @description Allows you to download subtitles from Netflix
// @license     MIT
// @version     3.0.2
// @namespace   tithen-firion.github.io
// @include     https://www.netflix.com/*
// @grant       unsafeWindow
// @require     https://cdn.rawgit.com/Stuk/jszip/579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.rawgit.com/eligrey/FileSaver.js/283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// ==/UserScript==

const MAIN_TITLE = '.player-status-main-title, .ellipsize-text>h4, .video-title>h4';
const TRACK_MENU = '#player-menu-track-settings, .audio-subtitle-controller';
const NEXT_EPISODE = '.player-next-episode:not(.player-hidden), .button-nfplayerNextEpisode';

const WEBVTT = 'webvtt-lssdh-ios8';

const DOWNLOAD_MENU = `<lh class="list-header">Netflix subtitle downloader</lh>
<li class="list-header">Netflix subtitle downloader</li>
<li class="track download">Download subs for this episode</li>
<li class="track download-all">Download subs from this ep till last available</li>`;

const SCRIPT_CSS = `.player-timed-text-tracks, .track-list-subtitles{ border-right:1px solid #000 }
.player-timed-text-tracks+.player-timed-text-tracks, .track-list-subtitles+.track-list-subtitles{ border-right:0 }
#player-menu-track-settings .subtitle-downloader-menu li.list-header,
.audio-subtitle-controller .subtitle-downloader-menu lh.list-header{ display:none }`;

const SUB_TYPES = {
	'subtitles': '',
  'closedcaptions': '[cc]'
};

let zip;
let subCache = {};
let batch = false;

const randomProperty = obj => {
  const keys = Object.keys(obj);
  return obj[keys[keys.length * Math.random() << 0]];
};

// get show name or full name with episode number
const __getTitle = full => {
  if(typeof full === 'undefined')
    full = true;
  const titleElement = document.querySelector(MAIN_TITLE);
  if(titleElement === null)
    return null;
  const title = [titleElement.textContent.replace(/[:*?"<>|\\\/]+/g, '_').replace(/ /g, '.')];
  if(full) {
    const episodeElement = titleElement.nextElementSibling;
    if(episodeElement) {
      const m = episodeElement.textContent.match(/^[^\d]*?(\d+)[^\d]*?(\d+)?[^\d]*?$/);
      if(m && m.length == 3) {
        if(typeof m[2] == 'undefined') // example: Stranger Things season 1
          title.push(`S01E${m[1].padStart(2, '0')}`);
        else
          title.push(`S${m[1].padStart(2, '0')}E${m[2].padStart(2, '0')}`);
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
  if(result.isSupplemental)
    return;
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
    subs[lang] = randomProperty(track.ttDownloadables[WEBVTT].downloadUrls);
  }
  subCache[result.movieId] = {titleP, subs};

  if(batch) {
  	downloadAll();
  }
};

const getMovieID = () => window.location.pathname.split('/').pop();


const _save = async (_zip, title) => {
  const content = await _zip.generateAsync({type:'blob'});
  saveAs(content, title + '.zip');
};

const _download = async _zip => {
  const showTitle = getTitle(false);
	const {titleP, subs} = subCache[getMovieID()];
  const downloaded = [];
  for(const [lang, url] of Object.entries(subs)) {
    const result = await fetch(url, {mode: "cors"});
    const data = await result.text();
    downloaded.push({lang, data});
  }
  const title = await titleP;

  downloaded.forEach(x => {
    const {lang, data} = x;
    _zip.file(`${title}.${lang}.vtt`, data);
  });

  return await showTitle;
};

const downloadThis = async () => {
  const _zip = new JSZip();
	const showTitle = await _download(_zip);
  _save(_zip, showTitle);
};

const downloadAll = async () => {
  zip = zip || new JSZip();
	batch = true;
	const showTitle = await _download(zip);
  const nextEp = document.querySelector(NEXT_EPISODE);
  if(nextEp)
    nextEp.click();
  else {
    await _save(zip, showTitle);
    zip = undefined;
    batch = false;
  }
};





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
        }
      }
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// hijack JSON.parse and JSON.stringify functions
(function(parse, stringify){
  unsafeWindow.JSON.parse = cloneInto(
    function (text) {
    	const data = parse(text);
      if (data && data.result && data.result.timedtexttracks && data.result.movieId) {
        processSubInfo(data.result);
      }
      return data;
    },
    window,
    {cloneFunctions: true});
  unsafeWindow.JSON.stringify = cloneInto(
    function (data) {
      if (data && data.params && data.params.profiles) {
        data.params.profiles.unshift(WEBVTT);
      }
      return stringify(data);
    },
    window,
    {cloneFunctions: true});
})(unsafeWindow.JSON.parse, unsafeWindow.JSON.stringify);
