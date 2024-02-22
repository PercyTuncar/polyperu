

function getQueryVariable(variable) {
  //Extracts query string variables
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0].toLowerCase() == variable.toLowerCase()) {
      return pair[1].toLowerCase();
    }
  }
}
const allowedPath = ["/company/contact/sales", "/promotions/realconnect-trial", "/pages/hybrid-work", "/promotions/emea-free-trial-studio-p15", "/promotions/emea-free-trial-studio-p5", "/promotions/my-first-room", "/promotions/hybrid-try-and-buy", "/products/headsets/voyager/voyager-free-60/notify-when-available", "/resources/docs/meeting-equality-frost-sullivan", "/promotions/emea-cc-headset-trial", "/promotions/emea-uc-headset-trial", "/promotions/move-to-cloud", "/reference/edge-e-notify-when-available", "/promotions/poly-studio-trade-in", "/pages/response-brand", "/pages/buyer-guide", "/pages/buyers-guide-2022", "/all-together", "/all-together/microsoft", "/all-together/zoom", "/pages/room-video-buyers-guide", "/promotions/ready-set-zoom", "/pages/eloqua-test11", "/solutions/platform/zoom/demos", "/promotions/rent-device"];
const messageArr = [];
const polycomPage = {
  //captures poly.com page URL
  parameter: "parentPage",
  value: window.location.href,
};
const cclc = {
  //captures country-language code
  parameter: "cclc",
  value: window.location.pathname
    .split("https://www.poly.com/")
    .slice(1, 3)
    .join("-")
    .toLowerCase(),
};
const polycomPath = {
  //captures poly.com page path
  parameter: "path",
  value:
    "/" + window.location.pathname.split("https://www.poly.com/").slice(3).join("https://www.poly.com/").toLowerCase(),
};
const tyPage = {
  //generates TY page URL
  parameter: "tyPage",
  value: window.location.href.split("?")[0] + "/thank-you",
};
if(getQueryVariable('bmta_id')){
const bMTActivityIDMostRecent1 = {
  parameter: "bMTActivityIDMostRecent1",
  value: getQueryVariable('bmta_id'),
};
messageArr.push(bMTActivityIDMostRecent1);
};
messageArr.push(polycomPage, cclc, polycomPath, tyPage);
const parameters = [
  //query string parameters that we want captured
  "jumpid",
  "utm_medium",
  "utm_source",
  "utm_campaign",
  "utm_content",
  "utm_offer",
  "utm_term",
];

console.log('jQuery');
console.log(typeof $);

function jQueryWait() {
if (window.hasOwnProperty("jQuery")) {
  console.log('jQuery loaded');
$.each(parameters, function (index, item) {
  //captures available query string parameters
  if (getQueryVariable(item)) {
    let message = {};
    message["parameter"] = item;
    message["value"] = getQueryVariable(item);
    messageArr.push(message);
  }
});
const iframe = $('[src="https://reinvent.hp.com/polycom-iframe"]');
iframe.on("load", function () {
  if ( !allowedPath.includes(polycomPath.value) || cclc.value.split('-')[0] == "cn"){
    iframe.remove();
    return;
  }else if (polycomPath.value == "/promotions/my-first-room") {
    iframe.attr("height", "1850"); //set iframe height for MFR to avoid scrollbar
  }else {
    iframe.attr("height", "1200"); //set iframe height to avoid scrollbar
  }
  iframe[0].contentWindow.postMessage(messageArr, "https://reinvent.hp.com/"); //push captured information to iframe
  $("<style type='text/css' id='elqStyle'> .column-control {display:block;} @media (min-width:992px){ .column-control{ display:flex;} }</style>").appendTo("head");
});
}else {
  console.log('waiting for jQuery');
  setTimeout(function() { jQueryWait() }, 50);
}
}

jQueryWait();

