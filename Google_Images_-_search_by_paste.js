// ==UserScript==
// @name        Google Images - search by paste
// @description Reverse search an image by pasting it
// @license     MIT
// @version     1.0.0
// @namespace   tithen-firion.github.io
// @match       *://images.google.com/*
// @grant       GM.xmlHttpRequest
// @grant       GM_xmlhttpRequest
// @require     https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// ==/UserScript==

document.body.addEventListener('paste', e => {
  for(let item of e.clipboardData.items) {
    if(item.type.indexOf('image') > -1) {
      let data = new FormData();
      data.set('encoded_image', item.getAsFile());
      GM.xmlHttpRequest({
        url: 'https://images.google.com/searchbyimage/upload',
        method: 'post',
        data: data,
        onload: response => {
          document.location = response.finalUrl;
        }
      });
      e.preventDefault();
      return;
    }
  }
});
