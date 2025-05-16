# UserScripts

## Amazon Video - subtitle downloader

Adds buttons to download subtitles in `.srt` format for movie, season and episode.

Install from [here](https://github.com/Tithen-Firion/UserScripts/raw/master/Amazon_Video_-_subtitle_downloader.user.js), [OpenUserJS](https://openuserjs.org/scripts/Tithen-Firion/Amazon_Video_-_subtitle_downloader) or [Greasyfork](https://greasyfork.org/pl/scripts/34885-amazon-video-subtitle-downloader).

## Netflix - subtitle downloader

Allows you to download subs from Netflix shows and movies.

Text based subtitles are downloaded in `.srt` format. Basic font formatting is supported: bold, italic, underline, color and position (by default turned off in options; only top and bottom of a screen).

Image based subtitles are downloaded as a `.zip`. Inside you've got all subs in `.png` format and `.xml` file with timestamps which can be opened in Subtitle Edit for OCR. Let me know if other programs can open it.

You can also convert them to other image based formats:
Select **Tools** -> **Batch** convert, add `.xml` file(s) to **Input files** box, select **Format** and hit **Convert**.

Or using command line:
`SubtitleEdit /convert "F:\subs\test\manifest_ttml2.xml" Blu-raysup`
`Blu-raysup` for `.sup` files
`VobSub` for `.sub` files

Install from [here](https://github.com/Tithen-Firion/UserScripts/raw/master/Netflix_-_subtitle_downloader.user.js), [OpenUserJS](https://openuserjs.org/scripts/Tithen-Firion/Netflix_-_subtitle_downloader) or [Greasyfork](https://greasyfork.org/pl/scripts/26654-netflix-subtitle-downloader).

# Libraries

## xhrHijacker

Allows to hijack XHR whether you're using `@grant` in UserScripts or not. You can change method, url, add headers, abort, use loaded data. You can't change loaded data though.

Example usage:

```javascript
// ==UserScript==
// ...
// @require https://cdn.rawgit.com/Tithen-Firion/UserScripts/7bd6406c0d264d60428cfea16248ecfb4753e5e3/libraries/xhrHijacker.js?version=1.0
// ==/UserScript==

xhrHijacker(function(xhr, id, origin, args) {
  // id is unique string, use it to recognise your xhr between ready states
  // origin can be: open|send|readystatechange|load
  // args are used only with origin set to open or send
  if(origin == "open") {
    // happens before real open
    args[0] = "GET";
  } else if(origin == "send") {
    // happens before real send
    xhr.setRequestHeader("X-Foo", "Bar");
  } else if(origin == "readystatechange") {
    //you can abort XHR after it is sent
    if(xhr.readyState == 2)
      xhr.abort();
  } else if(origin == "load") {
    console.log(xhr.getAllResponseHeaders());
    console.log(xhr.responseType);
    console.log(xhr.response);
    console.log(xhr.status);
  }
});
```

# Links for testing

Links to free stuff so I don't have to search for them over and over again:

## Free TV series
https://www.amazon.de/gp/video/detail/B0CNDD43YH Tom Clancy's Jack Ryan  
https://www.amazon.de/gp/video/detail/B09PQM5S8T Bosch: Legacy  
https://www.amazon.de/gp/video/detail/B0D1GTMSP3 7 vs. Wild

## Free movies (there's a whole category)
https://www.amazon.de/gp/video/detail/B01HC649YM NO SUBTITLES: Android Cop  
https://www.amazon.de/gp/video/detail/B09SB1522V AUTO GERMAN SUBS: Dark Crimes  
https://www.amazon.de/gp/video/detail/B0CBD8B6LL Agent Cody Banks

