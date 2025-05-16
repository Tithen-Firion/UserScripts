// ==UserScript==
// @name        Amazon Video - subtitle downloader
// @description Allows you to download subtitles from Amazon Video
// @license     MIT
// @version     2.0.0
// @namespace   tithen-firion.github.io
// @match       https://*.amazon.com/*
// @match       https://*.amazon.de/*
// @match       https://*.amazon.co.uk/*
// @match       https://*.amazon.co.jp/*
// @match       https://*.primevideo.com/*
// @grant       unsafeWindow
// @require     https://cdn.jsdelivr.net/gh/Stuk/jszip@579beb1d45c8d586d8be4411d5b2e48dea018c06/dist/jszip.min.js?version=3.1.5
// @require     https://cdn.jsdelivr.net/gh/eligrey/FileSaver.js@283f438c31776b622670be002caf1986c40ce90c/dist/FileSaver.min.js?version=2018-12-29
// ==/UserScript==

class ProgressBar {
  constructor(max) {
    this.current = 0;
    this.max = max;

    let container = document.querySelector("#userscript_progress_bars");
    if(container === null) {
      container = document.createElement("div");
      container.id = "userscript_progress_bars"
      document.body.appendChild(container)
      container.style
      container.style.position = "fixed";
      container.style.top = 0;
      container.style.left = 0;
      container.style.width = "100%";
      container.style.background = "red";
      container.style.zIndex = "99999999";
    }

    this.progressElement = document.createElement("div");
    this.progressElement.innerHTML = "Click to stop";
    this.progressElement.style.cursor = "pointer";
    this.progressElement.style.fontSize = "16px";
    this.progressElement.style.textAlign = "center";
    this.progressElement.style.width = "100%";
    this.progressElement.style.height = "20px";
    this.progressElement.style.background = "transparent";
    this.stop = new Promise(resolve => {
      this.progressElement.addEventListener("click", () => {resolve(STOP_THE_DOWNLOAD)});
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

const STOP_THE_DOWNLOAD = "AMAZON_SUBTITLE_DOWNLOADER_STOP_THE_DOWNLOAD";
const TIMEOUT_ERROR = "AMAZON_SUBTITLE_DOWNLOADER_TIMEOUT_ERROR";
const DOWNLOADER_MENU = "subtitle-downloader-menu";

const DOWNLOADER_MENU_HTML = `
<ol>
<li class="header">Amazon subtitle downloader</li>
<li class="ep-title-in-filename">Add episode title to filename: <span></span></li>
<li class="incomplete">Scroll to the bottom to load more episodes</li>
</ol>
`;

const SCRIPT_CSS = `
#${DOWNLOADER_MENU} {
  position: absolute;
  display: none;
  width: 600px;
  top: 0;
  left: calc( 50% - 150px );
}
#${DOWNLOADER_MENU} ol {
  list-style: none;
  position: relative;
  width: 300px;
  background: #333;
  color: #fff;
  padding: 0;
  margin: 0;
  font-size: 12px;
  z-index: 99999998;
}
body:hover #${DOWNLOADER_MENU} { display: block; }
#${DOWNLOADER_MENU} li {
  padding: 10px;
  position: relative;
}
#${DOWNLOADER_MENU} li.header { font-weight: bold; }
#${DOWNLOADER_MENU} li:not(.header):hover { background: #666; }
#${DOWNLOADER_MENU} li:not(.header) {
  display: none;
  cursor: pointer;
}
#${DOWNLOADER_MENU}:hover li { display: block; }
#${DOWNLOADER_MENU} li > div {
  display: none;
  position: absolute;
  top: 0;
  left: 300px;
}
#${DOWNLOADER_MENU} li:hover > div { display: block; }

body:not(.asd-more-eps) #${DOWNLOADER_MENU} .incomplete { display: none; }

#${DOWNLOADER_MENU}:not(.series) .series{ display: none; }
#${DOWNLOADER_MENU}.series .not-series{ display: none; }
`;

const EXTENSIONS = {
  "TTMLv2": "ttml2",
  "DFXP": "dfxp"
}

let INFO_URL = null;
const INFO_CACHE = new Map();

let epTitleInFilename = localStorage.getItem("ASD_ep-title-in-filename") === "true";

const setEpTitleInFilename = () => {
  document.querySelector(`#${DOWNLOADER_MENU} .ep-title-in-filename > span`).innerHTML = (epTitleInFilename ? "on" : "off");
};

const toggleEpTitleInFilename = () => {
  epTitleInFilename = !epTitleInFilename;
  if(epTitleInFilename)
    localStorage.setItem("ASD_ep-title-in-filename", epTitleInFilename);
  else
    localStorage.removeItem("ASD_ep-title-in-filename");
  setEpTitleInFilename();
};

const showIncompleteWarning = () => {
  document.body.classList.add("asd-more-eps");
};
const hideIncompleteWarning = () => {
  try {
    document.body.classList.remove("asd-more-eps");
  }
  catch(ignore) {}
};
const scrollDown = () => {
  (
    document.querySelector('[data-testid="dp-episode-list-pagination-marker"]')
    || document.querySeledtor("#navFooter")
  ).scrollIntoView();
};

// XML to SRT
const parseTTMLLine = (line, parentStyle, styles) => {
  const topStyle = line.getAttribute("style") || parentStyle;
  let prefix = "";
  let suffix = "";
  let italic = line.getAttribute("tts:fontStyle") === "italic";
  let bold = line.getAttribute("tts:fontWeight") === "bold";
  let ruby = line.getAttribute("tts:ruby") === "text";
  if(topStyle !== null) {
    italic = italic || styles[topStyle][0];
    bold = bold || styles[topStyle][1];
    ruby = ruby || styles[topStyle][2];
  }

  if(italic) {
    prefix = "<i>";
    suffix = "</i>";
  }
  if(bold) {
    prefix += "<b>";
    suffix = "</b>" + suffix;
  }
  if(ruby) {
    prefix += "(";
    suffix = ")" + suffix;
  }

  let result = "";

  for(const node of line.childNodes) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.split(":").pop().toUpperCase();
      if(tagName === "BR") {
        result += "\n";
      }
      else if(tagName === "SPAN") {
        result += parseTTMLLine(node, topStyle, styles);
      }
      else {
        console.log("unknown node:", node);
        throw "unknown node";
      }
    }
    else if(node.nodeType === Node.TEXT_NODE) {
      result += prefix + node.textContent + suffix;
    }
  }

  return result;
};
const xmlToSrt = (xmlString, lang) => {
  try {
    let parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const styles = {};
    for(const style of xmlDoc.querySelectorAll("head styling style")) {
      const id = style.getAttribute("xml:id");
      if(id === null) throw "style ID not found";
      const italic = style.getAttribute("tts:fontStyle") === "italic";
      const bold = style.getAttribute("tts:fontWeight") === "bold";
      const ruby = style.getAttribute("tts:ruby") === "text";
      styles[id] = [italic, bold, ruby];
    }

    const regionsTop = {};
    for(const style of xmlDoc.querySelectorAll("head layout region")) {
      const id = style.getAttribute("xml:id");
      if(id === null) throw "style ID not found";
      const origin = style.getAttribute("tts:origin") || "0% 80%";
      const position = parseInt(origin.match(/\s(\d+)%/)[1]);
      regionsTop[id] = position < 50;
    }

    const topStyle = xmlDoc.querySelector("body").getAttribute("style");

    console.log(topStyle, styles, regionsTop);

    const lines = [];
    const textarea = document.createElement("textarea");

    let i = 0;
    for(const line of xmlDoc.querySelectorAll("body p")) {
      let parsedLine = parseTTMLLine(line, topStyle, styles);
      if(parsedLine != "") {
        if(lang.indexOf("ar") == 0)
          parsedLine = parsedLine.replace(/^(?!\u202B|\u200F)/gm, "\u202B");

        textarea.innerHTML = parsedLine;
        parsedLine = textarea.value;
        parsedLine = parsedLine.replace(/\n{2,}/g, "\n");

        const region = line.getAttribute("region");
        if(regionsTop[region] === true) {
          parsedLine = "{\\an8}" + parsedLine;
        }

        lines.push(++i);
        lines.push((line.getAttribute("begin") + " --> " + line.getAttribute("end")).replace(/\./g,","));
        lines.push(parsedLine);
        lines.push("");
      }
    }
    return lines.join("\n");
  }
  catch(e) {
    console.error(e);
    alert("Failed to parse XML subtitle file, see browser console for more details");
    return null;
  }
};

const sanitizeName = name => name.replace(/[:*?"<>|\\\/]+/g, "_").replace(/ /g, ".").replace(/\.{2,}/g, ".");

const asyncSleep = (seconds, value) => new Promise(resolve => {
  window.setTimeout(resolve, seconds * 1000, value);
});

const getName = (episodeId, addTitle, addSeriesName) => {
  let seasonNumber = 0;
  let digits = 2;
  let seriesName = "UNKNOWN";

  const info = INFO_CACHE.get(episodeId);
  const season = INFO_CACHE.get(info.show);
  if(typeof season !== "undefined") {
    seasonNumber = season.season;
    digits = season.digits;
    seriesName = season.title;
  }

  let title = (
    "S" + seasonNumber.toString().padStart(2, "0")
    + "E" + info.episode.toString().padStart(digits, "0")
  );

  if(addTitle)
    title += " " + info.title;

  if(addSeriesName)
    title = seriesName + " " + title;

  return title;
};

const createQueue = ids => {
  let archiveName = null;
  const names = new Set();
  const queue = new Map();
  for(const id of ids) {
    const info = JSON.parse(JSON.stringify(INFO_CACHE.get(id)));
    let name;
    if(info.type === "movie") {
      archiveName = sanitizeName(info.title + "." + info.year);
      name = archiveName;
    }
    else if(info.type === "episode") {
      name = sanitizeName(getName(id, epTitleInFilename, true));
      if(archiveName === null) {
        try {
          const series = INFO_CACHE.get(info.show);
          archiveName = sanitizeName(series.title + ".S" + series.season.toString().padStart(2, "0"));
        }
        catch(ignore) {}
      }
    }
    else
      continue;

    let subName = name;
    let i = 2;
    while(names.has(subName)) {
      sub_name = `${name}_${i}`;
      ++i;
    }
    names.add(subName);
    info.filename = subName;
    queue.set(id, info);
  }
  if(archiveName === null)
    archiveName = "subs";

  return [archiveName + ".zip", queue];
};

const getSubInfo = async envelope => {
  const response = await fetch(
    INFO_URL,
    {
      "credentials": "include",
      "method": "POST",
      "mode": "cors",
      "body": JSON.stringify({
        "globalParameters": {
          "deviceCapabilityFamily": "WebPlayer",
          "playbackEnvelope": envelope
        },
        "timedTextUrlsRequest": {
          "supportedTimedTextFormats": ["TTMLv2","DFXP"]
        }
      })
    }
  );
  const data = await response.json();
  if(data.globalError) {
    if(data.globalError.code && data.globalError.code === "PlaybackEnvelope.Expired")
      throw "authentication expired, refresh the page and try again";
    else
      throw data.globalError;
  }
  try {
    return data.timedTextUrls.result;
  }
  catch(error) {
    console.log(data);
    throw error;
  }
};

const download = async e => {
  const ids = e.target.getAttribute("data-id").split(";");
  if(ids.length === 1 && ids[0] === "")
    return;

  const [archiveName, queue] = createQueue(ids);
  const metadataProgress = new ProgressBar(queue.size);
  const subs = new Map();
  for(const [id, info] of queue) {
    const resultPromise = getSubInfo(info.envelope);
    let result;
    let error = null;
    try {
      // Promise.any isn't supported in all browsers, use Promise.race instead
      result = await Promise.race([resultPromise, metadataProgress.stop, asyncSleep(30, TIMEOUT_ERROR)]);
    }
    catch(e) {
      console.log(e);
      error = `error: ${e}`;
    }
    if(result === STOP_THE_DOWNLOAD)
      error = "stopped by user";
    else if(result === TIMEOUT_ERROR)
      error = "timeout error";
    if(error !== null) {
      alert(error);
      metadataProgress.destroy();
      return;
    }

    metadataProgress.increment();
    if(typeof result === "undefined")
      continue;

    for(const subtitle of [].concat(result.subtitleUrls || [], result.forcedNarrativeUrls || [])) {
      let lang = subtitle.languageCode;
      if(subtitle.subtype !== "Dialog")
        lang += `[${subtitle.subtype}]`;

      if(subtitle.type === "Subtitle") {}
      else if(subtitle.type === "Sdh")
        lang += "[cc]";
      else if(subtitle.type === "ForcedNarrative")
        lang += "-forced";
      else if(subtitle.type === "SubtitleMachineGenerated")
        lang += "[machine-generated]";
      else
        lang += `[${subtitle.type}]`;

      const name = info.filename + "." + lang;
      let subName = name;
      let i = 2;
      while(subs.has(subName)) {
        sub_name = `${name}_${i}`;
        ++i;
      }
      subs.set(
        subName,
        {
          "url": subtitle.url,
          "type": subtitle.format,
          "language": subtitle.languageCode
        }
      )
    }
  }
  metadataProgress.destroy();

  if(subs.size === 0) {
    alert("no subtitles found");
    return;
  }

  const _zip = new JSZip();
  const progress = new ProgressBar(subs.size);
  for(const [filename, details] of subs) {
    let extension = EXTENSIONS[details.type];
    if(typeof extension === "undefined") {
      const match = details.url.match(/\.([^\/]+)$/);
      if(match === null)
        extension = details.type.toLocaleLowerCase();
      else
        extension = match[1];
    }

    const subFilename = filename + "." + extension;
    const resultPromise = fetch(details.url, {"mode": "cors"});
    let result;
    let error = null;
    try {
      // Promise.any isn't supported in all browsers, use Promise.race instead
      result = await Promise.race([resultPromise, progress.stop, asyncSleep(30, TIMEOUT_ERROR)]);
    }
    catch(e) {
      error = `error: ${e}`;
    }
    if(result === STOP_THE_DOWNLOAD)
      error = STOP_THE_DOWNLOAD;
    else if(result === TIMEOUT_ERROR)
      error = "timeout error";
    if(error !== null) {
      if(error !== STOP_THE_DOWNLOAD)
        alert(error);
      break;
    }
    progress.increment();
    let data;
    if(extension === "ttml2") {
      data = await result.text();
      try {
        const srtFilename = filename + ".srt";
        const srtText = xmlToSrt(data, details.language);
        if(srtText !== null)
          _zip.file(srtFilename, srtText);
      }
      catch(ignore) {}
    }
    else
      data = await result.arrayBuffer();
    _zip.file(subFilename, data);
  }
  progress.destroy();

  const content = await _zip.generateAsync({type: "blob"});
  saveAs(content, archiveName);
};

const addDownloadButtons = parsedActions => {
  const menu = document.querySelector(`#${DOWNLOADER_MENU} > ol`);

  for(const [type, details] of parsedActions) {
    const li = document.createElement("li");
    let ids = null;
    if(type === "movie") {
      li.innerHTML = "Download subtitles for this movie";
      ids = details;
    }
    else if(type === "batch" && details.length > 0) {
      li.innerHTML = "Download subtitles for this batch <div><ol></ol></div>";
      ids = details.join(";");
      const ol = li.querySelector("ol");
      for(const episodeId of details) {
        const li = document.createElement("li");
        li.setAttribute("data-id", episodeId);
        li.innerHTML = getName(episodeId, true, false);
        ol.append(li);
      }
    }
    else
      continue;

    li.setAttribute("data-id", ids);
    li.addEventListener("click", download, true);
    menu.append(li);
  }
};

const parseActions = actions => {
  const parsed = [];
  const series = {};
  for(const [id, playback] of actions) {
    const info = INFO_CACHE.get(id);
    if(typeof info === "undefined")
      continue;
    if(info.type !== "movie" && info.type !== "episode")
      continue;
    if(typeof info.envelope !== "undefined")
      continue;

    try {
      let envelopeFound = false;
      for(const child of playback.main.children) {
        if(typeof child.playbackEnvelope !== "undefined") {
          info.envelope = child.playbackEnvelope;
          info.expiry = child.expiryTime;
          envelopeFound = true;
          break;
        }
      }
      if(!envelopeFound)
        continue;
    }
    catch(error) {
      continue;
    }

    if(info.type === "movie") {
      parsed.push(["movie", id])
    }
    else if(info.type === "episode") {
      let show = series[info.show];
      if(typeof show === "undefined") {
        series[info.show] = [];
        show = series[info.show];
      }
      show.push([id, info.episode]);
    }
  }

  for(const show of Object.values(series)) {
    show.sort((a, b) => a[1] - b[1]);
    const tmp = [];
    for(const [id, ep] of show) {
      tmp.push(id);
    }
    parsed.push(["batch", tmp]);
  }

  return parsed;
};

const parseDetails = (pageTitleId, state, id, details) => {
  if(typeof INFO_CACHE.get(id) !== "undefined")
    return;

  const info = {
    "title": details.title,
    "type": details.titleType
  };
  if(info.type === "movie") {
    info["year"] = details.releaseYear;
  }
  else if(info.type === "episode") {
    info["episode"] = details.episodeNumber;
    info["show"] = pageTitleId;
  }
  else if(info.type === "season") {
    info["season"] = details.seasonNumber;
    info["title"] = details.parentTitle;
    info["digits"] = 2;
    if(pageTitleId === id) {
      try {
        const epCount = state.episodeList.totalCardSize;
        info["digits"] = Math.max(Math.floor(Math.log10(epCount)), 1) + 1;
        if(epCount > state.episodeList.cardTitleIds.length)
          showIncompleteWarning();
      }
      catch(ignore) {}
    }
  }
  else {
    console.log(id, details);
    return;
  }

  INFO_CACHE.set(id, info);
};

const init = (url, fromFetch) => {
  let props = undefined;

  if(typeof fromFetch === "undefined") {
    if(INFO_URL !== null)
      return;

    INFO_URL = url;

    for(const templateElement of document.querySelectorAll('script[type="text/template"]')) {
      let data;
      try {
        data = JSON.parse(templateElement.innerHTML);
        props = data.props.body[0].props;
      }
      catch(ignore) {
        continue;
      }

      if(typeof props !== "undefined")
        break;
    }
  }
  else {
    props = fromFetch.page[0].assembly.body[0].props;
    INFO_CACHE.clear();
    hideIncompleteWarning();
    const menu = document.querySelector(`#${DOWNLOADER_MENU}`);
    if(menu !== null)
      menu.remove();
  }

  const pageTitleId = props.btf.state.pageTitleId;
  for(const [id, details] of Object.entries(props.btf.state.detail.detail)) {
    parseDetails(pageTitleId, props.btf.state, id, details);
  }

  const actions = [];
  for(const [id, action] of Object.entries(props.atf.state.action.atf)) {
    actions.push([id, action.playbackActions]);
  }
  for(const [id, action] of Object.entries(props.btf.state.action.btf)) {
    actions.push([id, action.playbackActions]);
  }
  const parsedActions = parseActions(actions);
  if(parsedActions.length === 0)
    return;

  if(document.querySelector(`#${DOWNLOADER_MENU}`) === null) {
    const menu = document.createElement("div");
    menu.id = DOWNLOADER_MENU;
    menu.innerHTML = DOWNLOADER_MENU_HTML;
    document.body.appendChild(menu);
    menu.querySelector(".ep-title-in-filename").addEventListener("click", toggleEpTitleInFilename);
    menu.querySelector(".incomplete").addEventListener("click", scrollDown);
    setEpTitleInFilename();
  }

  addDownloadButtons(parsedActions);
};

const parseEpisodes = data => {
  const pageTitleId = data.widgets.pageContext.pageTitleId;

  const actions = [];
  for(const episode of data.widgets.episodeList.episodes) {
    parseDetails(pageTitleId, {}, episode.titleID, episode.detail);
    actions.push([episode.titleID, episode.action.playbackActions]);
  }
  const parsedActions = parseActions(actions);
  addDownloadButtons(parsedActions);
};

const processMessage = e => {
  const {type, data} = e.detail;

  if(type === "url")
    init(data);
  else if(type === "episodes")
    parseEpisodes(data);
  else if(type === "page")
    init(null, data);
}

const injection = () => {
  // hijack functions
  ((open, realFetch) => {
    let urlGrabbed = false;

    XMLHttpRequest.prototype.open = function() {
      if(!urlGrabbed && arguments[1] && arguments[1].includes("/GetVodPlaybackResources?")) {
        window.dispatchEvent(new CustomEvent("amazon_sub_downloader_data", {detail: {type: "url", data: arguments[1]}}));
        urlGrabbed = true;
      }
      open.apply(this, arguments);
    };

    window.fetch = async (...args) => {
      const response = realFetch(...args);
      if(!urlGrabbed && args[0] && args[0].includes("/GetVodPlaybackResources?")) {
        window.dispatchEvent(new CustomEvent("amazon_sub_downloader_data", {detail: {type: "url", data: args[0]}}));
        urlGrabbed = true;
      }
      if(args[0] && args[0].includes("/getDetailWidgets?")) {
        const copied = (await response).clone();
        const data = await copied.json();
        window.dispatchEvent(new CustomEvent("amazon_sub_downloader_data", {detail: {type: "episodes", data: data}}));
      }
      else if(args[1] && args[1].headers && args[1].headers["x-requested-with"] === "WebSPA") {
        const copied = (await response).clone();
        const data = await copied.json();
        window.dispatchEvent(new CustomEvent("amazon_sub_downloader_data", {detail: {type: "page", data: data}}));
      }
      return response;
    };
  })(XMLHttpRequest.prototype.open, window.fetch);
}

window.addEventListener("amazon_sub_downloader_data", processMessage, false);

// inject script
const sc = document.createElement("script");
sc.innerHTML = "(" + injection.toString() + ")()";
document.head.appendChild(sc);
document.head.removeChild(sc);

// add CSS style
const s = document.createElement("style");
s.innerHTML = SCRIPT_CSS;
document.head.appendChild(s);
