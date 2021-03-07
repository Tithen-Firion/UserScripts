// ==UserScript==
// @name        iTunes - subtitle downloader
// @description Allows you to download subtitles from iTunes
// @license     MIT
// @version     1.1.0
// @namespace   tithen-firion.github.io
// @include     https://itunes.apple.com/*/movie/*
// @include     https://tv.apple.com/*/movie/*
// @grant       none
// @require     https://cdn.jsdelivr.net/gh/Stuk/jszip@579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.jsdelivr.net/gh/eligrey/FileSaver.js@283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// @require     https://cdn.jsdelivr.net/npm/m3u8-parser@4.6.0/dist/m3u8-parser.min.js
// ==/UserScript==

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

async function _download(name, url) {
  name = name.replace(/[:*?"<>|\\\/]+/g, '_');

  const mainProgressBar = new ProgressBar(1);
  const subInfo = Object.values((await getM3U8(url)).mediaGroups.SUBTITLES.subtitles_ak);
  mainProgressBar.max = subInfo.length;

  const zip = new JSZip();

  for(const entry of subInfo) {
  	const lang = entry.language + (entry.forced ? '[forced]' : '');
    const segments = (await getM3U8(entry.uri)).segments;

    const subProgressBar = new ProgressBar(segments.length);
    const partial = segmentUrl => getSubtitleSegment(segmentUrl, subProgressBar.increment.bind(subProgressBar));

    const segmentURLs = [];
    for(const segment of segments) {
      segmentURLs.push(new URL(segment.uri, entry.uri).href);
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
    for(const value of Object.values(data)){
      try{
        const data2 = JSON.parse(value).d.data.content.playables[0];
        return [
          data2.title,
          data2.itunesMediaApiData.offers[0].hlsUrl
        ];
      }
      catch(ignore){}
    }
    throw new Error('URL not found!');
  },
	'itunes.apple.com': data => {
    data = Object.values(data)[0];
  	return [
      data.data.attributes.name,
      findUrl(data.included)
    ];
  }
}

async function parseData(text) {
  const data = JSON.parse(text);
  const [name, m3u8Url] = parsers[document.location.hostname](data);
  const button = document.createElement('a');
  button.classList.add('we-button');
  button.classList.add('we-button--compact');
  button.classList.add('commerce-button');
  button.style.position = 'absolute';
  button.style.zIndex = '99999998';
  button.style.top = '45px';
  button.style.left = '5px';
  button.style.padding = '3px 8px';
  button.href = '#';
  button.innerHTML = 'Download subtitles';
  button.addEventListener('click', e => {
    download(name, m3u8Url);
  });
  document.body.append(button);
}

(async () => {
  const element = document.querySelector('#shoebox-ember-data-store, #shoebox-uts-api');
  if(element !== null) {
    try {
      await parseData(element.textContent);
    }
    catch(error) {
      console.error(error);
      alert('Uncaught error!\nLine: ' + error.lineNumber + '\n' + error);
    }
  }
})();
