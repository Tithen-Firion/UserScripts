// ==UserScript==
// @name        Google Images - search by paste
// @description Reverse search an image by pasting it
// @license     MIT
// @version     1.1.0
// @namespace   tithen-firion.github.io
// @match       *://images.google.com/*
// @match       *://www.google.com/*
// @grant       GM.xmlHttpRequest
// @grant       GM_xmlhttpRequest
// @require     https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// ==/UserScript==

document.body.addEventListener('paste', e => {
  for(let item of e.clipboardData.items) {
    if(item.type.indexOf('image') > -1) {
      let progress = document.createElement('div');
      progress.style.position = 'fixed';
      progress.style.top = 0;
      progress.style.left = 0;
      progress.style.width = '5%';
      progress.style.height = '5px';
      progress.style.background = 'green';
      document.body.appendChild(progress);

      let data = new FormData();
      let file = item.getAsFile();
      let fileSize = file.size;
      data.set('encoded_image', file);
      GM.xmlHttpRequest({
        url: 'https://images.google.com/searchbyimage/upload',
        method: 'post',
        data: data,
        onload: response => {
          document.location = response.finalUrl;
        },
        onprogress: response => {
          progress.style.width = response.loaded / fileSize * 100 + '%';
        }
      });
      e.preventDefault();
      return;
    }
  }
});
