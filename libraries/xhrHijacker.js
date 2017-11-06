/* 1.0
 * By Tithen-Firion
 * License: MIT
 */

var xhrHijacker = xhrHijacker || function(process) {
  if(typeof process != "function") {
    process = function(){ console.log(arguments); };
  }
  function postMyMessage(from_, detail, arg1, arg2, arg3) {
    if(typeof arg1 == "string")
      detail = {
        xhr: detail,
        origin: arg1,
        id: arg2,
        args: arg3
      };
    window.dispatchEvent(new CustomEvent("xhrHijacker_message_from_" + from_, {detail: detail}));
  }
  function processMessage(e) {
    var d = e.detail;
    process(d.xhr, d.id, d.origin, d.args);
    postMyMessage("userscript", d);
  }
  window.addEventListener("xhrHijacker_message_from_injected", processMessage, false);
  function injection() {
    var xhrs = {};
    var real = {
      open: XMLHttpRequest.prototype.open,
      send: XMLHttpRequest.prototype.send
    }
    function addRandomProperty(object, data, prefix) {
      if(typeof prefix != "string")
        prefix = "";
      var x;
      do {
        x = prefix + Math.random();
      } while(object.hasOwnProperty(x));
      object[x] = data;
      return x;
    }
    function searchForPropertyName(object, data) {
      for(var e in object) {
        if(object.hasOwnProperty(e) && object[e] == data)
          return e;
      }
    }
    function processMessage(e) {
      var d = e.detail;
      var args;
      if(typeof d.args === "object") {
        // args = Array.prototype.slice.call(d.args, 0); // doesn't work
        args = [];
        for(var i = d.args.length-1; i >= 0; --i)
          args[i] = d.args[i];
      } else
        args = d.args;
      if(d.origin == "open" || d.origin == "send" ) {
        real[d.origin].apply(d.xhr, args);
      } else if(d.origin == "load") {
        delete xhrs[d.id];
      }
    }
    window.addEventListener("xhrHijacker_message_from_userscript", processMessage, false);
    XMLHttpRequest.prototype.open = function() {
      var id = addRandomProperty(xhrs, this);
      this.addEventListener("load", function() {
        postMyMessage("injected", this, "load", id);
      }, false);
      this.addEventListener("readystatechange", function() {
        postMyMessage("injected", this, "readystatechange", id);
      }, false);
      postMyMessage("injected", this, "open", id, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
      var id = searchForPropertyName(xhrs, this);
      postMyMessage("injected", this, "send", id, arguments);
    };
  }
  var grantUsed = false;
  if(typeof unsafeWindow !== 'undefined' && window !== unsafeWindow) {
    var x;
    do {
      x = Math.random();
    } while(window.hasOwnProperty(x) || unsafeWindow.hasOwnProperty(x));
    if(!unsafeWindow[x])
      grantUsed = true;
    delete window[x];
  }
  console.time("xhrHijacker - injecting code");
  if(grantUsed) {
    console.info("xhrHijacker - inject");
    window.setTimeout(postMyMessage.toString() + "(" + injection.toString() + ")()", 0);
  } else {
    console.info("xhrHijacker - execute");
    injection();
  }
  console.timeEnd("xhrHijacker - injecting code");
};
