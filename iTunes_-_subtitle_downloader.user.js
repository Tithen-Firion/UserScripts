// ==UserScript==
// @name        iTunes - subtitle downloader
// @description Allows you to download subtitles from iTunes
// @license     MIT
// @version     1.3.3
// @namespace   tithen-firion.github.io
// @include     https://itunes.apple.com/*/movie/*
// @include     https://tv.apple.com/*/movie/*
// @include     https://tv.apple.com/*/episode/*
// @grant       none
// @require     https://cdn.jsdelivr.net/gh/Stuk/jszip@579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.jsdelivr.net/gh/eligrey/FileSaver.js@283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// @require     https://cdn.jsdelivr.net/npm/m3u8-parser@4.6.0/dist/m3u8-parser.min.js
// ==/UserScript==

let langs = localStorage.getItem('ISD_lang-setting') || '';

function setLangToDownload() {
  const result = prompt('Languages to download, comma separated. Leave empty to download all subtitles.\nExample: en,de,fr', langs);
  if(result !== null) {
    langs = result;
    if(langs === '')
      localStorage.removeItem('ISD_lang-setting');
    else
      localStorage.setItem('ISD_lang-setting', langs);
  }
}

// taken from: https://github.com/rxaviers/async-pool/blob/1e7f18aca0bd724fe15d992d98122e1bb83b41a4/lib/es7.js
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

class ProgressBar { 
  constructor(max) {
    this.current = 0;
    this.max = max;

    let container = document.querySelector('#userscript_progress_bars');
    if(container === null) {
      container = document.createElement('div');
      container.id = 'userscript_progress_bars'
      document.body.appendChild(container);
      container.style.position = 'fixed';
      container.style.top = 0;
      container.style.left = 0;
      container.style.width = '100%';
      container.style.background = 'red';
      container.style.zIndex = '99999999';
    }

    this.progressElement = document.createElement('div');
    this.progressElement.style.width = '100%';
    this.progressElement.style.height = '20px';
    this.progressElement.style.background = 'transparent';

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

async function getText(url) {
  const response = await fetch(url);
  if(!response.ok) {
    console.log(response);
    throw new Error('Something went wrong, server returned status code ' + response.status);
  }
  return response.text();
}

async function getM3U8(url) {
  const parser = new m3u8Parser.Parser();
  parser.push(await getText(url));
  parser.end();
  return parser.manifest;
}

async function getSubtitleSegment(url, done) {
  const text = await getText(url);
  done();
  return text;
}

function filterLangs(subInfo) {
  if(langs === '')
    return subInfo;
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
    const filteredLangs = [];
    for(const entry of subInfo) {
      if(entry.language.match(regularExpression))
        filteredLangs.push(entry);
    }
    return filteredLangs;
  }
}

async function _download(name, url) {
  name = name.replace(/[:*?"<>|\\\/]+/g, '_');

  const mainProgressBar = new ProgressBar(1);
  const SUBTITLES = (await getM3U8(url)).mediaGroups.SUBTITLES;
  const subGroup = SUBTITLES.subtitles_ak || SUBTITLES.subtitles_ap || SUBTITLES.subtitles_ap3 || SUBTITLES['subtitles_vod-ak-amt.tv.apple.com'] || SUBTITLES['subtitles_vod-ap-amt.tv.apple.com'] || SUBTITLES['subtitles_vod-ap3-amt.tv.apple.com'];
  if(typeof subGroup === 'undefined') {
    alert('No subtitles found!');
    mainProgressBar.destroy();
    return;
  }
  let subInfo = Object.values(subGroup);
  subInfo = filterLangs(subInfo);
  mainProgressBar.max = subInfo.length;

  const zip = new JSZip();

  for(const entry of subInfo) {
    let lang = entry.language;
    if(entry.forced) lang += '[forced]';
    if(typeof entry.characteristics !== 'undefined') lang += '[cc]';
    const langURL = new URL(entry.uri, url).href;
    const segments = (await getM3U8(langURL)).segments;

    const subProgressBar = new ProgressBar(segments.length);
    const partial = segmentUrl => getSubtitleSegment(segmentUrl, subProgressBar.increment.bind(subProgressBar));

    const segmentURLs = [];
    for(const segment of segments) {
      segmentURLs.push(new URL(segment.uri, langURL).href);
    }

    const subtitleSegments = await asyncPool(20, segmentURLs, partial);
    let subtitleContent = subtitleSegments.join('\n\n');
    subtitleContent = subtitleContent.replace(/\nWEBVTT\n.*?\n\n/g, '\n');
    subtitleContent = subtitleContent.replace(/\n{3,}/g, '\n\n');

    zip.file(`${name} WEBRip.iTunes.${lang}.vtt`, subtitleContent);

    subProgressBar.destroy();
    mainProgressBar.increment();
  }

  const content = await zip.generateAsync({type:"blob"});
  mainProgressBar.destroy();
  saveAs(content, `${name}.zip`);
}

async function download(name, url) {
  try {
    await _download(name, url);
  }
  catch(error) {
    console.error(error);
    alert('Uncaught error!\nLine: ' + error.lineNumber + '\n' + error);
  }
}

function findUrl(included) {
  for(const item of included) {
    try {
      return item.attributes.assets[0].hlsUrl;
    }
    catch(ignore){}
  }
  return null;
}

const parsers = {
  'tv.apple.com': data => {
    for(const value of Object.values(data)) {
      try{
        const data2 = JSON.parse(value).d.data;
        const content = data2.content;
        if(content.type === 'Movie') {
          const playable = content.playables[0];
          return [
            playable.title,
            playable.itunesMediaApiData.offers[0].hlsUrl
          ];
        }
        else if(content.type === 'Episode') {
          const season = content.seasonNumber.toString().padStart(2, '0');
          const episode = content.episodeNumber.toString().padStart(2, '0');
          return [
            `${content.showTitle} S${season}E${episode}`,
            Object.values(data2.playables)[0].assets.hlsUrl
          ];
        }
        
      }
      catch(ignore){}
    }
    throw new Error('URL not found!');
  },
  'itunes.apple.com': data => {
    data = Object.values(data)[0];
    let name = data.data.attributes.name;
    const year = (data.data.attributes.releaseDate || '').substr(0, 4);
    name = name.replace(new RegExp('\\s*\\(' + year + '\\)\\s*$'), '');
    name += ` (${year})`;
    return [
      name,
      findUrl(data.included)
    ];
  }
}

async function parseData(text) {
  const data = JSON.parse(text);
  const [name, m3u8Url] = parsers[document.location.hostname](data);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.zIndex = '99999998';
  container.style.top = '45px';
  container.style.left = '5px';
  container.style.textAlign = 'center';

  const button = document.createElement('a');
  button.classList.add('we-button');
  button.classList.add('we-button--compact');
  button.classList.add('commerce-button');
  button.style.padding = '3px 8px';
  button.style.display = 'block';
  button.style.marginBottom = '10px';
  button.href = '#';

  const langButton = button.cloneNode();
  langButton.innerHTML = 'Languages';
  langButton.addEventListener('click', setLangToDownload);
  container.append(langButton);

  button.innerHTML = 'Download subtitles';
  button.addEventListener('click', e => {
    download(name, m3u8Url);
  });
  container.append(button);
  document.body.prepend(container);
}

(async () => {
  let element = document.querySelector('#shoebox-ember-data-store, #shoebox-uts-api');
  if(element === null) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(await getText(window.location.href), 'text/html');
    element = doc.querySelector('#shoebox-ember-data-store, #shoebox-uts-api');
  }
  if(element !== null) {
    try {
      await parseData(element.textContent);
    }
    catch(error) {
      console.error(error);
      alert('Uncaught error!\nLine: ' + error.lineNumber + '\n' + error);
    }
  }
  else {
    alert('Movie info not found!')
  }
})();
