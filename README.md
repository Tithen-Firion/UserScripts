# UserScripts

## Amazon Video - subtitle downloader

Adds buttons to download subtitles in `.srt` format for movie, season and episode.

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
