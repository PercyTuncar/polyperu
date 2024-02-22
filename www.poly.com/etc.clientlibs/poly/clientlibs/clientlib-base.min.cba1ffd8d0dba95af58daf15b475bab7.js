/*******************************************************************************
 * Copyright 2018 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/

/**
 * Element.matches()
 * https://developer.mozilla.org/enUS/docs/Web/API/Element/matches#Polyfill
 */
if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

// eslint-disable-next-line valid-jsdoc
/**
 * Element.closest()
 * https://developer.mozilla.org/enUS/docs/Web/API/Element/closest#Polyfill
 */
if (!Element.prototype.closest) {
    Element.prototype.closest = function(s) {
        "use strict";
        var el = this;
        if (!document.documentElement.contains(el)) {
            return null;
        }
        do {
            if (el.matches(s)) {
                return el;
            }
            el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === 1);
        return null;
    };
}

/*******************************************************************************
 * Copyright 2018 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
/* global
    CQ
 */
(function() {
    "use strict";

    var dataLayerEnabled;
    var dataLayer;

    var NS = "cmp";
    var IS = "tabs";

    var keyCodes = {
        END: 35,
        HOME: 36,
        ARROW_LEFT: 37,
        ARROW_UP: 38,
        ARROW_RIGHT: 39,
        ARROW_DOWN: 40
    };

    var selectors = {
        self: "[data-" + NS + '-is="' + IS + '"]',
        active: {
            tab: "cmp-tabs__tab--active",
            tabpanel: "cmp-tabs__tabpanel--active"
        }
    };

    /**
     * Tabs Configuration
     *
     * @typedef {Object} TabsConfig Represents a Tabs configuration
     * @property {HTMLElement} element The HTMLElement representing the Tabs
     * @property {Object} options The Tabs options
     */

    /**
     * Tabs
     *
     * @class Tabs
     * @classdesc An interactive Tabs component for navigating a list of tabs
     * @param {TabsConfig} config The Tabs configuration
     */
    function Tabs(config) {
        var that = this;

        if (config && config.element) {
            init(config);
        }

        /**
         * Initializes the Tabs
         *
         * @private
         * @param {TabsConfig} config The Tabs configuration
         */
        function init(config) {
            that._config = config;

            // prevents multiple initialization
            config.element.removeAttribute("data-" + NS + "-is");

            cacheElements(config.element);
            that._active = getActiveIndex(that._elements["tab"]);

            if (that._elements.tabpanel) {
                refreshActive();
                bindEvents();
            }

            // Show the tab based on deep-link-id if it matches with any existing tab item id
            var deepLinkItemIdx = CQ.CoreComponents.container.utils.getDeepLinkItemIdx(that, "tab");
            if (deepLinkItemIdx) {
                var deepLinkItem = that._elements["tab"][deepLinkItemIdx];
                if (deepLinkItem && that._elements["tab"][that._active].id !== deepLinkItem.id) {
                    navigateAndFocusTab(deepLinkItemIdx);
                }
            }

            if (window.Granite && window.Granite.author && window.Granite.author.MessageChannel) {
                /*
                 * Editor message handling:
                 * - subscribe to "cmp.panelcontainer" message requests sent by the editor frame
                 * - check that the message data panel container type is correct and that the id (path) matches this specific Tabs component
                 * - if so, route the "navigate" operation to enact a navigation of the Tabs based on index data
                 */
                CQ.CoreComponents.MESSAGE_CHANNEL = CQ.CoreComponents.MESSAGE_CHANNEL || new window.Granite.author.MessageChannel("cqauthor", window);
                CQ.CoreComponents.MESSAGE_CHANNEL.subscribeRequestMessage("cmp.panelcontainer", function(message) {
                    if (message.data && message.data.type === "cmp-tabs" && message.data.id === that._elements.self.dataset["cmpPanelcontainerId"]) {
                        if (message.data.operation === "navigate") {
                            navigate(message.data.index);
                        }
                    }
                });
            }
        }

        /**
         * Returns the index of the active tab, if no tab is active returns 0
         *
         * @param {Array} tabs Tab elements
         * @returns {Number} Index of the active tab, 0 if none is active
         */
        function getActiveIndex(tabs) {
            if (tabs) {
                for (var i = 0; i < tabs.length; i++) {
                    if (tabs[i].classList.contains(selectors.active.tab)) {
                        return i;
                    }
                }
            }
            return 0;
        }

        /**
         * Caches the Tabs elements as defined via the {@code data-tabs-hook="ELEMENT_NAME"} markup API
         *
         * @private
         * @param {HTMLElement} wrapper The Tabs wrapper element
         */
        function cacheElements(wrapper) {
            that._elements = {};
            that._elements.self = wrapper;
            var hooks = that._elements.self.querySelectorAll("[data-" + NS + "-hook-" + IS + "]");

            for (var i = 0; i < hooks.length; i++) {
                var hook = hooks[i];
                if (hook.closest("." + NS + "-" + IS) === that._elements.self) { // only process own tab elements
                    var capitalized = IS;
                    capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
                    var key = hook.dataset[NS + "Hook" + capitalized];
                    if (that._elements[key]) {
                        if (!Array.isArray(that._elements[key])) {
                            var tmp = that._elements[key];
                            that._elements[key] = [tmp];
                        }
                        that._elements[key].push(hook);
                    } else {
                        that._elements[key] = hook;
                    }
                }
            }
        }

        /**
         * Binds Tabs event handling
         *
         * @private
         */
        function bindEvents() {
            var tabs = that._elements["tab"];
            if (tabs) {
                for (var i = 0; i < tabs.length; i++) {
                    (function(index) {
                        tabs[i].addEventListener("click", function(event) {
                            navigateAndFocusTab(index);
                        });
                        tabs[i].addEventListener("keydown", function(event) {
                            onKeyDown(event);
                        });
                    })(i);
                }
            }
        }

        /**
         * Handles tab keydown events
         *
         * @private
         * @param {Object} event The keydown event
         */
        function onKeyDown(event) {
            var index = that._active;
            var lastIndex = that._elements["tab"].length - 1;

            switch (event.keyCode) {
                case keyCodes.ARROW_LEFT:
                case keyCodes.ARROW_UP:
                    event.preventDefault();
                    if (index > 0) {
                        navigateAndFocusTab(index - 1);
                    }
                    break;
                case keyCodes.ARROW_RIGHT:
                case keyCodes.ARROW_DOWN:
                    event.preventDefault();
                    if (index < lastIndex) {
                        navigateAndFocusTab(index + 1);
                    }
                    break;
                case keyCodes.HOME:
                    event.preventDefault();
                    navigateAndFocusTab(0);
                    break;
                case keyCodes.END:
                    event.preventDefault();
                    navigateAndFocusTab(lastIndex);
                    break;
                default:
                    return;
            }
        }

        /**
         * Refreshes the tab markup based on the current {@code Tabs#_active} index
         *
         * @private
         */
        function refreshActive() {
            var tabpanels = that._elements["tabpanel"];
            var tabs = that._elements["tab"];

            if (tabpanels) {
                if (Array.isArray(tabpanels)) {
                    for (var i = 0; i < tabpanels.length; i++) {
                        if (i === parseInt(that._active)) {
                            tabpanels[i].classList.add(selectors.active.tabpanel);
                            tabpanels[i].removeAttribute("aria-hidden");
                            tabs[i].classList.add(selectors.active.tab);
                            tabs[i].setAttribute("aria-selected", true);
                            tabs[i].setAttribute("tabindex", "0");
                        } else {
                            tabpanels[i].classList.remove(selectors.active.tabpanel);
                            tabpanels[i].setAttribute("aria-hidden", true);
                            tabs[i].classList.remove(selectors.active.tab);
                            tabs[i].setAttribute("aria-selected", false);
                            tabs[i].setAttribute("tabindex", "-1");
                        }
                    }
                } else {
                    // only one tab
                    tabpanels.classList.add(selectors.active.tabpanel);
                    tabs.classList.add(selectors.active.tab);
                }
            }
        }

        /**
         * Focuses the element and prevents scrolling the element into view
         *
         * @param {HTMLElement} element Element to focus
         */
        function focusWithoutScroll(element) {
            var x = window.scrollX || window.pageXOffset;
            var y = window.scrollY || window.pageYOffset;
            element.focus();
            window.scrollTo(x, y);
        }

        /**
         * Navigates to the tab at the provided index
         *
         * @private
         * @param {Number} index The index of the tab to navigate to
         */
        function navigate(index) {
            that._active = index;
            refreshActive();
        }

        /**
         * Navigates to the item at the provided index and ensures the active tab gains focus
         *
         * @private
         * @param {Number} index The index of the item to navigate to
         */
        function navigateAndFocusTab(index) {
            var exActive = that._active;
            navigate(index);
            focusWithoutScroll(that._elements["tab"][index]);

            if (dataLayerEnabled) {

                var activeItem = getDataLayerId(that._elements.tabpanel[index]);
                var exActiveItem = getDataLayerId(that._elements.tabpanel[exActive]);

                dataLayer.push({
                    event: "cmp:show",
                    eventInfo: {
                        path: "component." + activeItem
                    }
                });

                dataLayer.push({
                    event: "cmp:hide",
                    eventInfo: {
                        path: "component." + exActiveItem
                    }
                });

                var tabsId = that._elements.self.id;
                var uploadPayload = { component: {} };
                uploadPayload.component[tabsId] = { shownItems: [activeItem] };

                var removePayload = { component: {} };
                removePayload.component[tabsId] = { shownItems: undefined };

                dataLayer.push(removePayload);
                dataLayer.push(uploadPayload);
            }
        }
    }

    /**
     * Reads options data from the Tabs wrapper element, defined via {@code data-cmp-*} data attributes
     *
     * @private
     * @param {HTMLElement} element The Tabs element to read options data from
     * @returns {Object} The options read from the component data attributes
     */
    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ["is", "hook" + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    /**
     * Parses the dataLayer string and returns the ID
     *
     * @private
     * @param {HTMLElement} item the accordion item
     * @returns {String} dataLayerId or undefined
     */
    function getDataLayerId(item) {
        if (item && item.dataset.cmpDataLayer) {
            return Object.keys(JSON.parse(item.dataset.cmpDataLayer))[0];
        } else {
            return item.id;
        }
    }

    /**
     * Document ready handler and DOM mutation observers. Initializes Tabs components as necessary.
     *
     * @private
     */
    function onDocumentReady() {
        dataLayerEnabled = document.body.hasAttribute("data-cmp-data-layer-enabled");
        dataLayer = (dataLayerEnabled) ? window.adobeDataLayer = window.adobeDataLayer || [] : undefined;

        var elements = document.querySelectorAll(selectors.self);
        for (var i = 0; i < elements.length; i++) {
            new Tabs({ element: elements[i], options: readData(elements[i]) });
        }

        var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        var body = document.querySelector("body");
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // needed for IE
                var nodesArray = [].slice.call(mutation.addedNodes);
                if (nodesArray.length > 0) {
                    nodesArray.forEach(function(addedNode) {
                        if (addedNode.querySelectorAll) {
                            var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                            elementsArray.forEach(function(element) {
                                new Tabs({ element: element, options: readData(element) });
                            });
                        }
                    });
                }
            });
        });

        observer.observe(body, {
            subtree: true,
            childList: true,
            characterData: true
        });
    }

    if (document.readyState !== "loading") {
        onDocumentReady();
    } else {
        document.addEventListener("DOMContentLoaded", onDocumentReady);
    }

    window.addEventListener("hashchange", window.CQ.CoreComponents.container.utils.locationHashChanged, false);

}());

$(document).ready(function(){
	var anchor_tags = $("a[data-component-prefix]");
      $(anchor_tags).each(function(index) {
          var anchor_element = $(this);
          var component_name = anchor_element.data( "component-prefix");
          var link_path = anchor_element.attr('href') || anchor_element.attr('target') || anchor_element.data( "video") || anchor_element.data( "pn");
          if(link_path) {
            link_path = link_path.split('?intcid=')[0];
            if (link_path.includes('/content/dam')) {
                link_path = link_path.replace("/content/dam", "");
                link_path = link_path.replace("/content", "");
                link_path = link_path.replace("/?intcid=.*/i", "");
                link_path = link_path.split('/').join(':');
                anchor_element.attr('data-asset', component_name+link_path);
            } else {
                link_path = link_path.replace("/content", "");
                link_path = link_path.replace("/?intcid=.*/i", "");
                link_path = link_path.split('/').join(':');
                link_path=link_path.replace(".html", "");
                anchor_element.attr('data-id', component_name+link_path);
            }
          }
       });

        var buttons = $("button[data-component-prefix]");
        $(buttons).each(function(index) {
          var anchor_element = $(this);
          var component_name=anchor_element.data( "component-prefix");
          var link_path= anchor_element.attr('href') || anchor_element.data( "target")|| anchor_element.data( "video") || anchor_element.data( "pn") || anchor_element.attr('id');

          if(link_path) {
            if (link_path.includes('/content/dam')) {
              link_path = link_path.replace("/content/dam", "");
              link_path = link_path.replace("/content", "");
              link_path = link_path.replace("/?intcid=.*/i", "");
              link_path = link_path.split('/').join(':');
              link_path = link_path.replace("/?intcid=.*/i", "");
              anchor_element.attr('data-asset', component_name + link_path);
            } else {
              link_path = link_path.replace("/content", "");
              link_path = link_path.replace("/?intcid=.*/i", "");
              link_path = link_path.split('/').join(':');
              link_path = link_path.replace(".html", "");
              anchor_element.attr('data-id', component_name + link_path);
            }
          }
       });

});
/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright 2015 Adobe Systems Incorporated
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 *
 */
/* global CQURLInfo:false */
(function(window) {
    "use strict";

    window.Granite = window.Granite || {};
    window.Granite.HTTP = window.Granite.HTTP || {};

    var contextPath = null;

    function detectContextPath() {
        // eslint-disable-next-line max-len
        var SCRIPT_URL_REGEXP = /^(?:http|https):\/\/[^/]+(\/.*)\/(?:etc\.clientlibs|etc(\/.*)*\/clientlibs|libs(\/.*)*\/clientlibs|apps(\/.*)*\/clientlibs|etc\/designs).*\.js(\?.*)?$/;
        try {
            if (window.CQURLInfo) {
                contextPath = CQURLInfo.contextPath || "";
            } else {
                var scripts = document.getElementsByTagName("script");
                for (var i = 0; i < scripts.length; i++) {
                    var result = SCRIPT_URL_REGEXP.exec(scripts[i].src);
                    if (result) {
                        contextPath = result[1];
                        return;
                    }
                }
                contextPath = "";
            }
        } catch (e) {
            // ignored
        }
    }

    window.Granite.HTTP.externalize = window.Granite.HTTP.externalize || function(url) {
        if (contextPath === null) {
            detectContextPath();
        }

        try {
            if (url.indexOf("/") === 0 && contextPath && url.indexOf(contextPath + "/") !== 0) {
                url = contextPath + url;
            }
        } catch (e) {
            // ignored
        }

        return url;
    };
})(this);

/*
 * ADOBE CONFIDENTIAL
 *
 * Copyright 2015 Adobe Systems Incorporated
 * All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe Systems Incorporated and its suppliers,
 * if any.  The intellectual and technical concepts contained
 * herein are proprietary to Adobe Systems Incorporated and its
 * suppliers and may be covered by U.S. and Foreign Patents,
 * patents in process, and are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe Systems Incorporated.
 *
 */
(function(factory) {
    "use strict";

    // GRANITE-22281 Check for multiple initialization
    if (window.Granite.csrf) {
        return;
    }

    window.Granite.csrf = factory(window.Granite.HTTP);
}(function(http) {
    "use strict";

    // AdobePatentID="P5296"

    function Promise() {
        this._handler = [];
    }

    Promise.prototype = {
        then: function(resolveFn, rejectFn) {
            this._handler.push({ resolve: resolveFn, reject: rejectFn });
        },
        resolve: function() {
            this._execute("resolve", arguments);
        },
        reject: function() {
            this._execute("reject", arguments);
        },
        _execute: function(result, args) {
            if (this._handler === null) {
                throw new Error("Promise already completed.");
            }

            for (var i = 0, ln = this._handler.length; i < ln; i++) {
                this._handler[i][result].apply(window, args);
            }

            this.then = function(resolveFn, rejectFn) {
                (result === "resolve" ? resolveFn : rejectFn).apply(window, args);
            };

            this._handler = null;
        }
    };

    function verifySameOrigin(url) {
        // url could be relative or scheme relative or absolute
        // host + port
        var host = document.location.host;
        var protocol = document.location.protocol;
        var relativeOrigin = "//" + host;
        var origin = protocol + relativeOrigin;

        // Allow absolute or scheme relative URLs to same origin
        return (url === origin || url.slice(0, origin.length + 1) === origin + "/") ||
                (url === relativeOrigin || url.slice(0, relativeOrigin.length + 1) === relativeOrigin + "/") ||
                // or any other URL that isn't scheme relative or absolute i.e relative.
                !(/^(\/\/|http:|https:).*/.test(url));
    }

    var FIELD_NAME = ":cq_csrf_token";
    var HEADER_NAME = "CSRF-Token";
    var TOKEN_SERVLET = http.externalize("/libs/granite/csrf/token.json");

    var promise;
    var globalToken;

    function logFailRequest(error) {
        if (window.console) {
            // eslint-disable-next-line no-console
            console.warn("CSRF data not available;" +
                    "The data may be unavailable by design, such as during non-authenticated requests: " + error);
        }
    }

    function getToken() {
        var localPromise = new Promise();
        promise = localPromise;

        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    globalToken = data.token;
                    localPromise.resolve(globalToken);
                } catch (ex) {
                    logFailRequest(ex);
                    localPromise.reject(xhr.responseText);
                }
            }
        };
        xhr.open("GET", TOKEN_SERVLET, true);
        xhr.send();

        return localPromise;
    }

    function getTokenSync() {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", TOKEN_SERVLET, false);
        xhr.send();

        try {
            return globalToken = JSON.parse(xhr.responseText).token;
        } catch (ex) {
            logFailRequest(ex);
        }
    }

    function clearToken() {
        globalToken = undefined;
        getToken();
    }

    function addField(form) {
        var action = form.getAttribute("action");
        if (form.method.toUpperCase() === "GET" || (action && !verifySameOrigin(action))) {
            return;
        }

        if (!globalToken) {
            getTokenSync();
        }

        if (!globalToken) {
            return;
        }

        var input = form.querySelector('input[name="' + FIELD_NAME + '"]');

        if (!input) {
            input = document.createElement("input");
            input.setAttribute("type", "hidden");
            input.setAttribute("name", FIELD_NAME);
            form.appendChild(input);
        }

        input.setAttribute("value", globalToken);
    }

    function handleForm(document) {
        var handler = function(ev) {
            var t = ev.target;

            if (t.nodeName === "FORM") {
                addField(t);
            }
        };

        if (document.addEventListener) {
            document.addEventListener("submit", handler, true);
        } else if (document.attachEvent) {
            document.attachEvent("submit", handler);
        }
    }

    handleForm(document);

    var open = XMLHttpRequest.prototype.open;

    XMLHttpRequest.prototype.open = function(method, url, async) {
        if (method.toLowerCase() !== "get" && verifySameOrigin(url)) {
            this._csrf = true;
            this._async = async;
        }

        return open.apply(this, arguments);
    };

    var send = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.send = function() {
        if (!this._csrf) {
            send.apply(this, arguments);
            return;
        }

        if (globalToken) {
            this.setRequestHeader(HEADER_NAME, globalToken);
            send.apply(this, arguments);
            return;
        }

        if (this._async === false) {
            getTokenSync();

            if (globalToken) {
                this.setRequestHeader(HEADER_NAME, globalToken);
            }

            send.apply(this, arguments);
            return;
        }

        var self = this;
        var args = Array.prototype.slice.call(arguments);

        promise.then(function(token) {
            self.setRequestHeader(HEADER_NAME, token);
            send.apply(self, args);
        }, function() {
            send.apply(self, args);
        });
    };

    var submit = HTMLFormElement.prototype.submit;

    HTMLFormElement.prototype.submit = function() {
        addField(this);
        return submit.apply(this, arguments);
    };

    if (window.Node) {
        var ac = Node.prototype.appendChild;

        Node.prototype.appendChild = function() {
            var result = ac.apply(this, arguments);

            if (result.nodeName === "IFRAME") {
                try {
                    if (result.contentWindow && !result._csrf) {
                        result._csrf = true;
                        handleForm(result.contentWindow.document);
                    }
                } catch (ex) {
                    if (result.src && result.src.length && verifySameOrigin(result.src)) {
                        if (window.console) {
                            // eslint-disable-next-line no-console
                            console.error("Unable to attach CSRF token to an iframe element on the same origin");
                        }
                    }

                    // Potential error: Access is Denied
                    // we can safely ignore CORS security errors here
                    // because we do not want to expose the csrf anyways to another domain
                }
            }

            return result;
        };
    }

    // refreshing csrf token periodically
    getToken();

    setInterval(function() {
        getToken();
    }, 300000);

    return {
        initialised: false,
        refreshToken: getToken,
        _clearToken: clearToken
    };
}));

// (function(window, navigator, $) {
//
//   function logError(message, source, line, column, error) {
//     var ajaxUrl = location.pathname + ".jserror.json";
//     if (location.pathname.lastIndexOf(".") > 0) {
//       ajaxUrl = location.pathname.slice(0, location.pathname.lastIndexOf(".")) + ".jserror.json";
//     }
//     $.ajax({
//       url: ajaxUrl,
//       type: "post",
//       data: {
//         "browser": navigator && navigator.userAgent || "Browser N/A",
//         "message": message || "An error occurred",
//         "source": source || "File not available",
//         "line": line || "N/A",
//         "column": column || "N/A",
//         "stack": error && error.stack || "Stack not availalbe"
//       }
//     });
//   }
//
//   window.onerror = function(message, source, line, column,    error) {
//     try {
//       logError(message, source, line, column, error);
//     } catch (e) {
//       console.error(e);
//     }
//   };
// })(window, navigator, jQuery);
"use strict";!function(e,t,n){e.Routes=t.extend(!0,{getEvents:"/get-events",getReviews:"/get-reviews"},e.Routes)}(window,jQuery),function(e,t,n){e.Messages=t.extend(!0,{global:{},EventListingApp:{getEventsAjaxError:"Sorry, we couldn't find any of your events."}},e.Messages)}(window,jQuery);
//# sourceMappingURL=common.min.js.map

"use strict";function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}var Loading=function(){function e(){_classCallCheck(this,e),this.loading=null,this.create()}return _createClass(e,[{key:"create",value:function(){var e=getI18nString("Loading");this.loading=$('<div class="loading"><img src='.concat("/etc.clientlibs/poly/clientlibs/clientlib-site/resources/icons/poly-logo.svg",' alt="Poly Icon" /><p>').concat(e,"</p></div>")),$("body").append(this.loading)}},{key:"destroy",value:function(){this.instance=null,this.loading.remove()}},{key:"show",value:function(){this.loading.css("display","flex"),this.loading.addClass("animate-in")}},{key:"hide",value:function(){var e=this;e.loading.addClass("animate-out"),e.loading.find("img").on("animationend",function(){e.loading.css("display","none")})}}],[{key:"getInstance",value:function(){return this.instance||(this.instance=new e),this.instance}}]),e}();function Notification(){this.observers={}}Notification.prototype={constructor:Notification,subscribe:function(e,t){this.observers[t]=this.observers[t]||[],this.observers[t].push(e)},unsubscribe:function(e,t){this.observers=(this.observers[t]||[]).filter(function(t){return t!==e})},broadcast:function(e,t){(this.observers[t]||[]).forEach(function(t){return t(e)})}};var PolyNotification=function(){var e;return function(){return e||(e=new Notification),e}}();function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}var LoadExternalScript=function(){function e(){_classCallCheck(this,e)}return _createClass(e,null,[{key:"loadScript",value:function(e,t,a){var i=document.createElement("script");i.src=e,i.onload=t,i.onerror=a,document.head.appendChild(i)}}]),e}();function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}var VideoBox=function(){function e(){_classCallCheck(this,e)}return _createClass(e,null,[{key:"initVideo",value:function(e){var t,a=e.closest(".video-box");t="fixed"===e.css("position")?$(window).width()/$(window).height():a.width()/a.height(),e.removeClass("height-auto width-auto");var i=e[0].width/e[0].height;t&&i&&(t>i?e.addClass("height-auto"):e.addClass("width-auto"),new BasicPromo(e).calcClip())}}]),e}();function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}$(window).resize(function(){setTimeout(function(){$(".video-box video").each(function(){VideoBox.initVideo($(this)),new BasicPromo($(this)).checkVideoPosition()})},300)});var AEMGenerateVideo=function(){function e(){_classCallCheck(this,e)}return _createClass(e,null,[{key:"loadVideoViewer",value:function(e){"undefined"==typeof s7viewers||void 0===s7viewers.VideoViewer?LoadExternalScript.loadScript(siteConfig.dmServer+"/s7viewers/html5/js/VideoViewer.js",e):e()}},{key:"initDMVideoJSONToContainer",value:function(t){var a=t.attr("dm-video-path"),i=a.indexOf("/")>=0,n=t.hasClass("video-box"),o=t.hasClass("video-wp"),r=t.hasClass("seq-video-auto"),s=t.hasClass("seq-video-manual"),c=t.hasClass("video-animation");if(a){var l={serverurl:siteConfig.dmServer+"/is/image/",videoserverurl:siteConfig.dmServer+"/is/content",contenturl:siteConfig.dmServer+"/is/content/",config:siteConfig.s7RootPath+"Video",autoplay:o||r||s?"0":"1",loop:n?"1":"0",mutevolume:n||c||o||r?"1":"0",singleclick:n||c?"none":"playPause"};i?l.video=a:(l.asset=siteConfig.s7RootPath+a,l.posterimage=siteConfig.s7RootPath+a),e.loadVideoViewer(function(){new s7viewers.VideoViewer({containerId:t.attr("id"),params:l,handlers:{initComplete:function(){var e=t.find("video");i?e.on("loadedmetadata",function(){VideoBox.initVideo(e)}):VideoBox.initVideo(e),(o||r)&&waypointObserver.observe(e.get(0))}}}).init()})}}}]),e}();$(document).ready(function(){$(".dm-video-container").each(function(){AEMGenerateVideo.initDMVideoJSONToContainer($(this))})});var options={root:null,threshold:[.95]},waypointObserver=new IntersectionObserver(function(e){e.forEach(function(e){e.isIntersecting&&!e.target.currentTime>0&&e.target.play()})},options);function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}$(".text-accordion").on("hide.bs.collapse",function(){var e=$(this).attr("id"),t=$('.btn-toggle-accordion[data-target="#'+e+'"]'),a=t.data("show-text");t.html(a)}),$(".text-accordion").on("show.bs.collapse",function(){var e=$(this).attr("id"),t=$('.btn-toggle-accordion[data-target="#'+e+'"]'),a=t.data("hide-text");t.html(a)}),$(window).width()<768&&$(".mobile-accordion-section").each(function(){$(this).find("div.buy-now-inline").length>0&&($(this).find("h3").removeClass("collapsed"),$(this).find("h3").attr("aria-expanded","true"),$(this).find(".wrapper").addClass("show"))}),function(){function e(e){if(e||(e=window.event),e.newValue)if("getSessionStorage"==e.key)localStorage.setItem("sessionStorage",JSON.stringify(sessionStorage)),localStorage.removeItem("sessionStorage");else if("sessionStorage"==e.key&&!sessionStorage.length){var a=JSON.parse(e.newValue);for(var i in a)sessionStorage.setItem(i,a[i]);t()}}function t(){$(".alert-container").each(function(){var e=$(this).data("editmode"),t=$(this).data("pagetitle")+"-alertClosed";e||($(this).find(".xf-content-height").length<1||"true"==sessionStorage.getItem(t)?$(this).hide():$("header").before($(this))),$(this).find(".close").off("click").on("click",function(){sessionStorage.setItem(t,!0)})})}window.addEventListener?window.addEventListener("storage",e):window.attachEvent("onstorage",e),sessionStorage.length||localStorage.setItem("getSessionStorage",Date.now()),$(document).ready(function(){t()})}(),$(".awards .carousel").carousel({pause:!0,interval:!1}),$(".awards").each(function(){var e=$(this).find(".carousel-item").length,t=$(this).find(".navigate-container");e<2&&t.remove()}),function(){function e(){"MOBILE"==getCurrentBreakpoint()?($(".basic-compare.three-column .product-table").addClass("show-2column"),$(".product-feature-key-header").each(function(){$(this).attr("colspan","2")})):($(".basic-compare.three-column .product-table").removeClass("show-2column"),$(".product-feature-key-header").each(function(){3===$(this).data("colspan")&&$(this).attr("colspan","3")}))}function t(e,t){e.off("change").on("change",function(){!function(e,t,a,i){i.filter(function(e){if(e.productName==t)return!0}).forEach(function(t){a.find(".product-image td").eq(e).find("img").attr("src",t.productImage||""),a.find(".product-path-cta td").eq(e).find("a").attr("href",t.productPath||""),a.find(".product-feature-value").each(function(){$(this).find("td").eq(e).empty(),$(this).find("td").eq(e).append(function(e){var t="";switch(e.valType){case"check-icon":t="true"==e.val?'<span class="check-yes"></span>':'<span class="check-no"></span>';break;case"string":t="<span>".concat(e.val,"</span>");break;case"icon":t='<img src="'.concat(e.val,'" alt="product image"/>')}return t}(function(e,t){var a=e.prev().find("th").data("key");return t.features.filter(function(e){if(e.featureName==a)return!0})[0]||""}($(this),t)))})})}($(this).closest("tr").find("td").index($(this).closest("td")),$(this).find(".value-container").text().trim(),$(this).closest(".product-table"),t)})}function a(){$(".basic-compare").each(function(){var e;(e=$(this)).parents(".in-page-nav__container").length>0&&(e.addClass("in-page-nav-basic-compare"),e.parent().removeClass("fullscreen"),e.find("button.btn").removeClass("btn-primary"),e.find("button.btn").addClass("btn-secondary")),function(e){var t,a=e.parents(".basic-compare-modal"),i=e.parents(".basic-compare-modal").attr("id");e.parents().find("#product-detail").length&&a.length&&(t=e.parents().find("#product-detail .btn-basic-compare-modal"),a.prev().hide(),t.show(),t.attr("data-target","#"+i)),e.parents().find(".poly-specifications").length&&a.length&&(a.prev().hide(),(t=e.parents().find(".poly-specifications .btn-compare")).show(),t.attr("data-target","#"+i))}($(this));var a=$(this).find(".products-data").data("products"),i=a?JSON.parse(a):[],n=$(this).find(".product-table").hasClass("show-2column")?2:$(this).find(".product-selector").length;""!=i&&i.length>n?$(this).find(".product-selector").each(function(){$(this).hasClass("dropdown-mark")||$(this).addClass("dropdown-mark"),t($(this),i);var e=$(this).customDropdown(),a=function(e){return e.map(function(e){return{id:e.id,text:e.productName}})}(i);e.updateArr(a,".product-name",".show-2column",!0)}):$(this).find(".product-selector").removeClass("dropdown-mark")})}$(".basic-compare .see-full").click(function(){var e=$(this).closest(".basic-compare");e.find(".product-feature-key:gt(9)").show(),e.find(".product-feature-value:gt(9)").show(),e.find(".hide-full").css("display","inline-block"),$(this).hide()}),$(".basic-compare .hide-full").click(function(){var e=$(this).closest(".basic-compare");e.find(".product-feature-key:gt(9)").hide(),e.find(".product-feature-value:gt(9)").hide(),e.find(".see-full").css("display","inline-block"),$(this).hide()}),$(".basic-compare.basic-compare-modal .category-modal-close-btn").click(function(){$(this).closest(".basic-compare").hide()}),$(window).resize(function(){e(),a()}),$(".basic-compare").prev("button").click(function(){$(".basic-compare.basic-compare-modal").show()}),$(document).ready(function(){$(".basic-compare .hide-full").click(),e(),a()})}();var BasicPromo=function(){function e(t){_classCallCheck(this,e),this.element=t}return _createClass(e,[{key:"resetClip",value:function(){this.element.css({position:"absolute",clip:"unset","-webkit-clip-path":"unset"})}},{key:"setClip",value:function(e){var t=this.element,a=t.height(),i="auto"===e.bottom?"auto":e.bottom+"px",n="auto"===e.bottom?"0":a-e.bottom;t.css({position:"fixed",clip:"rect(".concat(e.top,"px, auto, ").concat(i,", 0px)"),"-webkit-clip-path":"inset(".concat(e.top,"px 0 ").concat(n,"px 0)")})}},{key:"checkVideoPosition",value:function(){var e=this.element,t=$(window).height(),a=$(window).scrollTop(),i=0,n=e.closest(".promo-basic");n.length&&((i=n.offset().top)<t||i<=a+t?(e.css("position","fixed"),VideoBox.initVideo(e)):this.resetClip(e))}},{key:"calcClip",value:function(){var e=this.element,t=$(window).height(),a=$(window).scrollTop(),i=e.closest(".promo-basic"),n=0;if(i.length)if((n=i.offset().top)<t||n<=a+t)if("fixed"===e.css("position")||e.hasClass("pixel-bg")||e.hasClass("img-box")){var o=e.closest(".bg-box").height(),r=e.height(),s=r-t,c=a+t-n,l=e.css("top")||0,d=e.css("bottom")||0;if(c>0&&c<o){var u=0;u="0px"===l?t-c:"0px"===d?t-c+s:r-c-s/2,this.setClip({top:u,right:"auto",bottom:"auto",left:"0"})}else if(c>o&&c<t+o){var p=0;p="0px"===l?t+o-c:"0px"===d?t+o-c+s:t+o-c+s/2,c<t?this.setClip({top:t-c,right:"auto",bottom:p,left:"0"}):this.setClip({top:"0",right:"auto",bottom:p,left:"0"})}else c>t+o&&this.resetClip()}else this.checkVideoPosition();else this.resetClip()}}]),e}();function _slicedToArray(e,t){return _arrayWithHoles(e)||_iterableToArrayLimit(e,t)||_nonIterableRest()}function _nonIterableRest(){throw new TypeError("Invalid attempt to destructure non-iterable instance")}function _iterableToArrayLimit(e,t){if(Symbol.iterator in Object(e)||"[object Arguments]"===Object.prototype.toString.call(e)){var a=[],i=!0,n=!1,o=void 0;try{for(var r,s=e[Symbol.iterator]();!(i=(r=s.next()).done)&&(a.push(r.value),!t||a.length!==t);i=!0);}catch(e){n=!0,o=e}finally{try{i||null==s.return||s.return()}finally{if(n)throw o}}return a}}function _arrayWithHoles(e){if(Array.isArray(e))return e}!function(){var e=(/iPad|iPhone|iPod|Android/.test(navigator.userAgent)||"MacIntel"===navigator.platform&&navigator.maxTouchPoints>1)&&!window.MSStream;function t(){$(".promo-basic .pixel-bg").each(function(){new BasicPromo($(this)).calcClip()})}function a(){$(".promo-basic .img-box").each(function(){new BasicPromo($(this)).calcClip()})}$(window).scroll(function(){t(),$(".promo-basic video").each(function(){new BasicPromo($(this)).checkVideoPosition()}),e&&a()}),$(window).resize(function(){t(),e&&a()}),$(document).ready(function(){t(),e&&($(".promo-basic .img-box").css("background-attachment","scroll"),a())})}(),function(e,t,a){digitalData.site.countryCode;var i,n=siteConfig.bvAPIUrl,o=e.location.protocol+n;e.loadBazaarvoiceApi=function(e){return i||(i=t.Deferred(),t.ajax({url:o,cache:!0,dataType:"script",success:function(){i.resolve()}})),i.then(e),i}}(window,jQuery),$(document).ready(function(){var e,t,a,i=null,n=null;function o(e){var a=$("."+t+" [data-model="+e+"]");a.siblings().removeClass("active"),a.addClass("active");var i=$("."+t+" .price[data-model="+e+"]"),n=i.data("pn"),o=i.data("preorder"),r=$("."+t+" .buy-button");r.removeAttr("data-pn"),r.attr("data-pn",n),r.removeAttr("data-preorder"),r.attr("data-preorder",o),$(".buy-button").each(function(){"true"==$(this).attr("data-preorder")?($(this).hide(),$(this).next().show()):($(this).show(),$(this).next().hide())})}$(".buy-button").each(function(){"true"==$(this).attr("data-preorder")&&($(this).hide(),$(this).next().show())}),$(".btn-cat-buy-now").on("click",function(){var r=$(".cat-item.active").attr("data-rm");$(".polyPlus").each(function(e){$(this).attr("data-related-model")==r&&$(this).show()});var s=$(this).attr("data-card-id");t="commerce-modal"+s,a="commerceModelSelector"+s,i=$("."+t+" .product-gallery"+s),n=$("."+t+" #"+a),e=n.customDropdown(),n.change(function(){var e,t=n.find(".item.active").attr("data-item"),a=i.find(".carousel-item[data-item="+t+"]").index();o(t),e=a,i.carousel(e),function(){var e=$(".cat-item.active").attr("data-rm");$(".polyPlus").each(function(t){var a=$(this).attr("data-related-model");a==e?$(this).show():$(this).hide()})}()}),i.carousel({pause:!0,interval:!1}),i.on("slide.bs.carousel",function(t){var a=$(t.relatedTarget).attr("data-item");o(a),function(t){var a=n.find(".cat-item[id="+t+"]");a.siblings().removeClass("active"),a.addClass("active"),e.updateSelected(a)}(a)})}),$(".buy-now-modal").each(function(){$(this).data("ids"),$(this).data("showratings")&&"true"==siteConfig.showBV&&loadBazaarvoiceApi(function(){})})}),$(document).ready(function(){var e=$("#buy-now").attr("data-preorder");null!=e&&"true"==e&&($("#buy-now").hide(),$("#preorder").show());var t=$("#buy-now-il").attr("data-preorder");null!=t&&"true"==t&&($("#buy-now-il").hide(),$("#preorder-il").show()),$(".form-check-input").click(function(){$(".form-check-input").not(this).prop("checked",!1)});var a=$(".price.active .base-price").eq(1);a.length<1&&(a=$(".price.active .base-price").eq(0));var i,n,o=a.text();$(".form-check-input").click(function(){if($(this).is(":checked")){void 0===i&&(n=$(".price.active .salePrice").eq(0),i=n.text());var e=$(this).attr("data-price"),t=currency(e).add(o),r=currency(e).add(i),s=function(e){return currency(e,{symbol:"€",decimal:",",separator:".",pattern:"# !"})},c=function(e){return currency(e,{symbol:"£"})};a.empty(),n.empty();var l=document.location.href;-1!=l.indexOf("/de/de")||-1!=l.indexOf("/fr/fr")||-1!=l.indexOf("/es/es")||-1!=l.indexOf("/ie/en")?(a.append('<span class="base-price">'+s(t).format()+"</span>"),n.append('<span class="salePrice">'+s(r).format()+"</span>")):-1!=l.indexOf("gb/en")?(a.append('<span class="base-price">'+c(t).format()+"</span>"),n.append('<span class="salePrice">'+c(r).format()+"</span>")):(a.append('<span class="base-price">'+t.format()+"</span>"),n.append('<span class="salePrice">'+r.format()+"</span>"))}else a.empty(),a.append('<span class="base-price">'+o+"</span>"),n.empty(),n.append('<span class="salePrice">'+i+"</span>")}),$(".dr-add-to-cart").on("click",function(){h()}),$(".inline-dropdown").each(function(){$(this).hasClass("single-item")&&$(this).hide()});var r=$(".commerce-modal .product-gallery"),s=$(".commerce-modal #commerceModelSelector"),c=(s.customDropdown(),$(".il-item.active").attr("data-rm"));function l(e){var t=$(".commerce-modal [data-model="+e+"]");t.siblings().removeClass("active"),t.addClass("active");var a=$(".commerce-modal .price[data-model="+e+"]"),i=a.data("pn"),n=a.data("preorder"),o=$(".commerce-modal .dr-add-to-cart");o.removeAttr("data-pn"),o.attr("data-pn",i),o.removeAttr("data-preorder"),o.attr("data-preorder",n);var r=$("#buy-now").attr("data-preorder");null!=r&&"true"==r?($("#buy-now").hide(),$("#preorder").show()):($("#buy-now").show(),$("#preorder").hide());var s=$("#buy-now-il").attr("data-preorder");null!=s&&"true"==s?($("#buy-now-il").hide(),$("#preorder-il").show()):($("#buy-now-il").show(),$("#preorder-il").hide());var c=$(".inline-dropdown-panel .item.active").data("purchasable"),l=$(".product-cart-details #no-stock"),d=$(".product-cart-details #buy-now-il");c?(d.show(),l.hide()):(d.hide(),l.show())}function d(e,t){var a=t.closest(".content"),i=a.find(".dropdown-panel .item[id="+e+"]");i.siblings().removeClass("active"),i.addClass("active"),a.find(".dropdown-panel").attr("aria-activedescendant",e)}function u(){var e=$(".inline-dropdown-panel .item.active").data("purchasable"),t=$(".product-cart-details #buy-now-il"),a=$(".product-cart-details #no-stock");e?(t.show(),a.hide()):(t.hide(),a.show())}$(".polyPlus").each(function(e){$(this).attr("data-related-model")==c&&$(this).show()}),s.change(function(){var e,t=s.find(".item.active").attr("data-item"),a=r.find(".carousel-item[data-item="+t+"]").index();l(t),function(){var e=$(".il-item.active").attr("data-rm");$(".polyPlus").each(function(t){var a=$(this).attr("data-related-model");a==e?$(this).show():$(this).hide()})}(),e=a,r.carousel(e)}),r.carousel({pause:!0,interval:!1}),$("#productGallery").off("slide.bs.carousel").on("slide.bs.carousel",function(e){var t=$(e.relatedTarget),a=t.attr("data-item");l(a),d(a,t)}),$("#inlineBuyNowProductGallery").off("slide.bs.carousel").on("slide.bs.carousel",function(e){var t=$(e.relatedTarget),a=t.attr("data-item");l(a),d(a,t),u()}),$(".buy-now-modal").each(function(){$(this).data("ids"),$(this).data("showratings")&&"true"==siteConfig.showBV&&loadBazaarvoiceApi(function(){})}),$(".inline-dropdown-panel .item").on("click",function(){var e=$(this);setTimeout(function(){$(".product-cart-details").trigger("click");var t=e.data("purchasable"),a=e.closest(".product-cart-details").find("#buy-now-il");t?a.show():a.hide()},1)}),$(".inline-buy-now-modal-component .navigate-container").each(function(){$(this).find("li").length<=5&&$(this).closest(".navigate-wrapper").addClass("less-than-five-items")}),$("#inlineBuyNowProductGallery").on("slide.bs.carousel",function(e){var t,a,i=$(e.target).find(".carousel-indicators"),n=i.find("li").length;if(n>5){var o=(t=i.find("li"),a=$(e.target).find(".navigate-container"),t.filter(function(e,t){var i=$(t);return i.offset().left>=a.offset().left&&i.offset().left+i.width()<=a.offset().left+a.width()})),r=o.eq(0),s=o.eq(o.length-1);if("left"===e.direction){if(s.hasClass("active")){var c=i.css("left").replace("px","");i.css("left",c-66+"px")}0===e.to&&i.css("left",33*(n-5))}else r.hasClass("active")&&(c=i.css("left").replace("px",""),i.css("left",parseInt(c)+66+"px")),e.to===n-1&&i.css("left",-33*(n-5))}}),$("#inlineBuyNowProductGallery").on("dropdown-selected",function(e,t,a){var i=t.closest(".inline-buynow-content").find(".carousel-indicators"),n=33*(i.find("li").length-5),o=a+1;if(o>5){var r=n-66*(o-5);i.css("left",r+"px")}else i.css("left",n+"px")}),$(function(){var e=$("#inlineBuyNowProductGallery .carousel-indicators"),t=e.find("li").length;t>5&&e.css("left",33*(t-5))}),$("#commerceModelSelector ul li.item").on("click",function(){h();var e,t,a,i=parseInt($(this).data("item").split("model-")[1]);$("#inlineBuyNowProductGallery").carousel(i),$("#inlineBuyNowProductGallery").trigger("dropdown-selected",[$(this),i]),e=$(this),t=window.location.pathname,a=t.split("."),t=null==a[1]?t.concat("."+e.data("pn")):"html"!=a[1]?t.replace(a[1],e.data("pn")):t.replace(a[1],e.data("pn"))+"."+a[1],history.pushState?window.history.pushState("",document.title,t):document.location.pathname=t,u(),p()});var p=function(){setTimeout(function(){var e=$(".price-cart ul li.price.active span.salePrice").text(),t=$(".price-cart ul li.price.active span.base-price").text();e&&($(".will-change span.startingPrice").text(""),$(".will-change span.displayPrice").text(e)),t&&$(".will-change span.actualPrice").text(t),""==e&&($(".will-change span.startingPrice").text(""),$(".will-change span.displayPrice").text(t),$(".will-change span.actualPrice").text(""))},100)};function h(){setTimeout(function(){digitalData.product[0].productSKU=document.getElementsByClassName("product-name active")[1].outerText.replace("(P/N: ","").replace(")",""),digitalData.product[0].productDisplayPrice=document.getElementsByClassName("price active")[0].outerText,digitalData.product[0].productModel=document.getElementsByClassName("il-item item  active")[0].outerText.replaceAll("\n","").replaceAll("\t","")},10)}function h(){setTimeout(function(){digitalData.product[0].productSKU=document.getElementsByClassName("product-name active")[1].outerText.replace("(P/N: ","").replace(")",""),"salePrice"==document.getElementsByClassName("price active")[0].lastElementChild.className?digitalData.product[0].productDisplayPrice=document.getElementsByClassName("price active")[0].lastElementChild.outerText:digitalData.product[0].productDisplayPrice=document.getElementsByClassName("price active")[0].outerText,digitalData.product[0].productModel=document.getElementsByClassName("il-item item  active")[0].outerText.replaceAll("\n","").replaceAll("\t","")},10)}u()}),function(){function e(e){if($(".buynow-polyplus-accordion-container").length>0&&(null==$(".buynow-polyplus-accordion-container").find("input[name='polyplus']:checked").attr("data-price")||""==$(".buynow-polyplus-accordion-container").find().attr("data-price"))){$("#stockArea").hide();var t=$(".product-cart-details #buy-now-addtocart");t.attr("data-pn",""),t.attr("disabled",!0),t.find(".final-price").html(""),$(".hp-buynow-cta").hide(),$(".buynow-details-container .starting-at-price").show(),$(".buynow-details-container .product-price").hide(),$(".selected-product").find(".product-name").html(""),$("input[name='polyplus']").removeAttr("data-price"),$(".quantity-left-minus").attr("disabled",!0),$("#quantity").attr("disabled",!0),$(".quantity-right-plus").attr("disabled",!0);var i=$(".buynow-polyplus-accordion-container").attr("data-list-set"),n=JSON.parse(i);for(var o in n)if(o==e)for(var r in!0,n[o]){var s=n[o][r].name,c=n[o][r].price,l=n[o][r].partNumber,d=n[o][r].uniqueID,u=n[o][r].modelNumber;$(".buynow-polyplus-accordion-container").find("input[value='"+s+"']").attr("disabled",!1),$(".buynow-polyplus-accordion-container").find("input[value='"+s+"']").attr("data-model",o),$(".buynow-polyplus-accordion-container").find("input[value='"+s+"']").attr("data-price",c),$(".buynow-polyplus-accordion-container").find("input[value='"+s+"']").attr("data-pn",l),$(".buynow-polyplus-accordion-container").find("input[value='"+s+"']").attr("id",d),$(".buynow-polyplus-accordion-container").find("input[value='"+s+"']").attr("data-model-number",u),$(".buynow-polyplus-accordion-container").find("input[value='"+s+"']").parents(".feature-icon-container").removeClass("radio-btn-disabled")}$(".buynow-polyplus-accordion-container").find("input[value='none']").attr("disabled",!1),$(".buynow-polyplus-accordion-container").find("input[value='none']").attr("data-price","$0"),$(".buynow-polyplus-accordion-container").find("input[value='none']").attr("data-model",e),$(".buynow-polyplus-accordion-container").find("input[value='none']").parents(".feature-icon-container").removeClass("radio-btn-disabled"),$(".buynow-polyplus-accordion-panel").hasClass("show")||($(".buynow-polyplus-accordion-panel").addClass("show"),$(".buynow-polyplus-accordion-panel").siblings(".buynow-polyplus-accordion-btn").addClass("expanded"),$(".buynow-polyplus-accordion-panel").siblings(".buynow-polyplus-accordion-btn").removeClass("collapsed")),$(".buynow-polyplus-accordion-container").find("input[value='none']").click()}else{var p=$(".product-cart-details #buy-now-addtocart"),h=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-purchasable"),f=$(".product-cart-details #no-stock-msg");if("true"==$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-hp-purchasable")){p.hide(),$("#buy-contact-modal").hide(),f.hide(),$(".hp-buynow-cta").show();var m=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-pn");$(".hp-buynow-cta a").attr("data-pn",m);var v=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-hpstoreurl");$(".hp-buynow-cta a").attr("href",v);var g,b=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-sale-price"),y=0,w=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-price"),C=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-model");if(void 0!==b&&!1!==b){var k=parseFloat(b.slice(1));if(void 0!==k&&0!=k)if($(".buynow-polyplus-accordion-container").length>0&&null!=$(".buynow-polyplus-accordion-container").find("input[name='polyplus']").attr("data-price")){var x=$("input[name='polyplus']:checked").attr("data-price");g=parseFloat(w.slice(1).replace(",",""))+parseFloat(x.slice(1).replace(",","")),y=parseFloat(b.slice(1).replace(",",""))+parseFloat(x.slice(1).replace(",","")),finalPrice="<span class='salePrice'> "+w.charAt(0)+y.toFixed(2)+"</span><span class='base-price prevPrice'> "+w.charAt(0)+g.toFixed(2)+"</span>"}else g=parseFloat(w.slice(1).replace(",","")),y=parseFloat(b.slice(1)),finalPrice="<span class='salePrice'>"+b+"</span><span class='base-price prevPrice'>"+w+"</span>";else if($(".buynow-polyplus-accordion-container").length>0&&null!=$(".buynow-polyplus-accordion-container").find("input[name='polyplus']").attr("data-price")){var P=$("input[name='polyplus']:checked").attr("data-price");g=parseFloat(w.slice(1).replace(",",""))+parseFloat(P.slice(1).replace(",","")),finalPrice="<span> "+w.charAt(0)+g.toFixed(2)+"</span>"}else g=parseFloat(w.slice(1).replace(",","")),finalPrice="<span>"+w+"</span>"}else if($(".buynow-polyplus-accordion-container").length>0&&null!=$(".buynow-polyplus-accordion-container").find("input[name='polyplus']").attr("data-price")){var _=$("input[name='polyplus']:checked").attr("data-price");g=parseFloat(w.slice(1).replace(",",""))+parseFloat(_.slice(1).replace(",","")),finalPrice="<span> "+w.charAt(0)+g.toFixed(2)+"</span>"}else g=parseFloat(w.slice(1).replace(",","")),finalPrice="<span>"+w+"</span>";null==m&&null==m||($(".selected-product").find(".product-name").html(C+" | (P/N:"+m+") "),$(".buynow-details-container .starting-at-price").hide(),$(".buynow-details-container .product-price").show(),0!=y?($(".buynow-details-container .product-price .actualPrice").html(w.charAt(0)+g.toFixed(2)),$(".buynow-details-container .product-price .displayPrice").html(w.charAt(0)+y.toFixed(2))):null!=g&&($(".buynow-details-container .product-price .displayPrice").html(w.charAt(0)+g.toFixed(2)),$(".buynow-details-container .product-price .actualPrice").html("")),$(".quantity-left-minus").attr("disabled",!1),$("#quantity").attr("disabled",!1),$(".quantity-right-plus").attr("disabled",!1))}else if($(".hp-buynow-cta").hide(),"true"==h){p.show(),$("#buy-contact-modal").hide(),f.hide();var A=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-pn"),T=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-price"),E=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-model"),I="",S=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-stock");S<5&&S>0?($("#stockArea").show(),$("#stockNumber").text(""),$("#stockNumber").text(S)):$("#stockArea").hide();var O,M=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-sale-price"),q=0;if(void 0!==M&&!1!==M){var D=parseFloat(M.slice(1));if(void 0!==D&&0!=D)if($(".buynow-polyplus-accordion-container").length>0&&null!=$(".buynow-polyplus-accordion-container").find("input[name='polyplus']").attr("data-price")){var B=$("input[name='polyplus']:checked").attr("data-price");O=parseFloat(T.slice(1).replace(",",""))+parseFloat(B.slice(1).replace(",","")),q=parseFloat(M.slice(1).replace(",",""))+parseFloat(B.slice(1).replace(",","")),I="<span class='salePrice'> "+T.charAt(0)+q.toFixed(2)+"</span><span class='base-price prevPrice'> "+T.charAt(0)+O.toFixed(2)+"</span>"}else O=parseFloat(T.slice(1)),q=parseFloat(M.slice(1)),I="<span class='salePrice'>"+M+"</span><span class='base-price prevPrice'>"+T+"</span>";else if($(".buynow-polyplus-accordion-container").length>0&&null!=$(".buynow-polyplus-accordion-container").find("input[name='polyplus']").attr("data-price")){var L=$("input[name='polyplus']:checked").attr("data-price");O=parseFloat(T.slice(1).replace(",",""))+parseFloat(L.slice(1).replace(",","")),I="<span> "+T.charAt(0)+O.toFixed(2)+"</span>"}else O=parseFloat(T.slice(1)),I="<span>"+T+"</span>"}else if($(".buynow-polyplus-accordion-container").length>0&&null!=$(".buynow-polyplus-accordion-container").find("input[name='polyplus']").attr("data-price")){var N=$("input[name='polyplus']:checked").attr("data-price");O=parseFloat(T.slice(1).replace(",",""))+parseFloat(N.slice(1).replace(",","")),I="<span> "+T.charAt(0)+O.toFixed(2)+"</span>"}else O=parseFloat(T.slice(1)),I="<span>"+T+"</span>";a(),null!=A||null!=A?(p.attr("data-pn",A),p.attr("disabled",!1),p.find(".final-price").html(I),$(".selected-product").find(".product-name").html(E+" | (P/N:"+A+") "),$(".buynow-details-container .starting-at-price").hide(),$(".buynow-details-container .product-price").show(),0!=q?($(".buynow-details-container .product-price .actualPrice").html(T.charAt(0)+O.toFixed(2)),$(".buynow-details-container .product-price .displayPrice").html(T.charAt(0)+q.toFixed(2))):null!=O&&($(".buynow-details-container .product-price .displayPrice").html(T.charAt(0)+O.toFixed(2)),$(".buynow-details-container .product-price .actualPrice").html("")),$(".quantity-left-minus").attr("disabled",!1),$("#quantity").attr("disabled",!1),$(".quantity-right-plus").attr("disabled",!1)):(p.attr("data-pn",""),p.attr("disabled",!0),p.find(".final-price").html(""),$("input[name='polyplus']").removeAttr("data-price"),$(".selected-product").find(".product-name").html(""),$(".quantity-left-minus").attr("disabled",!0),$("#quantity").attr("disabled",!0),$(".quantity-right-plus").attr("disabled",!0))}else{p.hide(),f.show(),$(".buynow-details-container .starting-at-price").show(),$(".buynow-details-container .product-price").hide(),$("#buy-contact-modal").show();var F=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-model"),V=$(".buynow-carousel li.carousel-item[data-rm='"+e+"']").attr("data-pn");$(".selected-product").find(".product-name").html(F+" | (P/N:"+V+")")}}}function t(e){null!=e&&null!=e&&$("#buyNowProductGallery").carousel(parseInt($(".buynow-carousel li.carousel-item[data-rm='"+e+"']").data("item").split("model-")[1]))}function a(e,t,a){setTimeout(function(){var e=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-pn");digitalData.product[0].productSKU=e;var t=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-model");digitalData.product[0].productModel=t,digitalData.product[0].productDisplayPrice=$(".final-price span:first-child")},10)}function i(){$(".seeDetailsLink").click(function(){if($(this).parents(".buynow-accordion-container").length>0){var e=$(this).parents(".buynow-accordion-container").find(".tooltip-content").html();$("#seeDetailsModal .modal-tooltip-content").html(e),$("#seeDetailsModal").css("display","flex")}if($(this).parents(".buynow-polyplus-accordion-container").length>0){var t=$(this).parents(".buynow-polyplus-accordion-container").find(".tooltip-content").html(),a=$(this).parents(".buynow-polyplus-accordion-container").find(".tooltip-readmore-link").html();null!=a&&null!=a&&(t+=a),$("#seeDetailsModal .modal-tooltip-content").html(t),$("#seeDetailsModal").css("display","flex")}0==seeDetFlag&&$(document).click(function(e){$(e.target).closest("#seeDetailsModal .modal-content").length||$(e.target).closest(".seeDetailsLink").length||($("#seeDetailsModal .modal-tooltip-content").html(""),$("#seeDetailsModal").hide())}),seeDetFlag=!0}),$("#seeDetailsModal .close").click(function(){$("#seeDetailsModal").hide(),$("#seeDetailsModal .modal-tooltip-content").html("")})}$(document).ready(function(){$(".quantity-right-plus").click(function(e){e.preventDefault();var t=parseInt($("#quantity").val());$("#quantity").val(t+1)}),$(".quantity-left-minus").click(function(e){e.preventDefault();var t=parseInt($("#quantity").val());t>0&&$("#quantity").val(t-1)}),$(".buynow-accordion-btn").click(function(){$(this).siblings(".buynow-accordion-panel").toggleClass("show"),$(this).siblings(".buynow-accordion-panel").siblings(".buynow-accordion-btn").toggleClass("expanded collapsed")}),$(".buynow-polyplus-accordion-btn").click(function(){$(this).siblings(".buynow-polyplus-accordion-panel").toggleClass("show"),$(this).siblings(".buynow-polyplus-accordion-panel").siblings(".buynow-polyplus-accordion-btn").toggleClass("expanded collapsed")}),digitalData.product[0].productSKU="",digitalData.product[0].productModel="",digitalData.product[0].productDisplayPrice="",digitalData.product[0].productModel=$(".product-name").html(),$(".buynow .spec-wrapper .spec-header").click(function(){var e=$(this).attr("data-target");$(e).toggleClass("show collapse"),$(this).toggleClass("expand")});if(i(),1==$(".buy-now-wrapper .related-accessories .mobile-view .carousel .carousel-item").length&&($(".buy-now-wrapper .related-accessories .mobile-view .carousel .carousel-control-prev").hide(),$(".buy-now-wrapper .related-accessories .mobile-view .carousel .carousel-control-next").hide()),1==$(".buy-now-wrapper .similar-products .mobile-view .carousel .carousel-item").length&&($(".buy-now-wrapper .similar-products .mobile-view .carousel .carousel-control-prev").hide(),$(".buy-now-wrapper .similar-products .mobile-view .carousel .carousel-control-next").hide()),$(".accordion-selection-panel .buynow-accordion-container").not(":nth-child(1)").find("input[type='radio']").each(function(){$(this).attr("disabled",!0),$(this).parents(".feature-icon-container").addClass("radio-btn-disabled")}),$(".accordion-selection-panel .buynow-polyplus-accordion-container").find("input[type='radio']").each(function(){$(this).attr("disabled",!0),$(this).parents(".feature-icon-container").addClass("radio-btn-disabled")}),$("#buy-now-addtocart").hasClass("single-model"))if($(".buynow-polyplus-accordion-container").length>0){$(".buynow-polyplus-accordion-panel").hasClass("show")||($(".buynow-polyplus-accordion-panel").addClass("show"),$(".buynow-polyplus-accordion-btn").addClass("expanded"),$(".buynow-polyplus-accordion-btn").removeClass("collapsed"));var n=$(".product-cart-details #no-stock-msg"),o=$(".buynow-polyplus-accordion-container").attr("data-list-set"),r=JSON.parse(o);for(var s in r)if($(".buynow-carousel .carousel-item.active").attr("data-rm")==s)for(var c in r[s]){var l=r[s][c].name,d=r[s][c].price,u=r[s][c].partNumber,p=r[s][c].uniqueID,h=r[s][c].modelNumber;$(".buynow-polyplus-accordion-container .buynow-polyplus-accordion-panel").find("input[value='"+l+"']").attr("disabled",!1),$(".buynow-polyplus-accordion-container .buynow-polyplus-accordion-panel").find("input[value='"+l+"']").attr("data-price",d),$(".buynow-polyplus-accordion-container .buynow-polyplus-accordion-panel").find("input[value='"+l+"']").attr("data-pn",u),$(".buynow-polyplus-accordion-container .buynow-polyplus-accordion-panel").find("input[value='"+l+"']").attr("id",p),$(".buynow-polyplus-accordion-container .buynow-polyplus-accordion-panel").find("input[value='"+l+"']").attr("data-model-number",h),$(".buynow-polyplus-accordion-container .buynow-polyplus-accordion-panel").find("input[value='"+l+"']").parents(".feature-icon-container").removeClass("radio-btn-disabled")}$(".buynow-polyplus-accordion-container").find("input[value='none']").attr("disabled",!1),$(".buynow-polyplus-accordion-container").find("input[value='none']").attr("data-price","$0"),$(".buynow-polyplus-accordion-container").find("input[value='none']").parents(".feature-icon-container").removeClass("radio-btn-disabled"),$(".buynow-polyplus-accordion-container input[type='radio']").click(function(){if($("#buy-now-addtocart").show(),$(".buynow-polyplus-accordion-container .feature-icon-container").removeClass("selected-radio-btn"),null!=$("input[name='polyplus']").val()&&null!=$("input[name='polyplus']").val()){var e=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-pn"),t=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-price"),i=$(this).attr("data-price"),o=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-model"),r=$(".buynow-carousel li.carousel-item.active").attr("data-sale-price"),s=0;void 0!==r&&!1!==r&&(s=parseFloat(r.slice(1).replace(",",""))+parseFloat(i.slice(1).replace(",","")));var c,l=parseFloat(t.slice(1).replace(",",""))+parseFloat(i.slice(1).replace(",",""));c=0!=s?"<span class='salePrice'> "+t.charAt(0)+s.toFixed(2)+"</span><span class='base-price prevPrice'>"+t.charAt(0)+l.toFixed(2)+"</span>":"<span> "+t.charAt(0)+l.toFixed(2)+"</span>";var d=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-purchasable");if("true"==$(".buynow-carousel li.carousel-item.active:first-child").attr("data-hp-purchasable")){$("#buy-now-addtocart").hide(),$(".hp-buynow-cta").show(),$(".hp-buynow-cta a").attr("data-pn",e);var u=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-hpstoreurl");$(".hp-buynow-cta a").attr("href",u),$(".buynow-details-container .starting-at-price").hide(),$(".buynow-details-container .product-price").show(),0!=s?($(".buynow-details-container .product-price .actualPrice").html(t.charAt(0)+l.toFixed(2)),$(".buynow-details-container .product-price .displayPrice").html(t.charAt(0)+s.toFixed(2))):($(".buynow-details-container .product-price .displayPrice").html(t.charAt(0)+l.toFixed(2)),$(".buynow-details-container .product-price .actualPrice").html(""))}else $(".hp-buynow-cta").hide(),"true"==d?($("#buy-now-addtocart").attr("disabled",!1),$("#buy-now-addtocart").attr("data-pn",e),$("#buy-now-addtocart").find(".final-price").html(c),$(".buynow-details-container .starting-at-price").hide(),$(".buynow-details-container .product-price").show(),0!=s?($(".buynow-details-container .product-price .actualPrice").html(t.charAt(0)+l.toFixed(2)),$(".buynow-details-container .product-price .displayPrice").html(t.charAt(0)+s.toFixed(2))):($(".buynow-details-container .product-price .displayPrice").html(t.charAt(0)+l.toFixed(2)),$(".buynow-details-container .product-price .actualPrice").html("")),$(".quantity-left-minus").attr("disabled",!1),$("#quantity").attr("disabled",!1),$(".quantity-right-plus").attr("disabled",!1),a()):($("#buy-now-addtocart").hide(),$("#buy-contact-modal").show(),".buynow-details-container .starting-at-price".show(),$(".buynow-details-container .product-price").hide(),n.show());$(".selected-product").find(".product-name").html(o+" | (P/N:"+e+")"),$(this).parents(".feature-icon-container").addClass("selected-radio-btn");var p=$("input[name='polyplus']:checked").siblings("div").html();$(".buynow-polyplus-accordion-container").find(".poly-plus-selected").html(p),a()}}),$(".buynow-polyplus-accordion-container").find("input[value='none']").click()}else{var f,m=$(".buynow-carousel li.carousel-item.active").attr("data-pn"),v=$(".buynow-carousel li.carousel-item.active").attr("data-price"),g=$(".buynow-carousel li.carousel-item.active").attr("data-model"),b=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-purchasable"),y=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-hp-purchasable"),w=$(".buynow-carousel li.carousel-item.active").attr("data-sale-price");if(void 0!==w&&!1!==w){var C=parseFloat(w.slice(1));f=void 0!==C&&0!=C?"<span class='salePrice'> "+w+"</span><span class='base-price prevPrice'> "+v+"</span>":"<span>"+v+"</span>"}else f="<span>"+v+"</span>";if("true"==y){$("#buy-now-addtocart").hide(),$(".hp-buynow-cta").show(),$(".hp-buynow-cta a").attr("data-pn",m);var k=$(".buynow-carousel li.carousel-item.active:first-child").attr("data-hpstoreurl");$(".hp-buynow-cta a").attr("href",k),$(".buynow-details-container .starting-at-price").hide(),$(".buynow-details-container .product-price").show(),0!=w?($(".buynow-details-container .product-price .actualPrice").html(v),$(".buynow-details-container .product-price .displayPrice").html(w)):($(".buynow-details-container .product-price .displayPrice").html(v),$(".buynow-details-container .product-price .actualPrice").html(""))}else $(".hp-buynow-cta").hide(),"true"==b?($("#buy-now-addtocart").attr("disabled",!1),$("#buy-now-addtocart").attr("data-pn",m),$("#buy-now-addtocart").find(".final-price").html(f),$(".buynow-details-container .starting-at-price").hide(),$(".buynow-details-container .product-price").show(),0!=w?($(".buynow-details-container .product-price .actualPrice").html(v),$(".buynow-details-container .product-price .displayPrice").html(w)):($(".buynow-details-container .product-price .displayPrice").html(v),$(".buynow-details-container .product-price .actualPrice").html("")),$(".quantity-left-minus").attr("disabled",!1),$("#quantity").attr("disabled",!1),$(".quantity-right-plus").attr("disabled",!1),a()):($("#buy-now-addtocart").hide(),$("#buy-contact-modal").show(),$(".buynow-details-container .starting-at-price").show(),$(".buynow-details-container .product-price").hide(),noStockMsg.show());$(".selected-product").find(".product-name").html(g+" | (P/N:"+m+")")}var x=$(".accordion-selection-panel").find("input[type='radio']"),P=[];x.each(function(){-1==P.indexOf($(this).attr("name"))&&P.push($(this).attr("name"))}),$("#buy-now-addtocart").hasClass("single-model")||$(".buynow-polyplus-accordion-container input[type='radio']").click(function(){if($(".buynow-polyplus-accordion-container .feature-icon-container").removeClass("selected-radio-btn"),null!=$(this).attr("data-model")){e($(this).attr("data-model")),$(this).parents(".feature-icon-container").addClass("selected-radio-btn");var t=$("input[name='polyplus']:checked").siblings("div").html();$(".buynow-polyplus-accordion-container").find(".poly-plus-selected").html(t)}}),$(".buynow-accordion-container input[type='radio']").click(function(){($(".buynow-polyplus-accordion-container .feature-icon-container").removeClass("selected-radio-btn"),$(".accordion-selection-panel .buynow-accordion-container.unselected-options").each(function(e){$(this).find(".buynow-accordion-panel").addClass("show"),$(this).find(".feature-icon-container").removeClass("radio-btn-disabled"),$(this).find("input[type='radio']").attr("disabled",!1),$(this).find(".buynow-accordion-btn").removeClass("collapsed"),$(this).find(".buynow-accordion-btn").addClass("expanded")}),$(".buynow-polyplus-accordion-container").length>0)&&$(".accordion-selection-panel .buynow-polyplus-accordion-container").find("input[type='radio']").each(function(){$(this).attr("disabled",!0),$(this).parents(".feature-icon-container").addClass("radio-btn-disabled"),$(this).parents(".feature-icon-container").removeClass("selected-radio-btn")});for(var a=!1,i={},n=0;n<P.length;n++)1==a&&($("input[name='"+P[n]+"']").prop("checked",!1),$("input[name='"+P[n]+"']").parents(".buynow-accordion-panel").removeClass("user-selected show"),$("input[name='"+P[n]+"']").parents(".buynow-accordion-container").find(".buynow-accordion-btn").removeClass("expanded"),$("input[name='"+P[n]+"']").parents(".buynow-accordion-container").find(".buynow-accordion-btn").addClass("collapsed"),$("input[name='"+P[n]+"']").parents(".feature-icon-container").removeClass("selected-radio-btn"),$("input[name='"+P[n]+"']").parents(".buynow-accordion-container").removeClass("unselected-options")),(0==a&&$("input[name='"+P[n]+"']").parents(".buynow-accordion-panel").hasClass("user-selected")||P[n]==$(this).attr("name"))&&null!=$("input[name='"+P[n]+"']:checked").val()&&(i[P[n]]=$("input[name='"+P[n]+"']:checked").val()),P[n]==$(this).attr("name")&&(a=!0);var o=function(e){var t=$(".accordion-selection-panel").attr("data-set"),a=JSON.parse(t),i={};for(var n in a)for(var o in a[n])if(o in e&&e[o]==a[n][o])if(n in i){var r=i[n];r++,i[n]=r}else i[n]=1;var s=0;for(var c in e)e.hasOwnProperty(c)&&s++;for(var l=[],d=0,u=Object.entries(i);d<u.length;d++){var p=_slicedToArray(u[d],2),h=p[0],f=p[1];f==s&&(l.push(h),console.log("Selected Product: "+h))}return l}(i);if(null==o||0===o.length){var r=$("input[name='"+$(this).attr("name")+"']");r.parents(".feature-icon-container").removeClass("selected-radio-btn"),r.parents(".buynow-accordion-container").removeClass("unselected-options"),$("input[name='"+$(this).attr("name")+"'][value='"+$(this).attr("value")+"']").parents(".feature-icon-container").addClass("selected-radio-btn");var s=$(".buynow-accordion-panel .feature-icon-container.radio-btn-disabled").first().find("input[type=radio]").attr("name"),c=$("input[name='"+s+"']");c.parents(".feature-icon-container").removeClass("radio-btn-disabled"),c.attr("disabled",!1),t($("#buyNowProductGallery li.carousel-item:first-child").attr("data-rm"))}else!function(e,t){var a=$(".accordion-selection-panel").attr("data-set"),i=JSON.parse(a),n={};for(var o in i)if(-1!=e.indexOf(o))for(var r in i[o])if(r in n){if(-1==n[r].indexOf(i[o][r])){var s=n[r];s.push(i[o][r]),n[r]=s}}else n[r]=[i[o][r]];$(".accordion-selection-panel").find("input[type='radio']").each(function(){var e=$("input[name='"+$(this).attr("name")+"'][value='"+$(this).attr("value")+"']");$(this).attr("name")in n?t==$(this).attr("name")?(e.parents(".buynow-accordion-container").removeClass("unselected-options"),e.parents(".buynow-accordion-panel").addClass("user-selected"),-1!=n[$(this).attr("name")].indexOf($(this).attr("value"))?(e.parents(".feature-icon-container").addClass("selected-radio-btn"),e.prop("checked",!0)):(e.parents(".feature-icon-container").removeClass("selected-radio-btn"),e.prop("checked",!1))):1==n[$(this).attr("name")].length?(e.parents(".feature-icon-container").hasClass("selected-radio-btn")||e.parents(".buynow-accordion-panel").hasClass("user-selected")||(e.parents(".feature-icon-container").addClass("radio-btn-disabled"),e.attr("disabled",!0)),e.parents(".buynow-accordion-container").removeClass("unselected-options"),-1==n[$(this).attr("name")].indexOf($(this).attr("value"))?(e.parents(".feature-icon-container").removeClass("selected-radio-btn"),e.prop("checked",!1)):(e.parents(".feature-icon-container").addClass("selected-radio-btn"),e.prop("checked",!0))):(e.parents(".feature-icon-container").removeClass("selected-radio-btn"),e.prop("checked",!1),-1==n[$(this).attr("name")].indexOf($(this).attr("value"))?(e.parents(".feature-icon-container").addClass("radio-btn-disabled"),e.attr("disabled",!0)):(e.parents(".feature-icon-container").removeClass("radio-btn-disabled"),e.attr("disabled",!1),e.parents(".buynow-accordion-container").addClass("unselected-options"))):(e.attr("disabled",!0),e.parents(".feature-icon-container").addClass("radio-btn-disabled"))})}(o,$(this).attr("name")),t(o[0]);var l=$(".product-cart-details #buy-now-addtocart"),d=$(".product-cart-details #no-stock-msg");1==o.length?e(o[0]):(l.show(),$("#buy-contact-modal").hide(),d.hide(),l.attr("data-pn",""),l.attr("disabled",!0),l.find(".final-price").html(""),$(".hp-buynow-cta").hide(),$(".buynow-details-container .starting-at-price").show(),$(".buynow-details-container .product-price").hide(),$(".quantity-left-minus").attr("disabled",!0),$("#quantity").attr("disabled",!0),$(".quantity-right-plus").attr("disabled",!0),$(".selected-product").find(".product-name").html(""),$(".buynow-polyplus-accordion-container").length>0&&($("input[name='polyplus']").removeAttr("data-price"),$(".buynow-polyplus-accordion-panel").removeClass("show"),$(".buynow-polyplus-accordion-btn").removeClass("expanded"),$(".buynow-polyplus-accordion-btn").addClass("collapsed"))),function(e){if(1!=$("#buy-now-addtocart").attr("disabled")){e.parents(".buynow-accordion-container").find(".buynow-accordion-panel").each(function(){$(this).hasClass("show")&&$(this).parents(".buynow-accordion-container").find(".buynow-accordion-btn").click()}),e.parents(".buynow-accordion-container").nextAll(".buynow-accordion-container").each(function(){if($(this).find(".feature-icon-container").hasClass("radio-btn-disabled")){var e=$(this).find(".feature-icon-container.radio-btn-disabled").length,t=$(this).find(".feature-icon-container").length;if(t-e>1)return $(this).find(".buynow-accordion-btn").click(),!1}if(!$(this).find(".feature-icon-container").hasClass("radio-btn-disabled"))return $(this).find(".buynow-accordion-btn").click(),!1}),$(".accordion-selection-panel .buynow-accordion-container").find(".value-selected").html("");var t=$(".accordion-selection-panel .buynow-accordion-container").find("input[type='radio']:checked");t.each(function(){$(this).parents(".buynow-accordion-container").find(".buynow-accordion-btn .value-selected").html($(this).siblings("div").html())});var a=$(".accordion-selection-panel .buynow-accordion-container .feature-icon-container.radio-btn-disabled ").find("input[type='radio']");a.each(function(){var e=$(this).attr("name");$(this).parents(".buynow-accordion-container").find(".buynow-accordion-btn .value-selected").html($("input[name='"+e+"']:checked").siblings("div").html())})}}($(this))});var _=$(".accordion-selection-panel").attr("data-pn-selected");null!=_&&function(e){var t=$(".buynow-carousel .carousel-item[data-pn='"+e+"']").attr("data-rm");if(null!=t){var a=$(".accordion-selection-panel").attr("data-set"),i=JSON.parse(a),n=i[t],o=$(".accordion-selection-panel .buynow-accordion-container");o.each(function(e){$(this).find(".feature-icon-container").each(function(e){var t=$(this).find("input").attr("name"),a=$(this).find("input").val(),i=n[t];a==i&&$(this).find("input[name='"+t+"'").click()})})}}(_),$("#buy-now-addtocart").on("click",function(){var e=$.trim($("#buy-now-addtocart").attr("data-pn"));addToCart(e)}),$("#buyNowProductGallery").carousel({pause:!0,interval:!1}),$(".related-accessories .carousel-item").each(function(){var e=$(this).next();e.length||(e=$(this).siblings(":first")),e.children(":first-child").clone().appendTo($(this));for(var t=0;t<3;t++)(e=e.next()).length||(e=$(this).siblings(":first")),e.children(":first-child").clone().appendTo($(this))}),$(".related-accessories .carousel").carousel({interval:!1})})}(),function(){var e,t,a,i=[],n=$(".category-container").find("#category_data").data("cards");function o(){$(".category-grid .grid-content-wrapper").each(function(){for(var e,t=0,a=0,i=$(this).children("li"),n=0;n<i.length;n++)(e=i.eq(n)).hasClass("full-width")||(e.hasClass("double-column-width")?(a+=2,t++):(a++,t++),3===a&&(3===t&&(e.addClass("rowThirdItem"),i.eq(n-1).addClass("rowSecondItem")),a=0,t=0))})}function r(){var e=0;return $(".category-grid .grid-content-wrapper li").each(function(){$(this).hasClass("double-column-width")?e+=2:$(this).hasClass("full-width")?e+=3:e++}),Math.ceil(e/12)}function s(e){var s,f,m;i=$.extend(!0,[],n),e.filters.length>0||e.search?(a||(a=$(".category-grid .grid-content-wrapper").detach()),$(".category-grid .grid-content-wrapper").remove(),f=(f=e.search)?f.toLowerCase():"",$(".category-grid").hasClass("resources-category")?i=i.filter(function(e){return-1!=e.title.toLowerCase().search(f)}):$(".category-grid").hasClass("support-category")&&(i=i.filter(function(e){return-1!=e.productTitle.toLowerCase().search(f)})),e.filters.length>0&&(s=e.filters,i=i.filter(function(e){return!!e.tags&&s.every(function(t){return e.tags.indexOf(t)>-1})})),function(){var e=getI18nString("No Results Found"),t='<ul class="grid-content-wrapper list-unstyled">';i.length>0?(i.forEach(function(e){t+=d(e)}),t+="</ul>"):t='<div class="grid-content-wrapper">'+e+"</div>";$(".category-grid").prepend(t),o()}()):a&&($(".category-grid .grid-content-wrapper").remove(),$(".category-grid").prepend(a),a=null),function(e){switch(e){case"name":$(".category-grid").hasClass("resources-category")?i.sort(l):i.sort(c)}}(e.sort),i.forEach(function(e,t){var a=$(".category-grid .grid-content-wrapper>li:not(.grid-promo)").eq(t);a.after(d(e)),a.remove()}),o(),t&&(t.currentPage=1,t.totalPages=r(),t.createPagination(),u()),p(),m=$(".category-grid").offset().top-20,$("html,body").animate({scrollTop:m},200),h()}function c(e,t){var a=$("html").attr("lang");return e.productTitle.trim().localeCompare(t.productTitle.trim(),a)}function l(e,t){var a=$("html").attr("lang");return e.title.trim().localeCompare(t.title.trim(),a)}function d(e){var t="",a=getI18nString("Learn More"),i=getI18nString("Download {0}"),n=getI18nString("Watch The Video"),o=getI18nString("Data Sheet"),r=getI18nString("Watch Webinar");if($(".category-grid").hasClass("resources-category")){t=$("<li>",{class:"resource-card"});var s=$("<div>",{class:"topic-icon"}).append($("<div>",{class:"topic",text:e.topic||""})),c=$("<div>",{class:"icon"});if(e.icon&&c.append($("<img>",{src:e.icon,alt:"icon"})),s.append(c),t.append(s),t.append($("<div>",{class:"resource-title",text:e.title||""})),t.append($("<p>",{class:"resource-description",text:e.description||""})),e.learnMoreCTA&&e.asset){var l=i.replace("{0}",e.topic);t.append($("<a>",{class:"btn btn-secondary",href:e.learnMoreCTA,download:e.fileName,text:l}))}else if(e.learnMoreCTA&&e.page)t.append($("<a>",{class:"btn btn-secondary",href:e.learnMoreCTA,text:"Webinar"===e.topic?r:a}));else if(e.learnMoreCTA&&e.video){var d=$("<div>",{class:"video-cta"});d.append($("<button>",{class:"btn btn-secondary btn-sm launch-video","data-type":"video","data-video":e.learnMoreCTA,text:n})),t.append(d)}}else if($(".category-grid").hasClass("support-category")){t=$("<li>",{class:"support-card"});var u=$("<a>",{class:"support-card-front",href:e.supportLink||"javascript:void(0)"}),p=$("<div>",{class:"img-box"});e.productImage&&p.append($("<img>",{class:"product-image",src:e.productImage,alt:e.productTitle||""})),t.append(u.append(p).append($("<div>",{class:"product-title",text:e.productTitle||""})))}else if($(".category-grid").hasClass("product-category")){t=$("<li>",{class:"product-card"});var h=$("<div>",{class:"product-card-front"});h.append($("<a>",{class:"stretched-link",href:e.learnMoreCTA})),e.showBuyNow&&h.append($("<div>",{class:"btn btn-cat-buy",text:Granite.I18n.get("Available Online")||""}));p=$("<div>",{class:"img-box"});e.productImage&&p.append($("<img>",{class:"product-image",src:e.productImage,alt:e.productTitle||""}));var f=$("<div>",{class:"content-box"}).append($("<div>",{class:"product-title",text:e.productTitle||""})),m='<div class="list-price"><span class="price">'.concat(e.listPrice,"</span></div>"),v=$("<div>",{class:"product-card-behind"}),g=$("<div>",{class:"ratings-review"});e.showRatings&&siteConfig.showBV&&g.append($("<div>",{id:"BVRRInlineRating-"+e.identifier}));var b=$("<div>",{class:"title-compare"}).append($("<div>",{class:"product-title",text:e.productTitle||""})),y=$("<div>",{class:"descriptor",text:e.descriptor||""}),w=$("<p>",{class:"short-description",text:e.shortDescription||""}),C=$("<div>",{class:"description"}),k=$("<div>",{class:"link-group"});e.learnMoreCTA&&k.append($("<a>",{class:"btn btn-primary",href:e.learnMoreCTA,text:a})),e.dataSheetLink&&k.append($("<a>",{class:"btn btn-secondary",href:e.dataSheetLink,text:o,download:e.dataSheetFileName})),t.append('<button class="showDetailCard btn">Overview +</button>').append(h.append(p).append(f.append(m))).append(v.append(b).append(m).append(g).append(C.append(y).append(w)).append(k))}return t[0].outerHTML}function u(){var e=t.currentPage,a=1,i=0;$(".category-grid .grid-content-wrapper li").each(function(){$(this).hide(),e==a&&$(this).show(),$(this).hasClass("double-column-width")?i+=2:$(this).hasClass("full-width")?i+=3:i++,12==i&&(i=0,a++)}),t.totalPages<2?$(".category-grid .category-pagination").hide():$(".category-grid .category-pagination").show()}function p(){if(window.navigator.userAgent.match(/MSIE|Trident/)){var e=$(".category-grid .grid-content-wrapper li:visible");e.each(function(){$(this).css("height","")});var t=function(e){var t=0;return e.each(function(){t=Math.max(t,$(this).outerHeight())}),t}(e);"MOBILE"!==getCurrentBreakpoint()&&e.each(function(){$(this).css("height",t)})}}function h(){if($(".category-grid").hasClass("product-category")){var e=[];n.filter(function(t){t.showRatings&&e.push(t.identifier)}),"true"==siteConfig.showBV&&loadBazaarvoiceApi(function(){$BV.ui("rr","inline_ratings",{productIds:e,containerPrefix:"BVRRInlineRating"})})}}n=n instanceof Object?n:n?JSON.parse(n):[],$(document).on("click",".category-grid .category-pagination .pagination-item:not(.disabled)",function(e){e.preventDefault();var a=$(this).find(".pagination-link"),i=a.attr("aria-label");"Previous"===i&&t.currentPage>1?t.currentPage--:"Next"===i&&t.currentPage<t.totalPages?t.currentPage++:t.currentPage=parseInt(a.html()),t.createPagination(),u(),p()}),$(document).ready(function(){var a,c;o(),i=n,(new PolyNotification).subscribe(s,"FILTER_CHANGE"),(c=$(".category-grid .category-pagination")).length&&(a=r(),t=c.customPagination({totalPages:a}),u()),p(),$(".category-grid-filter").each(function(){$(this).find(".category-grid").hasClass("product-category")&&$(this).find(".filter-element-container .search-container").remove()}),$(document).on("click",".showDetailCard",function(){var e=$(this),t=e.closest(".product-card");t.hasClass("showDetails")?(e.text(Granite.I18n.get("Overview +")),t.removeClass("showDetails")):(e.text(Granite.I18n.get("Close x")),t.addClass("showDetails"))}),$(document).on("click",".btn-cat-buy-now",function(){var t,a,i,n;e=$(this).attr("data-card-id"),$(".model-selector").change(function(){var t,a=$(this).find(".item.active"),i=a.attr("data-item");!function(e){var t=$(".commerce-modal [data-model="+e+"]");t.siblings().removeClass("active"),t.addClass("active");var a=$(".commerce-modal .price[data-model="+e+"]"),i=a.data("pn"),n=a.data("preorder"),o=$(".commerce-modal .dr-add-to-cart");o.removeAttr("data-pn"),o.attr("data-pn",i),o.removeAttr("data-preorder"),o.attr("data-preorder",n);var r=$("#buy-now").attr("data-preorder");null!=r&&"true"==r?($("#buy-now").hide(),$("#preorder").show()):($("#buy-now").show(),$("#preorder").hide());var s=$("#buy-now-il").attr("data-preorder");null!=s&&"true"==s?($("#buy-now-il").hide(),$("#preorder-il").show()):($("#buy-now-il").show(),$("#preorder-il").hide());var c=$(".inline-dropdown-panel .item.active").data("purchasable"),l=$(".product-cart-details #no-stock"),d=$(".product-cart-details #buy-now-il");c?(d.show(),l.hide()):(d.hide(),l.show())}(i),t=$("#commerceModelSelector"+e).find(".cat-item.active").attr("data-rm"),$(".polyPlus").each(function(){var e=$(this).attr("data-related-model");e==t?$(this).show():$(this).hide()})}),t=$(".price.active .cat-base-"+e).eq(0),a=t.text(),i=t.parent().find(".salePrice"),n=i.text(),$(".form-check-input-"+e).click(function(){$(".form-check-input-"+e).not(this).prop("checked",!1)}),$(".dr-add-to-cart").on("click",function(){t.empty(),t.text(a),i.empty(),i.text(n)}),$(".close"+e).find("span").click(function(){$(".form-check-input-"+e+":checked").each(function(){$(this).prop("checked",!1),t.empty(),t.text(a),i.empty(),i.text(n)})}),$(".form-check-input-"+e).click(function(e){if(e.stopImmediatePropagation(),$(this).is(":checked")){var o=$(this).attr("data-price"),r=currency(o).add(a),s=currency(o).add(n),c=function(e){return currency(e,{symbol:"€",decimal:",",separator:".",pattern:"# !"})},l=function(e){return currency(e,{symbol:"£"})};t.empty(),i.empty();var d=document.location.href;-1!=d.indexOf("/de/de")||-1!=d.indexOf("/fr/fr")||-1!=d.indexOf("/es/es")||-1!=d.indexOf("/ie/en")?(t.text(c(r).format()),i.text(c(s).format())):-1!=d.indexOf("gb/en")?(t.text(l(r).format()),i.text(l(s).format())):(t.text(r.format()),i.text(s.format()))}else t.empty(),t.text(a),i.empty(),i.text(n)});var o=$("#commerceModelSelector"+e).find(".cat-item.active").attr("data-rm");$(".polyPlus").each(function(){var e=$(this).attr("data-related-model");e==o&&$(this).show()})}),$(".sorting-selector").each(function(){var e=$(this),t=$(this).children("option").length;e.addClass("select-hidden"),e.wrap('<div class="select"></div>'),e.after('<div class="select-styled"></div>');var a=e.next("div.select-styled");a.text(e.children("option").eq(0).text());for(var i=$("<ul />",{class:"select-options"}).insertAfter(a),n=0;n<t;n++){var o=e.children("option").eq(n);$("<li />",{text:o.text(),rel:o.val(),class:o[0].selected?"selected":""}).appendTo(i)}var r=i.children("li");a.click(function(e){e.stopPropagation(),$("div.select-styled.active").not(this).each(function(){$(this).removeClass("active").next("ul.select-options").hide()}),$(this).toggleClass("active").next("ul.select-options").toggle()}),r.click(function(t){t.stopPropagation(),a.text($(this).text()).removeClass("active"),e.val($(this).attr("rel")),i.hide(),r.removeClass("selected"),$(this).addClass("selected"),setTimeout(function(){return e.change()},0)}),$(document).click(function(){a.removeClass("active"),i.hide()})}),$(".category-grid").each(function(){h()})}),$(window).resize(function(){p()})}(),$("#component-library__iframe").ready(function(){var e=location.hash,t=$(".component-library-wrapper > nav ul > li > a"),a=function(e){$("#component-library__iframe").attr("src",e)};e&&a("./components/examples/_"+e.substring(1)+".html"),t.click(function(e){e.preventDefault();var t=$(this).attr("href");a(t),function(e){location.hash=e}(t.substring(23,t.length-5))})});var KEYCODE={ENTER:13,ESC:27,UP:38,DOWN:40};!function(){var e=$(".cmp-tabs__tablist .cmp-tabs__tab"),t=$(".tabs-content .item");e.click(function(a){var i=$(this).index();e.removeClass("cmp-tabs__tab--active"),t.css("display","none"),$(a.target).addClass("cmp-tabs__tab--active"),document.getElementsByClassName("item")[i].style.display="block"});var a=$(".center-tabs__tablist .center-tabs__tab"),i=$(".cmp-tabs .cmp-left-tabs"),n=$(".center-tabs-content .center-tab");a.click(function(e){var t=$(this).index();if(a.removeClass("center-tabs__tab--active"),n.css("display","none"),$(e.target).addClass("center-tabs__tab--active"),document.getElementsByClassName("center-tab")){var i=document.getElementsByClassName("center-tab")[t];i&&(i.style.display="block")}}),window.onload=function(){if(0===a.length&&0===i.length){var e=$("li.cmp-tabs__tab--active").index();$(".cmp-tabs__tabpanel:nth-child(2)").removeClass("cmp-tabs__tabpanel--active"),$(".cmp-tabs__tabpanel:nth-child("+(e+2)+")").addClass("cmp-tabs__tabpanel--active")}}}(),function(){function e(e){this.element=e,this.init()}e.prototype={constructor:e,init:function(){var e=this.element;this.value=e.find(".item.active").attr("id"),this.activeDescendant=e.find(".dropdown-panel").attr("aria-activedescendant"),this.bindEvent()},renderHTML:function(){var e=this;if(e.reRender){var t=e.element.parents(e.parentClassName),a=t.find(".value-container").map(function(){return $(this).text().trim()}).get();e.element.parents(e.variantClass).length>0&&a.splice(2);var i=t.find(".product-selector");i&&i.each(function(){var t="",i=$(this).find(".dropdown-panel"),n=$(this).find(".value-container").text().trim(),o=$(this).attr("id");i.empty(),e.optionArr.forEach(function(e,r){a.indexOf(e.text)<0&&(t+='<li class="item'.concat(e.text==n?' active" aria-selected="true"':'"',' role="option" id="').concat(o,"-").concat(e.id,'">').concat(e.text,"</li>"),e.text==n&&i.attr("aria-activedescendant","".concat(o,"-").concat(e.id)))}),i.append(t)})}},updateArr:function(e,t,a,i){this.variantClass=a,this.reRender=i,this.parentClassName=t,this.optionArr=e,this.renderHTML(),this.value=this.element.find(".item.active").attr("id"),this.activeDescendant=this.element.find(".dropdown-panel").attr("aria-activedescendant")},getVal:function(){return this.value},focusItem:function(e){e.siblings().removeClass("active"),e.addClass("active")},checkKeyPress:function(e){var t,a=$(e.target).closest(".custom-dropdown"),i=e.which||e.keyCode,n=a.find(".item.active");if(n.length)switch(i){case KEYCODE.UP:case KEYCODE.DOWN:e.preventDefault(),(t=i===KEYCODE.UP?n.prev():n.next()).length&&this.focusItem(t);break;case KEYCODE.ENTER:this.updateSelected(n),this.hideDropdownPanel();break;default:var o=a.find("#".concat(this.activeDescendant));this.updateSelected(o),this.hideDropdownPanel()}},updateSelected:function(e){var t=e.closest(".custom-dropdown"),a=t.find(".value-container"),i=t.find(".dropdown-panel").attr("aria-activedescendant");e.siblings().removeClass("active"),e.addClass("active"),e.siblings().removeAttr("aria-selected"),e.attr("aria-selected","true"),this.activeDescendant=e.attr("id"),this.value=e.attr("id"),a.html(e.html()),t.find(".dropdown-panel").attr("aria-activedescendant",this.activeDescendant),i!==this.activeDescendant&&t.trigger("change")},toggleDropdownPanel:function(){var e=this.element;if(e.hasClass("active")){var t=e.find("#".concat(this.activeDescendant));this.updateSelected(t),this.hideDropdownPanel()}else this.showDropdownPanel()},showDropdownPanel:function(){var e=this.element;e.addClass("active"),e.find(".value-container").attr("aria-expanded","true"),e.find(".dropdown-panel").focus()},hideDropdownPanel:function(){var e=this.element;e.removeClass("active"),e.find(".value-container").attr("aria-expanded","false")},bindEvent:function(){var e=this,t=e.element;t.off("keydown",".dropdown-panel").on("keydown",".dropdown-panel",this.checkKeyPress.bind(this)),t.off("click",".value-container").on("click",".value-container",function(){e.toggleDropdownPanel()}),t.off("click",".item").on("click",".item",function(){e.updateSelected($(this)),e.hideDropdownPanel(),e.renderHTML()}),t.off("mouseover",".item").on("mouseover",".item",function(){e.focusItem($(this))}),$(document).click(function(a){var i=$(a.target);if(!i.closest(".custom-dropdown").length){var n=i.closest(".carousel").attr("id"),o="";if("inlineBuyNowProductGallery"===n||"productGallery"===n){var r=i.closest(".content").find(".dropdown-panel").attr("aria-activedescendant");o=t.find("#".concat(r))}else o=t.find("#".concat(e.activeDescendant));e.updateSelected(o),e.hideDropdownPanel()}})}},$.fn.customDropdown=function(){return new e($(this))}}(),function(){function e(e,t){this.element=e,this.currentPage=parseInt(t.currentPage)||1,this.totalPages=parseInt(t.totalPages)||1,this.createPagination()}e.prototype={constructor:e,createPagination:function(){var e="";e+='<li class="pagination-item"><a class="pagination-link black" href="#" aria-label="Previous"><span aria-hidden="true">&lt;</span></a></li>',this.currentPage=this.currentPage>this.totalPages?this.totalPages:this.currentPage,this.totalPages>5?(e=this.loopPages(e,1,2),this.currentPage<4?(e=this.loopPages(e,2,5),e+="<li>...</li>"):this.currentPage<this.totalPages+1&&this.currentPage>this.totalPages-3?(e+="<li>...</li>",e=this.loopPages(e,this.totalPages-3,this.totalPages)):(e+="<li>...</li>",e=this.loopPages(e,this.currentPage-1,this.currentPage+2),e+="<li>...</li>"),e=this.loopPages(e,this.totalPages,this.totalPages+1)):e=this.loopPages(e,1,this.totalPages+1),e+='<li class="pagination-item"><a class="pagination-link black" href="#" aria-label="Next"><span aria-hidden="true">&gt;</span></a></li>',this.element.empty(),this.element.append(e),this.setDisabledItem()},loopPages:function(e,t,a){for(var i=t;i<a;i++)i===this.currentPage?e+='<li class="pagination-item active" aria-current="page"><a class="pagination-link black" href="#">'+i+'<span class="sr-only">(current)</span></a></li>':e+='<li class="pagination-item"><a class="pagination-link black" href="#">'+i+"</a></li>";return e},setDisabledItem:function(){if(1===this.currentPage){var e=this.element.find('[aria-label="Previous"]'),t=e.closest(".pagination-item");e.attr("tabindex","-1"),e.attr("aria-disabled","true"),t.addClass("disabled")}if(this.currentPage===this.totalPages){var a=this.element.find('[aria-label="Next"]'),i=a.closest(".pagination-item");a.attr("tabindex","-1"),a.attr("aria-disabled","true"),i.addClass("disabled")}}},$.fn.customPagination=function(t){return new e($(this),t||{})}}(),$(".dropdown-submenu > a").on("click",function(e){var t=$(this);$(".dropdown-submenu .dropdown-menu").removeClass("show"),t.next(".dropdown-menu").addClass("show"),e.stopPropagation()}),$(".dropdown").on("hidden.bs.dropdown",function(){$(".dropdown-menu.show").removeClass("show")});var EventListingApp=function(e,t){var a="".concat("#event-listing-container"," tbody"),i=function(e){var t=$(a);t.empty(),e.data.forEach(function(e){var a=$("<tr>",{vocab:"https://schema.org/",typeof:"Event"}),i=$("<td>",{property:"name"}).appendTo(a);$("<a>",{href:e.ticketLink,property:"url",text:e.eventTitle}).appendTo(i);var n=$("<td>",{property:"location",typeof:"PostalAddress"}).appendTo(a);$("<span>",{property:"addressLocality",text:e.location}).appendTo(n);var o=$("<td>",{text:e.dateFormatted}).appendTo(a);$("<meta>",{property:"startDate",content:e.startDateFormatted}).appendTo(o),$("<meta>",{property:"endDate",content:e.endDateFormatted}).appendTo(o),t.append(a)})},n=function(t){var i=e.Messages.EventListingApp.getEventsAjaxError,n="\n  \t\t<tr><td colspan='3'><p>\n  \t\t  ".concat(i,"\n  \t\t</p></td></tr>");$(a).empty().append(n),console.error(t)};return{init:function(e){$("#event-listing-container").length&&$.getJSON(e).then(i).fail(n)}}}(window);$(document).ready(function(){EventListingApp.init(window.Routes.getEvents)}),function(){var e=10,t=0,a=!1;$(".product-detail .product-carousel, .family-detail .product-carousel").carousel({pause:!0,interval:!1}),makeHeaderTransparent(),$(window).scroll(function(){var i=$(window).scrollTop();!function(i){Math.abs(i-t)>e&&(a=i>t,t=i)}(i),$(".product-detail, .family-detail").each(function(){var e=$(this);if(!$(this).hasClass("no-lifestyle-img")&&!$(this).hasClass("no-main-img")&&!$(this).hasClass("no-transition")){var t=e[0].offsetTop;a&&i>0?($("#product_detail-video-id_container_inner video").length&&$("#product_detail-video-id_container_inner video")[0].pause(),$(".product-detail, .family-detail").css("height",""),function(e){var t=e.find(".product-carousel"),a=e.find(".will-change"),i=e.find(".container .reviews"),n=(e.find(".product-poly-name"),e.find(".bg-lifestyle")),o=e.find(".bg-pixel");o.length&&o.addClass("shown");n.length&&n.removeClass("shown");t.addClass("shown").closest(".container").addClass("no-gradient").find(".bottom-container").addClass("no-gradient"),a.removeClass("white"),i.addClass("black")}(e),makeHeaderOpaque(!0)):i<=t&&!a&&($(".product-detail, .family-detail").css("height","100vh"),$("#product_detail-video-id_container_inner video").length&&$("#product_detail-video-id_container_inner video")[0].play(),function(e){var t=e.find(".product-carousel"),a=e.find(".will-change"),i=e.find(".container .reviews"),n=(e.find(".product-poly-name"),e.find(".bg-lifestyle")),o=e.find(".bg-pixel");o.length&&o.removeClass("shown");n.length&&n.addClass("shown");t.removeClass("shown").closest(".container").removeClass("no-gradient").find(".bottom-container").removeClass("no-gradient"),a.addClass("white"),i.removeClass("black")}(e),makeHeaderTransparent())}})}),"MOBILE"===getCurrentBreakpoint()?$(".product-detail .container, .family-detail .container").addClass("no-gradient"):$(".product-carousel").hasClass("shown")||$(".product-detail .container, .family-detail .container").removeClass("no-gradient"),$(window).resize(function(){$(window).width()<750&&$(".product-detail, .family-detail").css("height","100%")}),$(".product-detail .product-carousel .carousel-item, .family-detail .product-carousel .carousel-item").click(function(){$(this).closest(".carousel-container").siblings(".navigate-container").find(".next-page").click()}),$(".product-detail .previous-page-div").hover(function(){$(this).siblings(".carousel-inner").addClass("to-previous")},function(){$(this).siblings(".carousel-inner").removeClass("to-previous")}),$(".product-detail .next-page-div").hover(function(){$(this).siblings(".carousel-inner").addClass("to-next")},function(){$(this).siblings(".carousel-inner").removeClass("to-next")}),$(".product-detail .navigate-container").each(function(){$(this).find("li").length<=5&&$(this).closest(".navigate-wrapper").addClass("less-than-five-items")}),$(".family-detail .product-carousel").on("slide.bs.carousel",function(e){var t=$(e.relatedTarget),a=t.data("product-name")?t.data("product-name"):"";t.closest(".product-carousel").find(".product-name").text(a)}),$("#product-detail-carousel").on("slide.bs.carousel",function(e){var t,a,i=$(e.target).find(".carousel-indicators"),n=i.find("li").length;if(n>5){var o=(t=i.find("li"),a=$(e.target).find(".navigate-container"),t.filter(function(e,t){var i=$(t);return i.offset().left>=a.offset().left&&i.offset().left+i.width()<=a.offset().left+a.width()}));if("left"===e.direction){if(o.eq(o.length-1).hasClass("active")){var r=i.css("left").replace("px","");i.css("left",r-66+"px")}0===e.to&&i.css("left",33*(n-5))}else{if(o.eq(0).hasClass("active")){r=i.css("left").replace("px","");i.css("left",parseInt(r)+66+"px")}e.to===n-1&&i.css("left",-33*(n-5))}}}),$(function(){var e=$("#product-detail-carousel .carousel-indicators"),t=e.find("li").length;t>5&&e.css("left",33*(t-5))}),$(".product-detail").each(function(){var e=$(this).find("#BVRRSummaryContainer"),t=$(this).data("showratings");e.data("id");t&&"true"==siteConfig.showBV&&loadBazaarvoiceApi(function(){})}),$($(".compare-btn").attr("href")).length&&$(".compare-btn").show(),window.addEventListener("resize",function(){var e=Math.ceil((window.outerWidth-10)/window.innerWidth*100);$("h1").hasClass("large-font")?e>68?($(".product-detail, .family-detail").css("height","100%"),$(".product-detail .container, .family-detail .container").removeClass("no-gradient")):e<68&&$(".product-detail .container, .family-detail .container").addClass("no-gradient"):e<100&&$(".product-detail .container, .family-detail .container").addClass("no-gradient");e>=100&&($(".product-detail .container, .family-detail .container").removeClass("no-gradient"),$(".product-detail, .family-detail").css("height","100%"))},!1),document.onkeydown=function(e){(window.event?event:e).ctrlKey&&$(".product-detail, .family-detail").css("height","100vh")},$(document).ready(function(){if($("#animation-container").length){var e=$("#animation-container"),t=e.attr("data-video"),a=$('<div id="product-animation-container" dm-video-path='.concat(t,' class="dm-video-container video-animation">'));e.append(a),AEMGenerateVideo.initDMVideoJSONToContainer(a)}})}(),function(){function e(e){var t=0;return e.each(function(){t=Math.max(t,$(this).height())}),t}function t(){$(".feature-carousel:not(.no-image)").each(function(){var t,a=$(this).find(".content-wrapper"),i=$(this).find(".image-wrapper"),n=$(this).find(".content-wrapper .content-main"),o=$(this).find(".image-wrapper .container"),r=$(this).find(".content-wrapper .feature-nav"),s=$(this).find(".content-wrapper .span-nav"),c=$(this).find(".content-wrapper .content-box"),l=getCurrentBreakpoint(),d=e($(this).find(".image-wrapper img")),u=e($(this).find(".image-wrapper .layout-container")),p=e(c);0==r.children().length&&r.css("margin-bottom",0),c.css("height",p),s.css("margin-top",parseInt(r.css("margin-bottom"))+p+20),"MOBILE"!==l?(t=Math.max(d,u,a.outerHeight()),o.css("height",n.outerHeight()),i.css("height",t)):(d=Math.max(d,u),i.css("height",d),o.css("height",.9*d)),$(this).find(".image-wrapper .layout-container").css("height",o.height())}),$(".feature-carousel.no-image").each(function(){var t=$(this).find(".content-box"),a=e(t);t.css("height",a)})}function a(){$(".feature-carousel .content-box").css("height",""),$(".feature-carousel .image-wrapper").css("height",""),$(".feature-carousel .image-wrapper .layout-container").css("height","")}function i(e,t){var a=e.closest(".feature-carousel");a.find(".box-chosen").removeClass("box-chosen"),a.find("."+t).addClass("box-chosen"),a.find(".box-chosen").each(function(){$(this).siblings().removeClass("top-to-bottom bottom-to-top"),$(this).prevAll().addClass("top-to-bottom"),$(this).nextAll().addClass("bottom-to-top")}),n(a)}function n(e){if(e.hasClass("no-image")){var t=e.find(".title.feature-chosen").data("color");e.find(".feature-wrapper").removeClass().addClass("feature-wrapper "+t)}}$(".feature-carousel .feature-nav .title").click(function(){var e=$(this).attr("data-target"),t=$(this).closest(".feature-carousel");$(this).siblings().removeClass("feature-chosen"),$(this).addClass("feature-chosen"),t.find(".pip-chosen").removeClass("pip-chosen"),t.find('.span-nav [data-item = "'+e+'"]').addClass("pip-chosen"),i($(this),e)}),$(".feature-carousel .span-nav .pip").click(function(){var e=$(this).attr("data-item"),t=$(this).closest(".feature-carousel");$(this).siblings().removeClass("pip-chosen"),$(this).addClass("pip-chosen"),t.find(".feature-chosen").removeClass("feature-chosen"),t.find('.feature-nav [data-target = "'+e+'"]').addClass("feature-chosen"),i($(this),e)}),$(".feature-carousel .span-nav .previous-page").click(function(){var e=$(this).closest(".feature-carousel"),t=e.find(".pip-chosen").prev();$.isEmptyObject(t.prev().get(0))?e.find(".pip").last().click():t.click()}),$(".feature-carousel .span-nav .next-page").click(function(){var e=$(this).closest(".feature-carousel"),t=e.find(".pip-chosen").next();$.isEmptyObject(t.next().get(0))?e.find(".pip").first().click():t.click()}),$(".feature-carousel").swipe({swipe:function(e,t){"left"==t?$(this).find(".span-nav .previous-page").click():"right"==t&&$(this).find(".span-nav .next-page").click()},allowPageScroll:"vertical"}),$(document).ready(function(){a(),t(),$(".feature-carousel.no-image").each(function(){n($(this))}),$(".feature-carousel").length&&$(".feature-carousel").each(function(){var e,t=$(this);e=setInterval(function(){t.find(".next-page").click()},5e3),t.find(".content-wrapper").length?(t.find(".content-wrapper").mouseenter(function(){clearInterval(e)}),t.find(".content-wrapper").mouseleave(function(){e=setInterval(function(){t.find(".next-page").click()},5e3)})):(t.mouseenter(function(){clearInterval(e)}),t.mouseleave(function(){e=setInterval(function(){t.find(".next-page").click()},5e3)}))})}),$(window).resize(function(){a(),t()})}(),function(){function e(e){this.element=e,this.init()}e.prototype={constructor:e,init:function(){this.render(),this.bindEvent()},render:function(){var e=this,t=this.element;t.find(".img-box").each(function(e){$(this).css("transition-delay",.1*e+"s")}),t.on("jcarousel:reload jcarousel:create",function(){var t=$(this).innerWidth(),a=$(this).find(".item").length;if("MOBILE"===getCurrentBreakpoint()){var i=0;i=a>1?.75*t:t,$(this).find(".item").css("width",i)}else $(this).find(".item").css("width","auto");e.animateIntoView()}).jcarousel({wrap:"circular",animation:500})},animateIntoView:function(){var e=this.element,t=getCurrentBreakpoint(),a=$(window).height(),i=$(window).scrollTop(),n=e.offset().top;if("MOBILE"!==t)n<a||n<=i+a-497?e.find(".img-box").css("transform","translateY(0)"):e.find(".img-box").css("transform","translateY(100%)");else{var o=e.find(".has-description-cta");o.length&&(o.find(".rollover-card").hasClass("canshow")||o.find(".rollover-card").addClass("canshow"))}},bindEvent:function(){var e=this,t=e.element;t.swipe({swipe:function(e,a){var i=t.find(".item").length;"MOBILE"===getCurrentBreakpoint()&&i>1&&("left"===a?t.jcarousel("scroll","+=1.5"):"right"===a&&t.jcarousel("scroll","-=1.5"))}}),t.find(".img-box").on("transitionend",function(){var e=$(window).height(),a=$(window).scrollTop(),i=t.offset().top,n=t.find(".has-description-cta");n.length&&(i<e||i<=a+e-497?n.find(".rollover-card").hasClass("canshow")||n.find(".rollover-card").addClass("canshow"):n.find(".rollover-card").removeClass("canshow"))}),$(window).scroll(function(){e.animateIntoView()})}},$.fn.filmstripLinks=function(){return new e($(this))},$(".filmstrip-links").each(function(){$(this).filmstripLinks()})}(),function(){function e(){var e,t,a=getCurrentBreakpoint(),i=getI18nString("filters");$(".filter-element").each(function(){if(t=$(this).find(".filter-bar"),e=$(this).find(".chosen-filters .chosen-filter").length,"MOBILE"==a||"TABLET"==a)if($(this).hasClass("filter-expand"))t.addClass("hide-all"),t.removeClass("show-clear show-key-filters show-chosen-filters");else{if(e>0)return t.addClass("show-clear"),t.removeClass("hide-all show-key-filters show-chosen-filters"),void t.find(".filters>span").text("filters ("+e+")");t.addClass("hide-all"),t.removeClass("show-clear show-key-filters show-chosen-filters")}else $(this).hasClass("filter-expand")?e>0?(t.addClass("show-chosen-filters"),t.removeClass("show-clear show-key-filters hide-all")):(t.addClass("hide-all"),t.removeClass("show-key-filters show-clear show-chosen-filters")):e>0&&(n=$(this),o=!1,n.find(".chosen-filters .chosen-filter").hasClass("key-chosen")&&(o=!0),!o)?(t.addClass("show-chosen-filters"),t.removeClass("show-clear show-key-filters hide-all")):(t.addClass("show-key-filters"),t.removeClass("hide-all show-clear show-chosen-filters"));var n,o;t.find(".filters>span").text(i)})}function t(){$(".filter-element-container").each(function(){var e=$(this).next().offset().top,t=$(window).scrollTop(),a=$(window).height(),i=$(this).next().outerHeight(),n=$(this).offset().top;"MOBILE"==getCurrentBreakpoint()||"TABLET"==getCurrentBreakpoint()?e-t>=a||i+e<=t?($(this).find(".filter-element").hasClass("filter-expand")&&$(this).find(".expand-region").collapse("hide"),$(this).removeClass("filter-fixed"),$(this).addClass("fullscreen")):e-t<a&&i+e>t&&($(this).addClass("filter-fixed"),$(this).removeClass("fullscreen")):n>=t||i+e<=t?(i+e<=t&&$(this).find(".filter-element").hasClass("filter-expand")&&$(this).find(".expand-region").collapse("hide"),$(this).removeClass("filter-fixed"),$(this).addClass("fullscreen")):n<t&&i+e>t&&($(this).addClass("filter-fixed"),$(this).removeClass("fullscreen"))})}function a(){$(".filter-element-container").each(function(){var e=$(this).find(".expand-region"),t=getCurrentBreakpoint();if(e.hasClass("show"))if("MOBILE"==t||"TABLET"==t)e.css("height","auto");else{var a=$(window).height()-(e.offset().top-$(window).scrollTop());e.css("height",a)}})}function i(e){var t={filters:[],sort:"",search:""};t.search=e.find(".search").val(),e.find(".chosen-filters .chosen-filter").each(function(){t.filters.push($(this).attr("tag-label"))}),t.sort=e.find(".sorting-selector").val(),(new PolyNotification).broadcast(t,"FILTER_CHANGE")}$(".filter-element .expand-region").on("show.bs.collapse",function(){var t=$(this).closest(".filter-element"),a=$(this).closest(".category-grid-filter").find(".category-container");t.addClass("filter-expand"),$(this).closest(".filter-content-wrapper").addClass("z-index-high"),a.addClass("category-narrow"),e()}).on("shown.bs.collapse",function(){a()}).on("hide.bs.collapse",function(){var t=$(this).closest(".filter-element"),a=$(this).closest(".category-grid-filter").find(".category-container");t.removeClass("filter-expand"),$(this).closest(".filter-content-wrapper").removeClass("z-index-high"),t.find('.all-filters .filter-chosen:not(".lock")').removeClass("filter-chosen"),t.find('.all-filters .lock:not(".filter-chosen")').addClass("filter-chosen"),a.removeClass("category-narrow"),e()}),$(".filter-element .filter-bar .filter-close").click(function(){$(this).closest(".filter-bar").find(".filters").click()}),$(".filter-element .all-filters .filter-section ul li ").click(function(){var e,t,a=$(this).closest(".filter-element");$(this).hasClass("filter-chosen lock")?$(this).removeClass("filter-chosen lock"):$(this).addClass("filter-chosen lock"),e=a.find(".filter-chosen.lock"),(t=a.find(".chosen-filters")).closest(".filter-element").closest(".filter-element").find(".filter-bar .key-filter").removeClass("key-filter-chosen").show(),t.empty(),e.each(function(){var e=$(this).attr("tag-label");if(t.append('<button class="chosen-filter" tag-label="'+e+'">'+e+"</button>"),$(this).hasClass("is-key-filter")){var a=t.closest(".filter-element").find('.key-filters [tag-label="'+e+'"]');a.addClass("key-filter-chosen"),a.siblings().hide()}}),i(a)}),$(".filter-element .clear").click(function(){var t=$(this).closest(".filter-element");t.find(".filter-chosen").removeClass("lock filter-chosen"),t.find(".filter-bar .key-filter").removeClass("key-filter-chosen").show(),t.find(".filter-bar .chosen-filters").empty(),t.find(".search-container .search").val(""),t.hasClass("filter-expand")?t.find(".filter-bar .filters").click():e(),i(t)}),$(".filter-element .filter-operation .apply-filters").click(function(){$(this).closest(".filter-element").find(".filter-bar .filters").click()}),$(".filter-element .filter-bar .chosen-filters").on("click",".chosen-filter",function(){var t=$(this).closest(".filter-element"),a=$(this).attr("tag-label");t.find(".filter-chosen.lock").each(function(){if($(this).attr("tag-label")==a&&($(this).removeClass("filter-chosen lock"),$(this).hasClass("is-key-filter"))){var e=t.find('.key-filters [tag-label="'+a+'"]');e.removeClass("key-filter-chosen"),e.siblings().show()}}),$(this).remove(),e(),i(t)}),$(".filter-element .filter-bar .key-filter").click(function(){var e=$(this).closest(".filter-element"),t=$(this).attr("tag-label");$(this).hasClass("key-filter-chosen")?($(this).removeClass("key-filter-chosen"),e.find('.all-filters [tag-label="'+t+'"]').removeClass("filter-chosen lock"),e.find(".chosen-filters .chosen-filter").remove(),$(this).siblings().show()):($(this).addClass("key-filter-chosen"),e.find('.all-filters [tag-label="'+t+'"]').addClass("filter-chosen lock"),e.find(".chosen-filters").append('<button class="chosen-filter key-chosen" tag-label="'+t+'">'+t+"</button>"),$(this).siblings().hide()),i(e)}),$(".filter-element .search-icon").click(function(){$(this).closest(".filter-element").find(".filter-operation .apply-filters").click()}),$(".filter-element .search").on("input",function(){i($(this).closest(".filter-element"))}),$(".filter-element .search").keydown(function(e){e.keyCode==KEYCODE.ENTER&&$(this).closest(".filter-element").find(".filter-operation .apply-filters").click()}),$(".sorting-selector").change(function(){i($(this).closest(".filter-element"))}),$(document).ready(function(){e(),t()}),$(window).scroll(function(){a(),t()}),$(window).resize(function(){e(),a(),t()})}(),function(){function e(){$(this).toggleClass("flip")}$(".flipper-fb").length&&($(".flip-container-hover").length?$(".flipper-fb").each(function(){$(this).mouseleave(e),$(this).mouseenter(e),$(this).bind("touchstart mousedown",e)}):$(".flip-container-click").length&&$(".flipper-fb").each(function(){$(this).click(e)}))}(),$(".global-footer .newsletter-modal #submitRegion").click(function(){var e=$(this).parents(".modal-content"),t=e.find(".modal-title"),a=e.find(".modal-body");t.html("Thank You"),t.css("text-transform","none"),a.html('<p>We received your information</p><button data-dismiss="modal" aria-label="Close" class="btn btn-close">Close Window</button>')}),function(){var e,t=["badInput","patternMismatch","rangeOverflow","rangeUnderflow","stepMismatch","tooLong","tooShort","typeMismatch","valueMissing","customError"];function a(e){var a=function(e){for(var a=e[0].validity,i=0;i<t.length;i++){var n=t[i];if(a[n])return e.attr("data-"+n)}}(e);e.addClass("invalid"),e.removeClass("valid"),e.siblings(".error-message").html(a),e.siblings(".error-message").show()}function i(e){var t=e.target;setTimeout(function(){if(t.validity.valid){if($(t).hasClass("no-validation"))return;(e=$(t)).addClass("valid"),e.removeClass("invalid"),e.siblings(".error-message").hide()}else a($(t));var e},0)}$("select, input[type=checkbox]").change(i),$("input, textarea").on("input propertychange",(e=i,window.navigator.userAgent.match(/MSIE|Trident/)?function(t){var a=t.target,i=a==document.activeElement;if((!i||a.placeholder&&!a.composition_started)&&(a.composition_started=i,!i&&"TEXTAREA"==a.tagName||"INPUT"==a.tagName))return t.stopPropagation(),t.preventDefault(),!1;e(t)}:e)),$("input, select, textarea").on("invalid",function(e){e.preventDefault(),a($(this))})}(),$(".homepage-carousel .panel-titles .panel-title").click(function(){var e=$(this).attr("data-target"),t=$(this).closest(".homepage-carousel"),a=t.find(".panel-wrapper .wrapper");t.find(".panel-title").removeClass("chosen-title"),$(this).addClass("chosen-title"),a.removeClass("panel-0-chosen panel-1-chosen panel-2-chosen panel-3-chosen panel-4-chosen panel-5-chosen"),a.addClass(e+"-chosen")}),$(".homepage-carousel").swipe({swipe:function(e,t){"left"==t?$(this).find(".chosen-title").parent().prev().find(".panel-title").click():"right"==t&&$(this).find(".chosen-title").parent().next().find(".panel-title").click()},allowPageScroll:"vertical"}),function(){function e(e,t){for(var a=e.offsetTop,i=e.offsetLeft,n=e.offsetHeight,o=e.offsetWidth;e=e.offsetParent;)a+=e.offsetTop,i+=e.offsetLeft;return t?(a+=.5*n,i+=.5*o):a+=n,{top:a,left:i}}function t(t,a){var i,n,o=t.find(".spot-image-container").attr("id");if($("#spotLine1"+o).length<1?(i=$('<div class="spotline" id="spotLine1'+o+'"></div>'),n=$('<div class="spotline" id="spotLine2'+o+'"></div>'),$(document.body).append(i),$(document.body).append(n)):(i=$("#spotLine1"+o),n=$("#spotLine2"+o),a?(n.width(0),setTimeout(function(){i.width(0)},150)):(i.width(0),n.width(0))),"MOBILE"!==getCurrentBreakpoint()){var r=t.find(".feature-item .feature-title"),s=t.find(".spot-image-container .s7icon.chosen"),c=e(r.get(0)),l=e(s.get(0),!0),d=l.left-c.left-Math.abs(l.top-c.top),u=1.414*Math.abs(l.top-c.top)-9;i.css({top:c.top,left:c.left}),n.css({left:l.left-Math.abs(l.top-c.top)-.1464*u}),c.top>l.top?n.css({top:c.top-u/2.828,transform:"rotate(-45deg)"}):n.css({top:c.top+u/2.828,transform:"rotate(45deg)"}),a?(setTimeout(function(){i.css("width",d)},350),setTimeout(function(){n.css("width",u)},500)):(i.css("width",d),n.css("width",u))}}function a(e,a){var i=e.find(".spot-image-container .s7icon");i.on("click touchend",function(){var n=$(this).attr("aria-label").substring("Link ".length),o=e.find(".feature-item"),r=a.spots[n];o.addClass("transition-animation"),o.find(".feature-title").text(r.spotNO+(r.title?". "+getI18nString(r.title):"")),o.find(".description").text(getI18nString(r.description)),o.find(".btn").text(getI18nString(r.ctaLabel)||"").attr("href",r.ctaLink).on("click touchend",function(e){$(this).attr("href")&&(e.preventDefault(),window.top.location.href=$(this).attr("href"))}),i.text("").removeClass("chosen"),$(this).text(r.spotNO).addClass("chosen"),setTimeout(function(){o.removeClass("transition-animation"),t(e,!0)},400)}),i.on({mouseover:function(){var e=$(this).attr("aria-label").substring("Link ".length);$(this).addClass("hover").text(a.spots[e].spotNO)},mouseout:function(){$(this).removeClass("hover"),$(this).hasClass("chosen")||$(this).text("")}}),function(e,t){e.each(function(){var e=$(this).attr("aria-label").substring("Link ".length);1==t.spots[e].spotNO&&$(this).click()})}(i,a),$(window).resize(function(){t(e)}),$(".text-accordion").on("shown.bs.collapse hidden.bs.collapse",function(){t(e)})}LoadExternalScript.loadScript("https://poly.scene7.com/s7viewers/html5/js/InteractiveImage.js",function(){$(document).ready(function(){$(".hotspot-component").each(function(){var e,t,i,n;e=$(this),t=a,i=e.find(".spot-image-container"),n=i.attr("data-dm-server")||"",i.length&&new s7viewers.InteractiveImage({containerId:i.attr("id"),params:{serverurl:n+"/is/image/",contenturl:n+"/is/content/",asset:i.attr("data-img-src")},handlers:{initComplete:function(){s7getCurrentNameSpace().MapAreaOverlay.prototype.overlayClickHandler_=function(){};var a=$.extend(!0,{},e.siblings(".spot-config").data("spot-model")||{});a.spots&&a.spots.length&&(a.spots=a.spots.reduce(function(e,t){return e[t.spotName]=t,e},{}),setTimeout(function(){t(e,a)},200))}}}).init()})})},function(){$(document).ready(function(){$(".hotspot-component").each(function(){new s7viewers.InteractiveImage({uiCallback:a,uiContainer:$(this)}).init()})})})}(),$(".image-tabs .tab-images-container .img-box").click(function(){if(!$(this).hasClass("chosen")){var e=$(this).closest(".image-tabs"),t=e.find('.content-container .panel[data-target="'+$(this).data("target")+'"]'),a=t.data("background");$(this).siblings().removeClass("chosen"),$(this).addClass("chosen"),t.siblings().removeClass("chosen"),t.addClass("chosen"),e.find(".bottom-section .bg-box").removeClass().addClass("bg-box "+a)}}),$.fn.scrollInPageNav=function(){return this.each(function(){$("html, body").animate({scrollTop:$(this).offset().top-$(".in-page-nav__nav-wrapper").height()},500)})},$(window).on("scroll",function(){var e=0;$(".nh_primary-nav").length?e=$(".nh_primary-nav").offset().top+$(".nh_primary-nav").height():$(".primary-nav-support").length&&(e=$(".primary-nav-support").offset().top+$(".primary-nav-support").height()),e-$(window).scrollTop()<=0?$(".in-page-nav__nav").css("visibility","visible"):$(".in-page-nav__nav").css("visibility","hidden")}),$(".in-page-nav__nav-wrapper a").on("click",function(e){target=$(this).attr("href"),"#"==target?(e.preventDefault(),$("html, body").animate({scrollTop:0},500)):"#"==target.substr(0,1)&&(e.preventDefault(),$(target).scrollInPageNav())}),$("#inPageNav-select-container").on("click",function(e){var t=document.getElementById("inPageNav-select-options");t.classList.contains("inPageNav-select-options-show")?t.classList.remove("inPageNav-select-options-show"):t.classList.add("inPageNav-select-options-show")}),$(document).ready(function(){$(".in-page-nav__container").each(function(){$(this).find(".nickname").each(function(){var e=$(this).next();e.length&&e.find(".specifications").length?$(this).show():$(this).remove()}),$(this).find(".in-page-nav__container--hidden-header").each(function(){$(this).find(".wrapper .fullscreen").length&&$(this).find(".mobile-accordion-section").addClass("no-paddding")})})}),$("#indiaQuickWebForm").length>0&&$().ready(function(){$("#indiaQuickWebForm").validate({rules:{"00N50000001Z6cj":"required","00N50000001Z6ct":"required",phone:"required",email:"required","00N380000034Mpm":"required","00N380000034Mph":"required","00N380000034Mpk":"required","00N380000034Mpn":"required","00N380000034Mpq":"required","00N380000034Mpp":"required","00N380000034Mpr":"required"},messages:{"00N50000001Z6cj":"This field is required.","00N50000001Z6ct":"This field is required.",phone:"This field is required.",email:"This field is required.","00N380000034Mpm":"This field is required.","00N380000034Mph":"This field is required.","00N380000034Mpk":"This field is required.","00N380000034Mpn":"This field is required.","00N380000034Mpq":"This field is required.","00N380000034Mpp":"This field is required.","00N380000034Mpr":"This field is required."},errorPlacement:function(e,t){"first_name"==t.attr("id")?e.insertBefore("#first_name"):"last_name"==t.attr("id")?e.insertBefore("#last_name"):"phone"==t.attr("id")?e.insertBefore("#phone"):"email"==t.attr("id")?e.insertBefore("#email"):"mobile_number"==t.attr("id")?e.insertBefore("#mobile_number"):"address1"==t.attr("id")?e.insertBefore("#address1"):"city"==t.attr("id")?e.insertBefore("#city"):"postal_code"==t.attr("id")?e.insertBefore("#postal_code"):"unit1_model"==t.attr("id")?e.insertBefore("#unit1_model"):"unit1_date_code"==t.attr("id")?e.insertBefore("#unit1_date_code"):"unit1_quantity"==t.attr("id")&&e.insertBefore("#unit1_quantity")}})}),$(document).on("click",".launch-video",function(e){var t=$(this).attr("data-video"),a=$('<div class="modal video-modal" tabindex="-1" role="dialog" aria-modal="true"><button type="button" class="close" aria-label="Close"><span aria-hidden="true">×</span></button></div>'),i=$('<div id="VideoModal-video-id" dm-video-path='.concat(t,' class="dm-video-container">'));a.append(i),$("body").append(a),AEMGenerateVideo.initDMVideoJSONToContainer(i),e.preventDefault(),e.stopPropagation()}),$(document).on("click",".video-modal .close",function(){$(this).closest(".video-modal").remove()}),$(document).on("click",".launch-video-modal",function(e){var t=$(this).attr("data-video"),a=$(".modal-body",$("#videoModal")),i=$('<div id="VideoModal-video-id" dm-video-path='.concat(t,' class="dm-video-container">'));a.append(i),AEMGenerateVideo.initDMVideoJSONToContainer(i),$("#videoModal").modal("show")}),$("#videoModal").on("hidden.bs.modal",function(){$("#VideoModal-video-id").remove()}),function(){function e(){var e=getCurrentBreakpoint();$(".mobile-accordion-section").each(function(){var t=$(this).find(".title"),a=$(t.attr("data-target"));"MOBILE"==e?(t.attr("data-toggle","collapse"),a.addClass("collapse")):(t.attr("data-toggle",""),a.removeClass("collapse"))})}e(),$(window).resize(function(){e()})}(),$(".models-detail .models-carousel").carousel({pause:!0,interval:!1}),$(".models-detail .models-carousel .carousel-item").each(function(){var e=$(this).next();e.length||(e=$(this).siblings(":first")),e.children(":first-child").clone().appendTo($(this));for(var t=0;t<3;t++)(e=e.next()).length||(e=$(this).siblings(":first")),e.children(":first-child").clone().appendTo($(this))}),function(){var e="ontouchstart"in window||navigator.msMaxTouchPoints;function t(){var e=getCurrentBreakpoint();"MOBILE"!==e&&"TABLET"!==e||($(".mosaic:not(.mosaic-static)").removeClass("in-animate"),$(".mosaic:not(.mosaic-static) .feature").removeClass("feature-animate"))}function a(e){var t=e.closest(".mosaic:not(.mosaic-static)");t.addClass("in-animate"),e.addClass("feature-animate"),setTimeout(function(){var e=t.find(".video-box video");VideoBox.initVideo(e)},300)}$(".mosaic:not(.mosaic-static) .icon-back").on("click, mouseover",function(){var e=$(this).closest(".mosaic");e.removeClass("in-animate"),e.find(".feature").removeClass("feature-animate"),setTimeout(function(){var t=e.find(".video-box video");VideoBox.initVideo(t)},300)}),$(".mosaic:not(.mosaic-static) .right-panel .feature").on("mouseover",function(){var t=getCurrentBreakpoint();e||"MOBILE"===t||"TABLET"===t||a($(this))}),$(".mosaic:not(.mosaic-static) .feature").click(function(){var e=$(this).parent(),t=$(this).data("destination-url"),i=getCurrentBreakpoint();e.hasClass("left-panel")?t&&(window.location.href=t):e.hasClass("right-panel")&&($(this).hasClass("feature-animate")||"MOBILE"===i||"TABLET"===i?t&&(window.location.href=t):a($(this)))}),$(document).ready(function(){t()}),$(window).resize(function(){t()})}(),function(){var e=getCurrentBreakpoint(),t=getCurrentLocation(),a=window.matchMedia("(max-width: 992px)");"ontouchstart"in window||navigator.msMaxTouchPoints;$(document).on("click",".nav-tabs > .nh_nav-item > .nav-link",function(e){var t=$(this).parent();a.matches?0==$(".tab-pane.show").length?s(t):l(t)?r():$(".tab-pane.show").is(t.data("source"))||v(t):t.hasClass("tab-item")||(window.location=$(this).attr("href"))}),$(document).on("click",".nh_secondary-nav > li",function(e){if(a.matches&&($(e.target).hasClass("secondary-menu-item")||$(e.target).hasClass("secondary-link"))){var t=$(this).find("a.secondary-link");$(".tertiary-nav-container.show").length?$(this).find(".tertiary-nav-container.show").length?($(t.data("target")).slideUp(),f(t)):(h(),$(t.data("target")).slideDown(),m(t)):($(t.data("target")).slideDown(),m(t))}}),$(document).on("click",".nh_header-contact__open",function(e){a.matches&&($("#contact-us-nav").css({display:"list-item",opacity:1}),$("#header-contact").css("display","block"),$("#primary-navigation").css("height","-webkit-fill-available"))}),$(document).on("click",".secondary-link",function(e){a.matches||(window.location=$(this).attr("href"))}),$(document).on("click",".bottom-nav > a",function(e){window.location=$(this).attr("href")}),$(document).on("click",".tertiary-nav > li",function(e){window.location=$(this).find("a").attr("href")}),$(document).on("click",".nav-featured-content > .product-card",function(e){window.location=$(this).attr("href")}),$(document).on("click","#contact-us-nav-item",function(e){if(a.matches){var t=$(this).attr("href");null==t&&$(this).find("a").length>0&&(t=$(this).find("a").attr("href")),window.location=t}}),$(document).on("click",".navbar-toggler",function(e){$(this).hasClass("collapsed")?($(".nh_primary-nav").removeAttr("style"),$(".nav-content-wrapper").removeAttr("style"),$(".nh_primary-nav").hasClass("nh_light-nav")?($(".poly-only").attr("src",t+"resources/images/poly-name-white.svg"),$(".nav-link").css("color","#fff")):($(".poly-only").attr("src",t+"resources/images/poly-name.svg"),$(".nav-link").css("color","#002A4E"))):($("#contact-us-nav").css({display:"none",opacity:0}),$("#header-contact").css("display","none"),$("#primary-navigation").css("height","fit-content"),$(".poly-only").attr("src",t+"resources/images/poly-name.svg"),$(".nav-link").css("color","#002A4E"),$(".nh_primary-nav").css("border-bottom","none"),$(".nh_primary-nav").css("background","white"),$(".nav-content-wrapper").css("background","transparent"))}),$(document).on("mouseleave",".nh_nav-item.tab-item",function(e){var t=$(e.toElement||e.relatedTarget);t.is("contact-us-nav-item")||t.is(".active")||(r(e),i())});var i=function(){var e=$("header").find(".header-backdrop");0==e.length&&1==$(".tab-pane.show").length?$("header").append('<div class="header-backdrop"></div>'):e.length>1&&$(".header-backdrop:not(:first)").remove()};$(document).on("mouseover",".nh_nav-item.tab-item",function(e){if($(".nh_primary-nav").css("border-bottom","none"),!a.matches){var t=$(e.relatedTarget);0==$(".tab-pane.show").length?s($(this)):$(t).hasClass("main-item")&&($("header").append('<div class="header-backdrop"></div>'),v($(this)))}}),$(document).on("mouseover",".nh_primary-nav",function(){if(a.matches)return!1;makeHeaderOpaque(!1,t),$(".nav-link").css("color","#002A4E"),$(".nh_primary-nav").css("border-bottom","none"),$(".nh_primary-nav").css("background","white"),$(".nav-content-wrapper").css("background","transparent")}),$(document).on("mouseleave",".nh_dark-nav",function(e){$(".tab-pane.show").length?(r(),setTimeout(function(){$(".nh_primary-nav").removeAttr("style").addClass("nav-link-dark"),$(".nav-link-dark").css("background-color","transparent")},200)):($(".nh_primary-nav").removeAttr("style").addClass("nav-link-dark"),$(".nav-link-dark").css("background-color","transparent"),$("#header-search").collapse("hide"))}),$(document).on("mouseover",".nh_light-nav",function(e){a.matches||($(".poly-only").attr("src",t+"resources/images/poly-name.svg"),$(".img-box.icon-search-light").css("background-image","url("+t+"resources/icons/search.svg)"),$(".img-box.icon-profile-light").css("background-image","url("+t+"resources/icons/profile.svg)"),$(".img-box.icon-cart-light").css("background-image","url("+t+"resources/icons/cart.svg)"))}),$(document).on("mouseleave",".nh_light-nav",function(e){$(".tab-pane.show").length?(r(),setTimeout(function(){$(".nh_primary-nav").removeAttr("style"),$(".nh_light-nav").css("background-color","transparent")},200)):($(".nh_primary-nav").removeAttr("style"),$(".nh_light-nav").css("background-color","transparent"),$("#header-search").collapse("hide")),$(".nav-link").css("color","#fff"),$(".poly-only").attr("src",t+"resources/images/poly-name-white.svg"),$(".icon-search-light").css("background-image","url("+t+"resources/icons/search-white.svg)"),$(".icon-profile-light").css("background-image","url("+t+"resources/icons/profile-white.svg)"),$(".icon-cart-light").css("background-image","url("+t+"resources/icons/cart-white.svg)")}),$(".nh_secondary-nav > li > a").on("mouseenter focus",function(e){a.matches||m($(this))});var n=function(e){e.children().eq(0).addClass("active link-active")},o=function(){"transparent"==$(".transparent-header").data("header-version")&&1!=$(".nh_primary-nav:hover").length&&makeHeaderTransparent()},r=function(t){var i=c();d(),null!=i?i.slideUp(0,function(){u(i),o(),$(".header-backdrop").remove()}):o(),a.matches?$(i).parent().parent().find(".fas:first").removeClass("fa-minus").addClass("fa-plus"):$(".nh_primary-nav").css("border-bottom","none"),"MOBILE"!=e&&"TABLET"!=e||$("html, body").removeClass("overflow-hidden")},s=function(o){n(o);o.children().eq(0);var r=o.data("source");makeHeaderOpaque(!0,t),p(o),$(r).addClass("show"),$(r).slideDown(0,function(){$(r).addClass("active"),i()}),a.matches&&$(o).find(".fas:first").removeClass("fa-plus").addClass("fa-minus"),"MOBILE"!=e&&"TABLET"!=e||$("html, body").addClass("overflow-hidden")},c=function(){var e,t=$(".nav-link.link-active");return t.length?e=t.siblings(".tab-content").find(".tab-pane"):$(".nh_header-contact__open.active").length&&(e=$(".tab-pane.contact-us")),e},l=function(e){var t=e.data("source");return $(t).hasClass("show")},d=function(){$(".nav-link.active").removeClass("active link-active")},u=function(e){e.removeClass("active show"),e.css("display","none")},p=function(e){var t=$(e.data("source")).children().find(".p.secondary-link[aria-expanded='true'"),i=$(e.data("source")).children().find(".p.secondary-link").eq(0);a.matches?h():t!=i&&(t.attr("aria-expanded",!1),m(i))},h=function(){$(".tertiary-nav-container").slideUp(),$(".tertiary-nav-container").removeClass("show"),$(".nh_secondary-nav > li > a").attr("aria-expanded","false"),$(".tertiary-nav-container").attr("aria-expanded","false"),$(".secondary-link").children(".fas").removeClass("fa-minus").addClass("fa-plus")},f=function(e){var t=e.parent().parent();$(".tertiary-nav-container.collapse.show",t).removeClass("show"),$('a.p[aria-expanded="true"]',t).attr("aria-expanded","false"),a.matches&&$(e).children(".fas").removeClass("fa-minus").addClass("fa-plus")},m=function(e){var t=e.parent().parent();$(".tertiary-nav-container.collapse.show",t).removeClass("show"),$('a.p[aria-expanded="true"]',t).attr("aria-expanded","false"),e.slideDown(),$(e.data("target")).addClass("show"),e.attr("aria-expanded","true"),a.matches&&$(e).children(".fas").removeClass("fa-plus").addClass("fa-minus")},v=function(e){var t=$(".nav-link.active").siblings(".tab-content").find(".tab-pane");u(t),p(e),e.addClass("active link-active");var o=e.data("source");$(o).addClass("show active"),$(o).css("display","block"),d(),n(e),i(),a.matches&&$(e).find(".fas:first").removeClass("fa-plus").addClass("fa-minus")};$(".nh_primary-nav").length&&$(document).on("click",function(e){!$(e.target).parent().hasClass("header-cart__open")&&$("#header-cart").hasClass("show")&&$(e.target).closest(".header-cart").length<1&&$(".header-cart").collapse("hide")}),$(document).on("click","#header-search-box .magic-box .magic-box-clear",function(){$("#header-search").collapse("hide")});window.onscroll=function(){document.body.scrollTop<300&&($(".tab-pane.show").length&&($("nh_light-nav").css("background-color","transparent"),$("nh_dark-nav").css("background-color","transparent")),$("#header-search").collapse("hide"),$(".icon-search-light").css("background-image","url("+t+"resources/icons/search-white.svg)"),$(".icon-profile-light").css("background-image","url("+t+"resources/icons/profile-white.svg)"),$(".icon-cart-light").css("background-image","url("+t+"resources/icons/cart-white.svg)"))}}(),$(".page-banner .btn").each(function(){$(this).prev().find(":last-child").hasClass("align-right")&&$(this).css("align-self","flex-end")}),$(window).resize(function(){$(".banner100").height(window.innerHeight),$(".fill-screen").height(window.innerHeight),$(".fill-screen > .wrapper").height(window.innerHeight)}),$(window).resize();var PixelsControl=function(e){this.pixelImage=$("#"+e).closest(".pixel-bg").siblings(".pixel-source-img").get(0),this.id=e,this.c=document.getElementById(e),this.ctx,this.pixelArray=[],this.request=null,this.animating=0,this.interactive=0,this.stagger=!0;var t=void 0,a=void 0;a=void 0,a=void 0;this.init=function(){var e=this;this.c&&(this.ctx=this.c.getContext("2d"),$(window).on("mousemove",function(i){!e.animating&&$("#"+e.id).length&&(a=$(i.target).offset().top-$("#"+e.id).offset().top+i.offsetY,t=$(i.target).offset().left-$("#"+e.id).offset().left+i.offsetX)}),$(window).on("click",function(i){if(!e.animating&&$("#"+e.id).length){a=$(i.target).offset().top-$("#"+e.id).offset().top+i.offsetY,t=$(i.target).offset().left-$("#"+e.id).offset().left+i.offsetX;for(var n=0;n<e.pixelArray.length;n++){var o=e.pixelArray[n],r=o.x,s=o.y,c=o.scale,l=r-20*c/2,d=s-18*c/2;if(e.pixelArray[n].grow=!0,e.pixelArray[n].targetScale=1,void 0!==t&&void 0!==a){var u=Math.sqrt(Math.pow(l+10-t,2)+Math.pow(d+9-a,2));o.delay=u}}e.animating=1,t=void 0,a=void 0}}),$(window).on("resize",function(){$("#"+e.id).length&&e.reset()}).trigger("resize"))},this.reset=function(e,i){var n=this,o=getCurrentBreakpoint();this.c.width=$(this.c).closest(".pixel-bg").width(),this.c.height=$(this.c).closest(".pixel-bg").height(),this.animating=0,t=void 0,a=void 0,cancelAnimationFrame(this.request),n.buildPattern(e,i),n.interactive="DESKTOP"===o||"EXTRA"===o,this.request=requestAnimationFrame(function(){n.render(n)})},this.buildPattern=function(){var e=this.c.width/60,t=this.c.height/58;this.pixelArray=[];for(var a=0;a<e;a++)for(var i=0;i<t;i++){var n=60*a,o=58*i;this.stagger&&(o=58*i+(a%2?29:0)),n+=10,o+=9;var r=a-1,s=a+1,c=a-e,l=a+e;this.pixelArray.push({x:n,y:o,scale:.5,targetScale:.5,left:r,right:s,up:c,down:l})}},this.render=function(e){var i=e;if(e.interactive&&(this.request=requestAnimationFrame(function(){e.render(e)}),$(i.c).is(":visible")))if(i.ctx.clearRect(0,0,i.c.width,i.c.height),i.animating){for(var n=0,o=0;o<i.pixelArray.length;o++){var r=(p=i.pixelArray[o]).x,s=p.y;p.delay=p.delay-20;var c=p.scale;n++,p.delay<=0&&p.scale!==p.targetScale&&(c=p.scale+(p.targetScale-p.scale)/4,p.scale=c,p.grow?c>=.99&&(p.grow=!1,p.targetScale=.5):c<=.501&&n--);var l=r-(h=20*c)/2,d=s-(f=18*c)/2,u=(p.scale-.5)/.5;i.ctx.globalAlpha=.5+.5*u,i.ctx.drawImage(i.pixelImage,l,d,h,f)}i.animating=n}else for(o=0;o<i.pixelArray.length;o++){var p;r=(p=i.pixelArray[o]).x,s=p.y,c=p.scale;p.scale!==p.targetScale&&(c=p.scale+(p.targetScale-p.scale)/5,p.scale=c);var h,f;l=r-(h=20*c)/2,d=s-(f=18*c)/2,u=(p.scale-.5)/.5;if(i.ctx.globalAlpha=.5+.5*u,i.ctx.drawImage(i.pixelImage,l,d,h,f),v=.5,void 0!==t&&void 0!==a){var m=Math.sqrt(Math.pow(l+10-t,2)+Math.pow(d+9-a,2));if(m<300){var v=(300-m)/300;v<.5&&(v=.5)}}p.targetScale=v}}};function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}$(function(){$(".pixel-bg").each(function(){var e=$(this).find("canvas").attr("id");new PixelsControl(e).init()})}),function(){var e=getCurrentBreakpoint();"ontouchstart"in window||navigator.msMaxTouchPoints;$(".primary-nav .tab-toggler").on("click",function(){a()}),$(document).on("mouseover",".header-backdrop",function(){a()}),$(document).on("click",".header-contact__close",function(){$(".header-backdrop").remove(),$("#header-contact").collapse("hide")}),$(document).on("mouseover",".nav-link",function(){if($(this).is("#products-nav-link")||$(this).is("#solutions-nav-link")){t();var e=$('.nav-link[data-toggle="tab"].active');e.length?i(e,$(this)):o($(this))}}),$(document).on("mouseover",".header-contact__open",function(){var e=$('.nav-link[data-toggle="tab"].active');e.length&&(n($(e.data("source"))),a()),$("#header-contact").hasClass("show")||($("#header-contact").collapse("show"),$("header").append('<div class="header-backdrop"></div>'))}),$(".secondary-nav > li > a").on("mouseenter focus",function(e){var t=$(this).parent().parent();$(".tertiary-nav-container.collapse.show",t).removeClass("show"),$('a.p[aria-expanded="true"]',t).attr("aria-expanded","false"),$($(this).data("target")).addClass("show"),$(this).attr("aria-expanded","true")});var t=function(){$("#header-contact").hasClass("show")&&($("#header-contact").collapse("hide"),$(".header-backdrop").remove())},a=function(){t();var a=$('.nav-link[data-toggle="tab"].active'),i=a.siblings(".tab-content").find(".tab-pane");a.removeClass("active link-active"),i.slideUp("slow",function(){n(i),$(".header-backdrop").remove()}),"MOBILE"!=e&&"TABLET"!=e||$("html, body").removeClass("overflow-hidden")},i=function(e,t){if(e.attr("id")!=t.attr("id")){e.removeClass("active link-active");var a=e.siblings(".tab-content").find(".tab-pane");n(a),t.addClass("active link-active");var i=t.data("source");$(i).addClass("show active"),$(i).css("display","block")}},n=function(e){e.removeClass("active show"),e.css("display","none")},o=function(t){var a=t.closest("#primary-navigation .nav-item"),i=t.data("source");t.addClass("active link-active"),a.siblings().find(".nav-link").removeClass("active"),$(i).addClass("show"),$(i).slideDown("slow",function(){$(i).addClass("active")}),$("header").append('<div class="header-backdrop"></div>'),"MOBILE"!=e&&"TABLET"!=e||$("html, body").addClass("overflow-hidden")};$("#header-search").on("show.bs.collapse",function(t){var i=$(this).closest("nav");"MOBILE"!=e&&"TABLET"!=e&&(a(),$(".header-contact").collapse("hide"),i.find(".navbar-collapse").css("visibility","hidden"),$("header").append('<div class="header-backdrop"></div>'))}).on("shown.bs.collapse",function(t){$(t.target).find(".magic-box-clear").attr("tabindex",0),"MOBILE"===e||"TABLET"===e?$(this).find(".header-search-container").css("transform","translateY(0)"):$(this).find(".header-search-container").css("transform","translateX(0)")}).on("hide.bs.collapse",function(t){$(this).closest("nav").find(".navbar-collapse").css("visibility","visible"),"MOBILE"!=e&&"TABLET"!=e?($(".header-backdrop").remove(),$(this).find(".header-search-container").css("transform","translateX(100vw)")):$(this).find(".header-search-container").css("transform","translateY(100vh)")}),$("#header-search .header-search-container").on("transitionend",function(){$(this).closest("#header-search").hasClass("show")&&$(this).find('input[role="searchbox"]').focus()}),$(document).scroll(function(e){var t=$(".nh_primary-nav");t.is(e.target)||0!==t.has(e.target).length||$("#primary-navigation").collapse("hide")}),$(document).on("focus","#header-search-box .magic-box .magic-box-input > input",function(){$(this).closest("#header-search-box").addClass("on-focus")}),$(document).on("blur","#header-search-box .magic-box .magic-box-input > input",function(){$(this).closest("#header-search-box").removeClass("on-focus")}),$(document).on("click","#header-search-box .magic-box .magic-box-clear",function(){$("#header-search").collapse("hide")}),$(document).on("keypress","#header-search-box .magic-box .magic-box-clear",function(){$("#header-search").collapse("hide")}),$(document).on("click",function(e){!$(e.target).parent().hasClass("header-cart__open")&&$("#header-cart").hasClass("show")&&$(e.target).closest(".header-cart").length<1&&$(".header-cart").collapse("hide")})}(),function(){var e=function(){function e(t){_classCallCheck(this,e),this.element=t,this.init(),this.bindEvent()}return _createClass(e,[{key:"init",value:function(){var e=this.element;e.hasClass("wide-layout")?this.initWideLayout():e.hasClass("standard-layout")&&this.initStandardLayout(),this.animateIntoView()}},{key:"bindEvent",value:function(){var e=this,t=this.element;$(window).resize(function(){e.init()}),$(window).scroll(function(){e.animateIntoView()}),t.find(".wrapper, .bg-box, .nickname, .product-type, .product-name, .description, .price, .content-cta, .product-image").on("transitionend",function(){t.hasClass("end-animate")?t.addClass("animate-in"):t.removeClass("animate-in")})}},{key:"initWideLayout",value:function(){var e=this.element,t=e.width();e.find(".product-image").css("margin","0 calc(50% - "+t/2+"px) -3rem")}},{key:"initStandardLayout",value:function(){var e=this.element,t=e.find(".nickname");t&&t.html()||e.addClass("with-padding-top")}},{key:"animateIntoView",value:function(){var e=this.element,t=getCurrentBreakpoint(),a=$(window).height(),i=$(window).scrollTop(),n=e.offset().top;"MOBILE"!==t&&(n<=a||n<=i+a-300?this.element.addClass("end-animate"):this.element.removeClass("end-animate"))}}]),e}();$(".product-hero").each(function(){new e($(this))})}(),function(){var e=function(){function e(t){_classCallCheck(this,e),this.element=t,this.init(),this.bindEvent(),this.animateIntoView()}return _createClass(e,[{key:"init",value:function(){var e=this.element;e.hasClass("logo-component")?this.initLogoComponent():e.hasClass("ttc")&&e.addClass("animate-in")}},{key:"initLogoComponent",value:function(){for(var e=this.element,t=e.find(".logo-box").length/2,a=1;a<=t;a++){var i=2*a,n=2*(a-1),o=e.find(".logo-box:lt(".concat(i,"):gt(").concat(n,"), .logo-box:eq(").concat(n,")"));o.css("transition-delay",.5*a+"s"),o.css("transition-duration","0.3s")}}},{key:"bindEvent",value:function(){var e=this,t=this,a=t.element,i=a.closest(".promo-container");a.hasClass("logo-component")?a.find(".logo-box").on("transitionend",function(){i.hasClass("end-animate")?$(this).css({"transition-delay":"0s","transition-duration":"0.01s"}):t.initLogoComponent()}):a.hasClass("ttc")&&a.find(".title, .description, .cta").on("transitionend",function(){i.hasClass("end-animate")?a.removeClass("animate-in"):a.addClass("animate-in")}),$(window).scroll(function(){e.animateIntoView()})}},{key:"animateIntoView",value:function(){var e=this.element.closest(".promo-container"),t=getCurrentBreakpoint(),a=$(window).height(),i=$(window).scrollTop(),n=e.offset().top;"MOBILE"!==t&&(n<=a||n<=i+a-100?e.hasClass("end-animate")||e.addClass("end-animate"):e.removeClass("end-animate"))}}]),e}();$(".promo-container.parsys-single-panel .ttc, .promo-container.parsys-single-panel .logo-component").each(function(){new e($(this))})}(),function(){function e(e){var t=e.find(".carousel-item"),a=e.find(".wrapper");a.css("height",""),t.css("height","");var i,n=(i=0,t.each(function(){i=Math.max(i,$(this).height())}),i);t.css("height",n),a.css("height",n)}function t(){$(".quote:not(.one-quote)").each(function(){e($(this))})}$(".quote-carousel").carousel({pause:!0,interval:!1}),t(),$(window).resize(function(){t()})}(),$(document).ready(function(){$(".ratings-and-reviews").each(function(){var e=$(this),t=e.data("bv-product-id"),a=e.data("showratings");if(siteConfig.showBV&&a&&t)loadBazaarvoiceApi(function(){});else if(0===$("html[class*=aem-AuthorLayer]").length){var i=$(this);i.hide();var n=i.closest(".mobile-accordion-section");n.hide();var o=n.parent().attr("id");$(".in-page-nav__nav a").filter(function(){return $(this).attr("href")==="#"+o}).closest(".list-inline-item").hide()}})});var RatingsReviewsApp=function(){var e=4,t=".ratings-reviews .review-list",a=".ratings-reviews .total-count",i=".ratings-reviews #sorting-selector",n=[],o=new Date,r=$(".ratings-reviews .reviews-pagination").customPagination();function s(e,a){var i=n.slice(e,a),r=$(t);r.empty(),i.forEach(function(e){var t,a,i,n,s,c=(t=e.createDateTime,a=new Date(t),i=o.getFullYear()-a.getFullYear(),n=o.getMonth()-a.getMonth(),s=o.getDate()-a.getDate(),i>0?i+" years ago":n>0?n+" months ago":s>0?s+" days ago":"today"),l='<li class="review-item"><div class="basic-info"><div class="star-box"><span class="star"></span><span style="width: '+e.overallRatingScore/5*100+'%" class="star marked"></span></div><span class="nickname"> - '+e.author+'</span><span class="review-date">'+c+'</span></div><div class="review-ratings"><div class="review-info"><h5 class="review-title">'+e.title+'</h5><p class="review-details">'+e.content+'</p></div><div class="overall-ratings"><div class="general-ratings"><div class="item"><span class="label">Quality: </span><div class="star-box"><span class="star"></span><span width="'+e.qualityRatingScore/5*100+'%" class="star marked"></span></div></div><div class="item"><span class="label">Value: </span><div class="star-box"><span class="star"></span><span width="'+e.valueRatingScore/5*100+'%" class="star marked"></span></div></div></div><div class="specific-ratings"><div class="item"><span class="description">A sweepstakes entry was received in exchange for this review:</span><span class="result">'+(e.sweepstakesEntry?"YES":"NO")+'</span></div><div class="item"><span class="description">Received free product:</span><span class="result">'+(e.receivedFreeProduct?"YES":"NO")+'</span></div><div class="item"><span class="description">Recommend this product:</span><span class="result">'+(e.recommendation?"YES":"NO")+'</span></div></div></div></div><div class="conclusion"><span class="helpful-label">Helpful?</span><div><button class="btn btn-alt-light">Yes: <span class="count">'+e.helpfulCount+'</span></button><button class="btn btn-alt-light">No: <span class="count">'+e.notHelpfulCount+'</span></button><button class="btn btn-alt-light">Report</button></div></div></li>';r.append(l)})}function c(e,t){return e.overallRatingScore-t.overallRatingScore}function l(e,t){return t.overallRatingScore-e.overallRatingScore}function d(e,t){return t.helpfulCount-e.helpfulCount}function u(e,t){return new Date(t.createDateTime)-new Date(e.createDateTime)}function p(){var t=(r.currentPage-1)*e,i=t+e;s(t,i),function(e,t){var i='<span class="start">'+e+'</span> - <span class="end">'+(t>n.length?n.length:t)+'</span> of <span class="total">'+n.length+"</span> reviews";$(a).empty(),$(a).append(i)}(t+1,i),r.createPagination()}function h(){switch($(i).val()){case"lowest":n.sort(c);break;case"latest":n.sort(u);break;case"helpful":n.sort(d);break;default:n.sort(l)}}$(i).change(function(){r.currentPage=1,h(),p()}),$(document).on("click",".ratings-reviews .reviews-pagination .pagination-item:not(.disabled)",function(e){e.preventDefault();var t=$(this).find(".pagination-link"),a=t.attr("aria-label");"Previous"===a&&r.currentPage>1?r.currentPage--:"Next"===a&&r.currentPage<r.totalPages?r.currentPage++:r.currentPage=parseInt(t.html()),p()}),$(".ratings-reviews .btn-toggle-reviews").click(function(){var e=$(this).data("show-text"),t=$(this).data("hide-text");$(this).hasClass("btn-hide-all-reviews")?$(this).html(e):$(this).html(t),$(this).toggleClass("btn-hide-all-reviews"),$(".ratings-reviews .all-reviews").slideToggle()});var f=function(t){n=t.data,r.totalPages=Math.ceil(n.length/e),h(),p()},m=function(e){$(".ratings-reviews .all-reviews").empty().append("Empty"),console.error(e)};return{init:function(e){$(".ratings-reviews").length&&$.getJSON(e).then(f).fail(m)}}}();function ownKeys(e,t){var a=Object.keys(e);if(Object.getOwnPropertySymbols){var i=Object.getOwnPropertySymbols(e);t&&(i=i.filter(function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable})),a.push.apply(a,i)}return a}function _objectSpread(e){for(var t=1;t<arguments.length;t++){var a=null!=arguments[t]?arguments[t]:{};t%2?ownKeys(Object(a),!0).forEach(function(t){_defineProperty(e,t,a[t])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(a)):ownKeys(Object(a)).forEach(function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(a,t))})}return e}function _defineProperty(e,t,a){return t in e?Object.defineProperty(e,t,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[t]=a,e}function _typeof(e){return(_typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function _possibleConstructorReturn(e,t){return!t||"object"!==_typeof(t)&&"function"!=typeof t?_assertThisInitialized(e):t}function _assertThisInitialized(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function _getPrototypeOf(e){return(_getPrototypeOf=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function _inherits(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&_setPrototypeOf(e,t)}function _setPrototypeOf(e,t){return(_setPrototypeOf=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}$(document).ready(function(){RatingsReviewsApp.init(window.Routes.getReviews)}),function(){var e=$(".related-products .tab"),t=$(".related-products .products-section");function a(e){var t=e.find(".product-item"),a=e.find(".btn-view-more");t.length>3&&a.css("display","inline-block")}$(".related-products .btn-view-more").click(function(){var e=$(this).closest(".products-section"),t=e.find(".btn-view-less");e.find(".product-item:gt(2)").css("display","block"),$(this).css("display","none"),t.css("display","inline-block")}),$(".related-products .btn-view-less").click(function(){var e=$(this).closest(".products-section");e.find(".product-item:gt(2)").css("display","none"),$(this).css("display","none"),a(e)}),e.click(function(){var e=$($(this).attr("data-target"));$(this).siblings().removeClass("active"),$(this).addClass("active"),e.siblings().removeClass("active"),e.addClass("active")}),t.each(function(){a($(this))})}(),function(){function e(e){var t=0;return e.each(function(){t=Math.max(t,$(this).height())}),t}function t(){var t,a,i,n,o,r,s,c,l=getCurrentBreakpoint();$(".resources").each(function(){$(this).find(".resource-section .resource-title").css("height","")}),"DESKTOP"!=l&&"TABLET"!=l||(t=3,$(".resources").each(function(){for(o=$(this).find(".resource-section"),s=$(this).find(".resource-section .resource-title"),c=$(this).find(".resources-view-button .resources-view-less"),$(this).find(".resource-section:lt(9)").css("display","inline-block"),a=0,i=0;a<Math.ceil(o.length/t);a++)r=s.slice(i,i+t),n=e(r),r.css("height",n),i+=t;$(this).find(".resource-section:gt(3)").hide(),c.is(":visible")&&$(this).find(".resources-view-button .resources-view-more").click()}))}$(".resources .resources-view-button .resources-view-more").each(function(){var e,t,a,i;$(this).click(function(){e=$(this).closest(".resources"),t=e.find(".resource-section"),a=e.find(".resources-view-button .resources-view-less"),i=e.find(".resources-view-button .resources-view-all"),e.find(".resource-section:lt(9)").css("display","inline-block"),$(this).hide(),a.css("display","inline-block"),t.length>9&&i.css("display","inline-block")})}),$(".resources .resources-view-button .resources-view-less").each(function(){var e,t;$(this).click(function(){e=$(this).closest(".resources"),t=e.find(".resources-view-button .resources-view-more"),e.find(".resource-section:gt(3)").hide(),$(this).hide(),e.find(".resources-view-button .resources-view-all").hide(),t.css("display","inline-block")})}),$(document).ready(function(){var e,a;$(".resources").each(function(){e=$(this).find(".resource-section"),a=$(this).find(".resources-view-button .resources-view-more"),e.length>4&&($(this).find(".resource-section:gt(3)").hide(),a.css("display","inline-block"))}),t(),setTimeout(function(){t()},5e3)}),$(window).resize(function(){t()})}(),function(){function e(e){return e||0}function t(t){var a=t.find(".long-description"),i=e(t.find(".img-box").outerHeight(!0)),n=e(t.find(".title").outerHeight(!0)),o=e(t.find(".short-description").outerHeight(!0)),r=i+n+o+e(t.find(".btn").outerHeight(!0));if(t.css("height",r),a.length>0){var s=a.outerHeight(!0);s>i/2+o&&(s=i/2+o-parseInt(a.css("margin-bottom")),a.css({height:s,"overflow-y":"scroll"}))}}function a(e){e.css("height",""),e.find(".long-description").length>0&&e.find(".long-description").css({height:"","overflow-y":"auto"})}$(window).resize(function(){$(".rollover-messaging").each(function(){a($(this)),t($(this))})}),$(document).ready(function(){$(".rollover-messaging").each(function(){var e;a($(this)),t($(this)),(e=$(this)).find(".long-description, .btn").focus(function(){e.addClass("on-focus")}).blur(function(){e.removeClass("on-focus")})})})}();var requestAnimationFrame=window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame||window.msRequestAnimationFrame,EventEmitter=function(){function e(){_classCallCheck(this,e),this.listeners={}}return _createClass(e,[{key:"addListener",value:function(e,t){return this.listeners[e]=this.listeners[e]||[],this.listeners[e].push(t),this}},{key:"on",value:function(e,t){return this.addListener(e,t)}},{key:"once",value:function(e,t){var a=this;this.listeners[e]=this.listeners[e]||[];return this.listeners[e].push(function i(){t(),a.off(e,i)}),this}},{key:"off",value:function(e,t){return this.removeListener(e,t)}},{key:"removeListener",value:function(e,t){var a=this.listeners[e];if(!a)return this;for(var i=a.length;i>0;i--)if(a[i]===t){a.splice(i,1);break}return this}},{key:"emit",value:function(e){for(var t=arguments.length,a=new Array(t>1?t-1:0),i=1;i<t;i++)a[i-1]=arguments[i];var n=this.listeners[e];return!!n&&(n.forEach(function(e){e.apply(void 0,a)}),!0)}},{key:"listenerCount",value:function(e){return(this.listeners[e]||[]).length}}]),e}(),Canvas=function(){function e(t){_classCallCheck(this,e),this.images=t.images,this.container=t.container,this.cover=t.cover,this.displayIndex=0}return _createClass(e,[{key:"setup",value:function(){var e=this;this.canvas=document.createElement("canvas"),this.container.appendChild(this.canvas),this.ctx=this.canvas.getContext("2d"),window.addEventListener("resize",function(){return e.resize()}),this.resize()}},{key:"renderIndex",value:function(e){if(this.images[e])return this.drawImage(e);for(var t=Number.MAX_SAFE_INTEGER,a=e;a>=0;a--)if(this.images[a]){t=a;break}for(var i=Number.MAX_SAFE_INTEGER,n=e,o=this.images.length;n<o;n++)if(this.images[n]){i=n;break}this.images[t]?this.drawImage(t):this.images[i]&&this.drawImage(i)}},{key:"drawImage",value:function(e){this.displayIndex=e,this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);var t=Math.floor((this.canvas.width-this.images[this.displayIndex].naturalWidth)/2),a=Math.floor((this.canvas.height-this.images[this.displayIndex].naturalHeight)/2);this.cover?this.drawImageCover(this.ctx,this.images[this.displayIndex]):this.ctx.drawImage(this.images[this.displayIndex],t,a)}},{key:"resize",value:function(){var e=$(this.container).attr("data-asset-height")/$(this.container).attr("data-asset-width"),t=$(this.container).attr("data-asset-width")/$(this.container).attr("data-asset-height"),a=$(this.container).width(),i=a*e;i>$(this.container).height()&&(a=(i=$(this.container).height())*t),this.canvas.style.height="".concat(i,"px"),this.canvas.style.width="".concat(a,"px"),this.canvas.height=i,this.canvas.width=a,this.renderIndex(this.displayIndex)}},{key:"drawImageCover",value:function(e,t,a,i,n,o,r,s){2===arguments.length&&(a=i=0,n=e.canvas.width,o=e.canvas.height),(r="number"==typeof r?r:.5)<0&&(r=0),(s="number"==typeof s?s:.5)<0&&(s=0),r>1&&(r=1),s>1&&(s=1);var c,l,d,u,p=t.width,h=t.height,f=Math.min(n/p,o/h),m=p*f,v=h*f,$=1;m<n&&($=n/m),Math.abs($-1)<1e-14&&v<o&&($=o/v),(c=(p-(d=p/((m*=$)/n)))*r)<0&&(c=0),(l=(h-(u=h/((v*=$)/o)))*s)<0&&(l=0),d>p&&(d=p),u>h&&(u=h),e.drawImage(t,c,l,d,u,a,i,n,o)}}]),e}(),ImgLoader=function(e){function t(e){var a;return _classCallCheck(this,t),(a=_possibleConstructorReturn(this,_getPrototypeOf(t).call(this))).images=e.imgsRef,a.imageNames=e.images,a.imagesRoot=e.imagesRoot,a.sequenceLength=e.images.length,a.priorityFranes=e.priorityFrames,a.complete=!1,a.loadIndex=0,a.priorityQueue=a.createPriorityQueue(),a.loadingQueue=a.createLoadingQueue(),a.loadNextImage(),a}return _inherits(t,EventEmitter),_createClass(t,[{key:"loadImage",value:function(e){var t=this;if(this.images[e])return this.loadNextImage();var a=new Image;a.addEventListener("load",function i(){a.removeEventListener("load",i),t.images[e]=a,0===e&&t.emit("FIRST_IMAGE_LOADED"),t.loadNextImage()}),a.src=(this.imagesRoot?this.imagesRoot:"")+this.imageNames[e]}},{key:"loadNextImage",value:function(){this.priorityQueue.length?(this.loadImage(this.priorityQueue.shift()),this.priorityQueue.length||this.emit("PRIORITY_IMAGES_LOADED")):this.loadingQueue.length?this.loadImage(this.loadingQueue.shift()):(this.complete=!0,this.emit("IMAGES_LOADED"))}},{key:"createPriorityQueue",value:function(){var e=this.priorityFrames||[];return e.length||(e.push(0),e.push(Math.round(this.sequenceLength/2)),e.push(this.sequenceLength-1)),e}},{key:"createLoadingQueue",value:function(){var e=this;return this.imageNames.map(function(e,t){return t}).sort(function(t,a){return Math.abs(t-e.sequenceLength/2)-Math.abs(a-e.sequenceLength/2)})}}]),t}(),SequenceAnimation=function(){function e(t){_classCallCheck(this,e),this.opts=_objectSpread({},t),this.container=t.container,this.scrollWith=t.scrollWith,this.scrollDialogues=t.scrollDialogues,this.currentStepIndex=-1,this.images=Array(t.images.length),this.imagesToLoad=t.images,this.priorityFrames=t.priorityFrames,this.loader=new ImgLoader({imgsRef:this.images,images:this.imagesToLoad,imagesRoot:this.opts.imagesRoot,priorityFrames:this.priorityFrames}),this.canvas=new Canvas({container:this.container,images:this.images,cover:this.opts.cover}),this.init()}return _createClass(e,[{key:"init",value:function(){var e=this;this.canvas.setup(),this.loader.once("FIRST_IMAGE_LOADED",function(){e.canvas.renderIndex(0)}),this.loader.once("PRIORITY_IMAGES_LOADED",function(){window.addEventListener("scroll",function(){return e.changeOnWindowScroll()})}),this.loader.once("IMAGES_LOADED",function(){})}},{key:"changeOnWindowScroll",value:function(){var e=this,t=100/(this.images.length-1),a=Math.floor(this.percentScrolled/t),i=100/this.scrollDialogues.length,n=Math.trunc(Math.floor(this.percentScrolled/i));if(this.currentStepIndex!=n){var o=this.scrollDialogues.eq(n-1),r=this.scrollDialogues.eq(n),s=this.scrollDialogues.eq(n+1);o.length&&r.length&&(o.css("opacity",0),o.css("top","-40%")),r.length&&(r.css("opacity",1),r.css("top","0")),s.length&&(s.css("opacity",0),s.css("top","40%")),this.currentStepIndex=n}requestAnimationFrame(function(){return e.canvas.renderIndex(a)})}},{key:"percentScrolled",get:function(){var e=this.opts,t=(e.starts,e.ends,this.scrollWith),a=document.documentElement,i=a.scrollTop||window.pageYOffset,n=t.clientHeight||t.offsetHeight,o=a.clientHeight,r=t,s=0;do{s+=r.offsetTop,r=r.offsetParent}while(r&&r!==window);var c=(i-s)/(n-o)*100;return c>100?100:c<0?0:c}}]),e}();function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var a=0;a<t.length;a++){var i=t[a];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(e,i.key,i)}}function _createClass(e,t,a){return t&&_defineProperties(e.prototype,t),a&&_defineProperties(e,a),e}$(document).ready(function(){$(".scroll-animation-component-container").each(function(){var e=$(this),t=e.attr("data-animation"),a=e.attr("data-frame-count"),i="."+e.attr("data-image-format"),n=Array.from({length:a},function(e,t){return t+1+i}),o=Array.from({length:a/10},function(e,t){return 10*(t+1)});new SequenceAnimation({container:e.find(".animation-media-content")[0],scrollWith:e.find(".animation-container")[0],scrollDialogues:e.find(".animation-dialogue"),images:n,imagesRoot:"http://"+window.location.host+t+"/",priorityFrames:o,cover:!0,playUntil:"scroll-out",starts:"in",ends:"out"})})}),$(document).ready(function(){$(".scroll-sequence-component-container").each(function(){new ScrollSequence($(this))})});var ScrollSequence=function(){function e(t){_classCallCheck(this,e),this.sequenceComponent=t,this.scrollContainer=t.find(".sequence-container"),this.mediaContainer=t.find(".sequence-media-container"),this.scrollDialogues=t.find(".sequence-dialogue"),this.currentStepIndex=-1;var a=[];this.sequenceComponent.find(".sequence-dialogue").each(function(e,t){a[e]={assetPath:t.getAttribute("data-asset"),assetType:t.getAttribute("data-type"),assetAutoplay:t.getAttribute("data-autoplayVideo")}}),this.sequenceAssets=a,this.init()}return _createClass(e,[{key:"init",value:function(){var e=this;window.addEventListener("scroll",function(){return e.changeOnWindowScroll()})}},{key:"changeOnWindowScroll",value:function(){var e=100/this.sequenceAssets.length,t=Math.trunc(Math.floor(this.percentScrolled/e));if(this.currentStepIndex!==t&&this.sequenceAssets.length>t){var a=this.scrollDialogues.eq(t-1),i=this.scrollDialogues.eq(t),n=this.scrollDialogues.eq(t+1);this.scrollDialogues.css("opacity",0),a.length&&a.css("transform","translateY(-40vh)"),n.length&&n.css("transform","translateY(40vh)"),this.mediaContainer.css("transition","1s ease"),this.mediaContainer.css("opacity",0);var o=this.currentStepIndex>t;o?this.mediaContainer.css("transform","translateY(40vh)"):this.mediaContainer.css("transform","translateY(-40vh)"),i.length&&setTimeout(function(e,t){t.css("opacity",0),e.css("opacity",1),e.css("transform","translateY(0)")},1500,i,this.scrollDialogues),setTimeout(function(e,a){e.mediaContainer.empty(),e.mediaContainer.removeAttr("style"),e.mediaContainer.removeAttr("dm-video-path"),e.mediaContainer.removeClass("seq-video-auto"),e.mediaContainer.removeClass("seq-video-manual"),a?e.mediaContainer.css("transform","translateY(-40vh)"):e.mediaContainer.css("transform","translateY(40vh)"),"video"===e.sequenceAssets[t].assetType?(e.mediaContainer.attr("dm-video-path",e.sequenceAssets[t].assetPath),"true"===e.sequenceAssets[t].assetAutoplay?e.mediaContainer.addClass("seq-video-auto"):e.mediaContainer.addClass("seq-video-manual"),$(e.mediaContainer).attr("dm-video-path")&&AEMGenerateVideo.initDMVideoJSONToContainer(e.mediaContainer)):e.mediaContainer.css("background-image","url("+e.sequenceAssets[t].assetPath+")"),setTimeout(function(e){e.mediaContainer.css("transition","1s ease"),e.mediaContainer.css("transform","translateY(0)"),e.mediaContainer.css("opacity","1")},500,e)},1e3,this,o),this.currentStepIndex=t}}},{key:"percentScrolled",get:function(){var e=this.scrollContainer[0],t=document.documentElement,a=t.scrollTop||window.pageYOffset,i=e.clientHeight||e.offsetHeight,n=t.clientHeight,o=e,r=0;do{r+=o.offsetTop,o=o.offsetParent}while(o&&o!==window);var s=(a-r)/(i-n)*100;return s>100?100:s<0?0:s}}]),e}();function getCurrentBreakpoint(){return window.getComputedStyle(document.querySelector("body"),"::before").getPropertyValue("content").replace(/\"/g,"")}function getCurrentLocation(){var e=window.location.href;return e.includes("localhost:3000")||e.includes("8080")?"../../":"/etc.clientlibs/poly/clientlibs/clientlib-site/"}function makeHeaderOpaque(e,t){$(".transparent-header").length&&($(".navbar").css("background","transparent"),$(".nh_primary-nav").css("background-color","white"),$("a.nav-link").css("color","#ff3b00"),$(".fa-arrow-right").css("color","#ff3b00"),$(".poly-only").attr("src",t+"resources/images/poly-name.svg"),$(".icon-search-light").css("background-image","url("+t+"resources/icons/search.svg)"),$(".icon-profile-light").css("background-image","url("+t+"resources/icons/profile.svg)"),$(".icon-cart-light").css("background-image","url("+t+"resources/icons/cart.svg)"),e&&$(".transparent-header").data("header-version","opaque"))}function makeHeaderTransparent(){var e=getCurrentLocation();$(".transparent-header").length&&($(".transparent-header").data("gradient"),$(".nh_primary-nav").css({"background-color":"transparent","border-bottom":"medium none white"}),$("a.nav-link").css("color","white"),$(".fa-arrow-right").css("color","white"),$(".transparent-header").data("header-version","transparent"),$(".poly-only").attr("src",e+"resources/images/poly-name-white.svg"),$(".icon-search").css("background-image","url("+e+"resources/icons/search-white.svg)"),$(".icon-profile").css("background-image","url("+e+"resources/icons/profile-white.svg)"),$(".icon-cart").css("background-image","url("+e+"resources/icons/cart-white.svg)"))}$(document).ready(function(){$(".software-downloads-container").each(function(){!function(e){var t=e,a=t.getAttribute("id"),i=t.querySelector(".eula-modal"),n=i.getAttribute("id"),o=t.querySelector(".export-modal"),r=o.getAttribute("id");console.log("downloads id ",a," eula id ",n,"export id ",r);var s=i.querySelector(".eula-modal-accept"),c=o.querySelector(".export-modal-accept"),l=i.querySelector(".eula-modal-close"),d=o.querySelector(".export-modal-close"),u=t.querySelector(".download-section"),p=void 0,h=t.querySelector(".os-modal"),f=h.querySelector(".os-modal-accept"),m=h.querySelector(".os-modal-close"),v=document.getElementsByClassName("software-downloads-container")[0].getAttribute("id");$(u).on("click",function(e){var t=e.target.getAttribute("data-link"),a=event.target.classList;if("download-icon"==e.target.getAttribute("class"))if(""!=e.target.parentElement.getAttribute("noticepath"))if("first"==e.target.parentElement.getAttribute("noticedwnorder")){$(".os-modal .modal-footer .accept").attr("data-target","#"+v+"_eula"),$(".os-modal .modal-footer .accept").attr("data-toggle","modal"),$(".export-modal .modal-footer .accept").attr("data-target",""),$(".export-modal .modal-footer .accept").attr("data-toggle","");var i=e.target.parentElement.getAttribute("noticepath")+"/jcr:content/root/responsivegrid";$(".os-modal .content.modal-body .additional-notice-content").hide(),$(".os-modal .content.modal-body").find("[data-path='"+i+"']").show();var n=e.target.parentElement.getAttribute("data-link");p=e.target.parentElement,f.setAttribute("title",n),f.setAttribute("data-link",n)}else{$(".export-modal .modal-footer .accept").attr("data-target","#"+v+"_os"),$(".export-modal .modal-footer .accept").attr("data-toggle","modal"),$(".os-modal .modal-footer .accept").attr("data-target",""),$(".os-modal .modal-footer .accept").attr("data-toggle","");var o=e.target.parentElement.getAttribute("data-link");p=e.target.parentElement,s.setAttribute("title",o),s.setAttribute("data-link",o)}else{var r=e.target.parentElement.getAttribute("data-link");p=e.target.parentElement,s.setAttribute("title",r),s.setAttribute("data-link",r),$(".os-modal .modal-footer .accept").attr("data-target",""),$(".os-modal .modal-footer .accept").attr("data-toggle",""),$(".export-modal .modal-footer .accept").attr("data-target",""),$(".export-modal .modal-footer .accept").attr("data-toggle","")}if(a.contains("download-link"))if(""!=e.target.getAttribute("noticepath"))if("first"==e.target.getAttribute("noticedwnorder")){$(".os-modal .modal-footer .accept").attr("data-target","#"+v+"_eula"),$(".os-modal .modal-footer .accept").attr("data-toggle","modal"),$(".export-modal .modal-footer .accept").attr("data-target",""),$(".export-modal .modal-footer .accept").attr("data-toggle","");var c=e.target.getAttribute("noticepath")+"/jcr:content/root/responsivegrid";$(".os-modal .content.modal-body .additional-notice-content").hide(),$(".os-modal .content.modal-body").find("[data-path='"+c+"']").show(),p=e.target,f.setAttribute("title",t),f.setAttribute("data-link",t)}else $(".export-modal .modal-footer .accept").attr("data-target","#"+v+"_os"),$(".export-modal .modal-footer .accept").attr("data-toggle","modal"),$(".os-modal .modal-footer .accept").attr("data-target",""),$(".os-modal .modal-footer .accept").attr("data-toggle",""),p=e.target,s.setAttribute("title",t),s.setAttribute("data-link",t);else p=e.target,s.setAttribute("title",t),s.setAttribute("data-link",t),$(".os-modal .modal-footer .accept").attr("data-target",""),$(".os-modal .modal-footer .accept").attr("data-toggle",""),$(".export-modal .modal-footer .accept").attr("data-target",""),$(".export-modal .modal-footer .accept").attr("data-toggle","")}),$(l).on("click",function(e){s.setAttribute("title",""),s.setAttribute("data-link","")}),$(s).on("click",function(e){var t=e.target.getAttribute("data-link");c.setAttribute("data-link",t),c.setAttribute("title",t),s.setAttribute("title",""),s.setAttribute("data-link","")}),$(d).on("click",function(e){c.setAttribute("data-link",""),c.setAttribute("title","")}),$(c).on("click",function(e){var t=e.target.getAttribute("data-link"),a=p.getAttribute("download");$(".export-modal .modal-footer .accept")[0].hasAttribute("data-target")&&$(".export-modal .modal-footer .accept").attr("data-target")=="#"+v+"_os"?(f.setAttribute("data-link",t),f.setAttribute("title",t),c.setAttribute("data-link",""),c.setAttribute("title","")):(c.setAttribute("data-link",""),c.setAttribute("title",""),console.log("Got export link ",t," file ",a),window.location=t)}),$(m).on("click",function(e){f.setAttribute("title",""),f.setAttribute("data-link","")}),$(f).on("click",function(e){var t=e.target.getAttribute("data-link"),a=p.getAttribute("download");$(".os-modal .modal-footer .accept")[0].hasAttribute("data-target")&&$(".os-modal .modal-footer .accept").attr("data-target")=="#"+v+"_eula"?(s.setAttribute("data-link",t),s.setAttribute("title",t),f.setAttribute("title",""),f.setAttribute("data-link","")):(f.setAttribute("title",""),f.setAttribute("data-link",""),console.log("Got export link ",t," file ",a),window.location=t)})}(this)})}),function(){function e(){var e=getCurrentBreakpoint(),t=$(".solution-finder.variant-two .bg-box"),a=$(".solution-finder.variant-two .carousel-inner"),i=a.siblings(".navigate-container"),n=a.find(".carousel-item.active");if("MOBILE"===e||"TABLET"===e){if(a.hasClass("expanded"))return;a.addClass("panel-layout");var o=n.data("main-image");t.css("background-image","url("+o+")")}else{o=t.data("default-image");a.removeClass("panel-layout"),a.removeClass("expanded"),t.css("background-image","url("+o+")")}i.css("display","none"),i.find(".item").removeClass("active"),n.removeClass("active")}$(".solution-finder.variant-one .carousel-item, .solution-finder.variant-three .product-item").on("mouseover",function(){$(this).find(".content").addClass("active")}),$(".solution-finder.variant-one .carousel-item, .solution-finder.variant-three .product-item").on("mouseout",function(){$(this).find(".content").removeClass("active")}),$(".solution-finder.variant-two .carousel-item").on("mouseover",function(){var e=getCurrentBreakpoint(),t=$(this).closest(".solution-finder "),a=t.find(".carousel-inner"),i=$(this).attr("data-main-image");if("MOBILE"===e||"TABLET"===e){var n=$(this).index();$(this).addClass("active"),a.addClass("expanded"),a.removeClass("panel-layout"),t.find(".navigate-container").css("display","flex"),t.find(".navigate-container .item").eq(n).addClass("active")}t.find(".bg-box").css("background-image","url("+i+")")}),$(".solution-finder.variant-two .solution-gallery").on("slide.bs.carousel",function(e){var t=$(e.relatedTarget),a=$(this).closest(".solution-finder").find(".bg-box"),i=t.data("main-image");a.css("background-image","url("+i+")")}),$(".solution-finder .solution-gallery").carousel({pause:!0,interval:!1}),$(document).ready(function(){e()}),$(window).resize(function(){e()})}(),$(window).scroll(function(){$(".solution-promo-container").each(function(){!function(e){if("MOBILE"!==getCurrentBreakpoint()){var t=$(window).height(),a=$(window).scrollTop(),i=e.offset().top,n=e.height();i<t||i<=a+t-.6*n?e.find(".img-box, .content-container .content").css("transform","translateY(0)"):(e.find(".img-box").css("transform","translateY(10%)"),e.find(".content-container .content").css("transform","translateY(20%)"))}}($(this))})}),$(".support-detail-top-section .support-model-list .modal-item").on("click",function(e){e.stopPropagation();var t=$(this).closest(".support-detail-top-section");t.find(".support-model-list .modal-item").removeClass("active"),$(this).addClass("active"),t.find(".product-image .img-box").removeClass("active"),t.find('.product-image .img-box[data-target="'+$(this).data("target")+'"]').addClass("active"),"MOBILE"==getCurrentBreakpoint()&&$("html, body").animate({scrollTop:t.offset().top},100)}),window.addEventListener("load",function(){if(window.location.pathname.indexOf("support-spc/products")>-1||window.location.pathname.indexOf("support/products")>-1){var e=window.location.hash;if(""!==e){var t=document.querySelector(e);console.log(t),t&&(t.click(),t.style.border="0px solid #FFF !important")}}}),$(".write-a-review-modal .rating .star").on("mouseover mouseout click",function(e){var t=$(this).closest(".input-item").find("input"),a=$(this).parent();"mouseover"===e.type?(a.find(".marked").removeClass("marked"),$(this).addClass("marked"),$(this).prevAll().addClass("marked")):"mouseout"===e.type?(a.find(".marked:not(.locked)").removeClass("marked"),a.find(".locked:not(.marked)").addClass("marked")):"click"===e.type&&(a.find(".locked").removeClass("locked"),a.find(".marked").addClass("locked"),t.focus().val($(this).closest(".rating").find(".locked").length),t.trigger("input"),t.trigger("propertychange")),function(e){var t=e.closest(".rating"),a=t.find(".click-label");switch(t.find(".marked").length){case 1:a.html(a.data("poor"));break;case 2:a.html(a.data("fair"));break;case 3:a.html(a.data("average"));break;case 4:a.html(a.data("good"));break;case 5:a.html(a.data("excellent"));break;default:a.html(a.data("default"))}}($(this))});
//# sourceMappingURL=components.min.js.map

$( document ).ready(function() {

    $(".quickLinks.threeDots").on('click', function(event){
        event.stopPropagation();
        event.stopImmediatePropagation();
        $(this).addClass("hideIconLayout");
        $('.slds-slot').removeClass("hideSldsGrid");
    });
    
    $(".iconLayout.sideArrow").on('click', function(event){
        event.stopPropagation();
        event.stopImmediatePropagation();
        $('.slds-slot').addClass("hideSldsGrid");
        $('.quickLinks.threeDots').removeClass("hideIconLayout");
    });     

    $(".slds-button_icon.quick_link").on('click', function(event){
		 var areaExpanded=$('.lightning-tree.quick_link').attr("aria-expanded");
         console.log("areaExpanded", areaExpanded);
        if(areaExpanded==="true"){
             $('.lightning-tree.quick_link').attr("aria-expanded",false);
        }else{
            $('.lightning-tree.quick_link').attr("aria-expanded",true);
        }
    });

    $(".slds-tree__item").on('click', function(event){

        $('lightning-tree-item').attr("aria-selected", false);
			$(this).parent().attr("aria-selected", true);
    });

});
$(function () {
    $('[data-toggle="tooltip"]').tooltip()
})

// used for support nav
$(document).on('click', '#my-account', function() {
    $('#my-account-menu').toggle();
});

function setLoginState() {
    var sfdcContext;
    if (window.localStorage.hasOwnProperty('sfdcContext')){
        sfdcContext = JSON.parse(window.localStorage.sfdcContext);
    }

    if(sfdcContext && digitalData != undefined && digitalData.hasOwnProperty('visitor')){
        digitalData.visitor.userId = sfdcContext.userId;
        digitalData.visitor.userType = sfdcContext.persona;
    } else if(!sfdcContext && digitalData != undefined && digitalData.hasOwnProperty('visitor')){
        digitalData.visitor.userId = '';
        digitalData.visitor.userType = '';
    }
    if (sfdcContext && sfdcContext.persona != 'Guest') {
        $('.userNameDetails').html(sfdcContext.userName);
        $('.emailDetails').html(sfdcContext.email);
        $('#my-account-items-sign-in').hide();
        $('#my-account-items-sign-out').show();
        $('#support-home').attr('href', 'https://'+sfdcEnvName+'/'+sfdcExpBuilderName+'/s');
        $("[id='Contact Us']").attr('href', 'https://' + sfdcEnvName + '/' + sfdcExpBuilderName + '/s/contact-us');
    } else {
        $('.userNameDetails').html('');
        $('.emailDetails').html('');
        $('#my-account-items-sign-in').show();
        $('#my-account-items-sign-out').hide();
        $('#support-home').attr('href', '/us/en/support');
        $("[id='Contact Us']").attr('href', '/us/en/support/contact');
    }
}

setLoginState();
$(document).ready(function () {

    var updateDate = function (option, row) {
        var documentLink = $(row).find(".documents-link");
        $(documentLink).attr('data-link', $(option).data("path"));
        $(documentLink).attr('href', $(option).data("path"));
        $(documentLink).html($(option).data("title"));
    }

    var supportDocuments = $('.documents-row');
    for (var i = 0; i < supportDocuments.length; i++) {
        var supportDocument = supportDocuments[i];
        var documentrow = $(supportDocument).find('.documents-language-select');
        if (documentrow) {
            var optionsList = $(documentrow).find('option');
            updateDate(optionsList[0], supportDocument);
        }
    }
    $(".documents-language-select").change(function () {
        var value = $(this).val();
        var documentsRow = $(this).parents('.documents-row');
        var optionsList = $(this).find('option');
        var link = document.createElement('a');
        link.href = $(this).val();
        // console.log(value);
        for (var i = 0; i < optionsList.length; i++) {
            var option = optionsList[i];
            if ($(option).data("path") === value) {
                updateDate($(option), documentsRow);
                link.datalink = $(option).data("path");
                link.setAttribute('target', '_blank');
                link.dispatchEvent(new MouseEvent('click'));
                break;
            }
        }
    });

});
        
$(document).ready(function(){

  var panels=jQuery(".cmp-tabs__tabpanel");
  for (var i = 0; i < panels.length; i++) {
      var panel=panels[i];
      var panelHeading=$(panel).find(".panel-heading")[0];
      var panelConent=$(panel).find(".panel-collapse")[0];
      if(panelHeading){
          $(panelHeading).addClass('active');
      }
      if(panelConent){
          $(panelConent).addClass('show');
      }
  }
    var updateDate=function(option,row){
       $(row).find(".download-link").attr('data-link', $(option).data("path"));
        $(row).find(".notestype").hide();
      if($(option).data("notespath")){
        $(row).find(".notes-link").attr('href',$(option).data("notespath"));
        if($(option).data("notestype") && $(option).data("notestype")=="pdf"){
            $(row).find(".pdf-icon").show();
        }else{
            $(row).find(".html-icon").show();
        }
      }
        $(row).find(".title").text($(option).data("title"));
        $(row).find(".product-title").text($(option).data("title"));
        $(row).find(".releasedate").text($(option).data("releasedate"));
        var downloadIcon=$(option).data("size")+" "+$(option).data("sizeunit");
        $(row).find(".download-link").empty();
        $(row).find(".download-link").html("<span class='download-icon'>&nbsp;</span>"+downloadIcon);

        // if there is another modal agreement in the pop up order, add details to the download link
        if($(option).data("noticedwnpath")) {
          $(row).find(".download-link").attr("noticepath", $(option).data("noticedwnpath"));
          
          if($(option).data("noticedwnpopuporder") == "" || $(option).data("noticedwnpopuporder") == "first") {
            $(row).find(".download-link").attr("noticedwnorder", "first");
            let hrefAttr = $(row).find(".download-link").attr("href");
            hrefAttr = hrefAttr.replace("eula", "os");
            $(row).find(".download-link").attr("href", hrefAttr);
          } else {
            $(row).find(".download-link").attr("noticedwnorder", "last");
            let hrefAttr = $(row).find(".download-link").attr("href");
            hrefAttr = hrefAttr.replace("os", "eula");
            $(row).find(".download-link").attr("href", hrefAttr);
          }
        } else {
          let hrefAttr = $(row).find(".download-link").attr("href");
          hrefAttr = hrefAttr.replace("os", "eula");
          $(row).find(".download-link").attr("href", hrefAttr);
          $(row).find(".download-link").attr("noticepath", "");
          $(row).find(".download-link").attr("noticedwnorder", "");
        }
        
    }

   var softwareDownloads= $(".software-download");
    for(var i=0;i<softwareDownloads.length;i++){
		var softwareDownload=softwareDownloads[i];
        var downloadrow=$(softwareDownload).parents('.downloads-row');
        var optionsList=$(softwareDownload).find('option');
		updateDate(optionsList[0],downloadrow);
    }
  $(".software-download").change(function() {
        var value=$(this).val();
        var downloadcard=$(this).parents('.downloads-row');
        var optionsList= $(this).find('option');
        for(var i=0;i<optionsList.length;i++){
            var option =optionsList[i]; 
            if($(option).data("version")===value){
                updateDate($(option),downloadcard);
                break; 
            }
        }
    });

  $('.panel-collapse').on('show.bs.collapse', function () {
    $(this).siblings('.panel-heading').addClass('active');
  });

  $('.panel-collapse').on('hide.bs.collapse', function () {
    $(this).siblings('.panel-heading').removeClass('active');
  });

});
$(document).ready(function(){

  const PRODUCT_CHOOSER_CSS_BASE = "product-chooser__";
  const ALL_PRODUCTS_FAMILY_REGEX = /product-chooser__.+__family__all-products/;
  const BACK_TO_CATEGORIES_FAMILY_REGEX = /product-chooser__.+__family__back-to-categories/;
  const CATEGORIES_DIV = "product-chooser__categories"
  const CATEGORY_SEARCH_PARAM = "category";
  const CATEGORY_TILE_LAVA_BORDER_CLASS = "product-chooser__category__tile--lava-border";
  const CATEGORY_TILE_NORMAL_BORDER_CLASS = "product-chooser__category__tile--normal-border";
  const COMPATIBILITY_GUIDE_ID = "productcompatibilityguidediv";
  const DROPDOWN_ID = PRODUCT_CHOOSER_CSS_BASE + "products__dropdown";
  const DROPDOWN_OPTIONS_CLASS = PRODUCT_CHOOSER_CSS_BASE + "products__dropdown__options";
  const DROPDOWN_OPTIONS_NAME_CLASS = PRODUCT_CHOOSER_CSS_BASE + "products__dropdown__options__name";
  const DROPDOWN_OPTIONS_FEATURED_CLASS = PRODUCT_CHOOSER_CSS_BASE + "products__dropdown__options__featured";
  const DROPDOWN_SELECTOR_CLASS = DROPDOWN_ID + "__selector";
  const DROPDOWN_SELECTED_CLASS = DROPDOWN_SELECTOR_CLASS + "__selected";
  const DROPDOWN_SELECTED_NAME_CLASS = DROPDOWN_SELECTED_CLASS + "__name";
  const DROPDOWN_SELECTED_FEATURED_CLASS = DROPDOWN_SELECTED_CLASS + "__featured";
  const END_OF_LIFE_FAMILY_REGEX = /product-chooser__.+__family__end-of-life/;
  const END_OF_LIFE_PRODUCT_CLASS = "endoflife";
  const FAMILY_ACTIVE_CLASS = PRODUCT_CHOOSER_CSS_BASE + "family__link--active";
  const FAMILY_END_OF_LIFE_CLASS = PRODUCT_CHOOSER_CSS_BASE + "family__end-of-life"
  const FAMILY_HIDDEN_CLASS = PRODUCT_CHOOSER_CSS_BASE + "family--hidden";
  const FAMILY_INACTIVE_CLASS = PRODUCT_CHOOSER_CSS_BASE + "family__link--inactive";
  const FAMILY_SPECIFIC_CLASS = PRODUCT_CHOOSER_CSS_BASE + "family__link--specific";
  const PRODUCT_FAMILY_DIV_ID = PRODUCT_CHOOSER_CSS_BASE + "family-product-div";
  const FAMILY_SEARCH_PARAM = "family";
  const FEATURED_PRODUCT_CLASS = PRODUCT_CHOOSER_CSS_BASE + "product--featured";
  const PRODUCT_CHOOSER_HIDDEN_CLASS = "product-chooser--hidden";
  const PRODUCTS_DIV_ID = "products";
  const PRODUCTS_IFRAME_ID = "product-chooser__products__iframe";
  const PRODUCTS_PREFIX = "product-chooser__products__";
  const PRODUCTS_SORT_ID = PRODUCT_CHOOSER_CSS_BASE + "products__sort";
  const PRODUCTS_SORT_HIDDEN = "product-chooser__products__sort--hidden";
  const PRODUCTS_SORT_SELECT_ID = PRODUCT_CHOOSER_CSS_BASE + "products__sort__select";
  const PRODUCTS_SORT_SUFFIX = "__sort";
  const SUPPORT_CONTENT_CLASS = PRODUCT_CHOOSER_CSS_BASE + "product--support-content";

  if (document.getElementById(PRODUCTS_DIV_ID) == null) {
    return;
  }

  const PRODUCT_SORT_TYPE = {
    Alphabetical: "Name",
    Featured: "Featured",
  }

  const PRODUCTS = document.getElementById(PRODUCTS_DIV_ID).children;
  const PRODUCT_LOOKUP = createProductLookup(PRODUCTS);
  const PRODUCTS_SORTED_ALPHABETICAL = getSortedProductsArray(PRODUCTS, PRODUCT_SORT_TYPE.Alphabetical);
  const PRODUCTS_SORTED_FEATURED = getSortedProductsArray(PRODUCTS, PRODUCT_SORT_TYPE.Featured);

  let sortOrder = PRODUCT_SORT_TYPE.Alphabetical;
  let scrollIntoView = true;

  function createProductLookup(products) {
    let productLookup = {};
    for (let product of products) {
      productLookup[product.id] = product;
    }
    return productLookup;
  }

  /**
   * Creates a sorted array of references from a list of products.
   * @param productNodeList the list of products to sort. Assumes these are the product
   * <a> tags from the product chooser.
   * @param sortType the type of sort to perform, see PRODUCT_SORT_TYPE
   * @returns an array of references to the products in the order they should be sorted.
   */
  function getSortedProductsArray(productNodeList, sortType) {
    let sortedProductsArray = Array.from(productNodeList);
    switch (sortType) {
      case PRODUCT_SORT_TYPE.Alphabetical:
        sortedProductsArray.sort(function(a, b) {
          const aIsSupportContent = a.classList.contains(SUPPORT_CONTENT_CLASS);
          const bIsSupportContent = b.classList.contains(SUPPORT_CONTENT_CLASS);
          if (aIsSupportContent && !bIsSupportContent) {
            return 1;
          }
          if (!aIsSupportContent && bIsSupportContent) {
            return -1;
          }
          return a.id < b.id ? -1 : 1;
        });
        break;
      case PRODUCT_SORT_TYPE.Featured:
      default:
        sortedProductsArray.sort(function(a, b) {
          return a.dataset.order - b.dataset.order;
        });
    }
    return sortedProductsArray;
  }

  function updateProductOrder(sortType) {
    const productsDiv = document.createElement("div");
    switch(sortType) {
      case PRODUCT_SORT_TYPE.Alphabetical:
        PRODUCTS_SORTED_ALPHABETICAL.forEach(function(product) {
          productsDiv.append(PRODUCT_LOOKUP[product.id]);
        });
        break;
      case PRODUCT_SORT_TYPE.Featured:
      default:
        PRODUCTS_SORTED_FEATURED.forEach(function(product) {
          productsDiv.append(PRODUCT_LOOKUP[product.id]);
        });
        break;
    }
    document.getElementById(PRODUCTS_DIV_ID).innerHTML = productsDiv.innerHTML;

    let currentFamily = document.querySelector("." + FAMILY_ACTIVE_CLASS);
    console.log("Current family: " + currentFamily);
    if (currentFamily) {
      currentFamily.click();
      console.log("Clicked: " + currentFamily.id);
    } else {
      let category = document.querySelector(".categoryinputlabel." + CATEGORY_TILE_LAVA_BORDER_CLASS);
      if (category) {
        scrollIntoView = false;
        category.click();
      }
    }
  }

  function hideEmptyEndOfLifeFamilies() {
    let eolFamilies = document.querySelectorAll("." + FAMILY_END_OF_LIFE_CLASS);
    eolFamilies.forEach(function(family) {
      let category = family.id.split("__")[1];
      let eolProducts = document.querySelectorAll("." + category + "product.endoflife");
      if (eolProducts.length === 0) {
        family.classList.add("product-chooser__family--disabled");
      }
    });
  }

  /**
   * Adds event listeners to the product category tiles.
   */
  function addCategoryTileClickHandler() {
    const categoryInputs = document.querySelectorAll("input[name='categoryinput']");
    if (categoryInputs == null) {
      console.debug("addCategoryTileClickHandler: No category inputs found");
      return;
    }
    for (const categoryInput of categoryInputs) {
      categoryInput.addEventListener("click", function (ev) {
        const previousSelected = document.querySelector('input[name="categoryinput"].selected');
        if (previousSelected != null) {
          previousSelected.classList.remove("selected");
          previousSelected.closest(".categoryinputlabel").classList.remove(CATEGORY_TILE_LAVA_BORDER_CLASS);
          previousSelected.closest(".categoryinputlabel").classList.add(CATEGORY_TILE_NORMAL_BORDER_CLASS);
          hideFamilies(previousSelected.value);
        }
        ev.currentTarget.classList.add("selected");
        ev.currentTarget.closest(".categoryinputlabel").classList.remove(CATEGORY_TILE_NORMAL_BORDER_CLASS);
        ev.currentTarget.closest(".categoryinputlabel").classList.add(CATEGORY_TILE_LAVA_BORDER_CLASS);
        console.debug(ev.currentTarget.closest(".categoryinputlabel").classList);
        document.getElementById(DROPDOWN_ID).classList.remove(PRODUCT_CHOOSER_HIDDEN_CLASS);
        showCategoryFamilies(ev.currentTarget.value);

        if (scrollIntoView) {
          document.querySelector("#product-chooser__" + categoryInput.value + "__family__header").scrollIntoView({behavior: "smooth"});
        } else {
            scrollIntoView = true;
        }
      });
    }
  }

  function hideFamilies(category) {
    if (category == null) {
      console.debug("hideFamilies: No category provided");
      return;
    }

    const productOuterDiv = document.querySelector("#product-chooser__family-product-div");
    if (productOuterDiv == null) {
      console.debug("hideFamilies: No product outer div found");
      return;
    }
    productOuterDiv.style.display="flex";

    const productDivs = document.querySelectorAll(".productdiv");
    if (productDivs == null) {
      console.debug("hideFamilies: No product divs found");
      return;
    }
    hideElements(productDivs);

    const categoryFamilyDivs = document.querySelectorAll(".product-chooser__category__families");
    if (categoryFamilyDivs == null) {
      console.debug("hideFamilies: No category family divs found");
      return;
    }
    hideElements(categoryFamilyDivs);

    const familyDiv = document.querySelector("#product-chooser__" + category + "__families");
    if (familyDiv == null) {
      console.debug("hideFamilies: No family div found");
      return;
    }
    hideElements([familyDiv]);

    const activeFamilyLinks = familyDiv.querySelectorAll("a");
    if (activeFamilyLinks != null) {
      activeFamilyLinks.forEach(function (activeFamilyLink) {
        makeFamilyInactive(activeFamilyLink);
      });
    }
  }

  /**
   * Sets the display value for a series of HTML elements to "block"
   * @param elements array of elements to set display to "block"
   */
  function showElements(elements) {
    if (elements == null) {
      console.debug("showElements: No elements provided");
      return;
    }
    elements.forEach(function(element) {
      element.style.display = "block";
    });
  }

  /**
   * Sets the display value for a series of HTML elements to "none"
   * @param elements array of elements to set display to "none"
   */
  function hideElements(elements) {
    if (elements == null) {
        console.debug("hideElements: No elements provided");
        return;
    }

    elements.forEach(function(element) {
      element.style.display = "none";
    });
  }

  /**
   * Shows the families for a product category.
   * @param category the product category to show
   */
  function showCategoryFamilies(category) {
    if (category == null) {
      console.debug("showCategoryFamilies: No category provided");
      return;
    }

    const productOuterDiv = document.querySelector("#product-chooser__family-product-div");
    if (productOuterDiv == null) {
      console.debug("showCategoryFamilies: No product outer div found");
      return;
    }
    productOuterDiv.style.display="flex";

    const productDivs = document.querySelectorAll(".productdiv");
    if (productDivs == null) {
      console.debug("showCategoryFamilies: No product divs found");
      return;
    }
    hideElements(productDivs);

    const categoryFamilyDivs = document.querySelectorAll(".product-chooser__category__families");
    if (categoryFamilyDivs == null) {
      console.debug("showCategoryFamilies: No category family divs found");
      return;
    }
    hideElements(categoryFamilyDivs);

    const familyDiv = document.querySelector("#product-chooser__" + category + "__families");
    if (familyDiv == null) {
      console.debug("showCategoryFamilies: No family div found");
      return;
    }
    const familyLinks = familyDiv.querySelectorAll("a");
    for (const familyLink of familyLinks) {
      if (familyLink.dataset.family === "endoflife"
          || familyLink.dataset.family === "all") {
        continue;
      }
      const familyProducts = document.getElementById(PRODUCTS_DIV_ID).querySelectorAll("[data-family='" + familyLink.dataset.family + "']:not(.endoflife)");
      if (familyProducts.length === 0) {
        familyLink.classList.remove(...familyLink.classList);
        familyLink.classList.add(FAMILY_HIDDEN_CLASS);
      }
    }
    showElements([familyDiv]);

    const allProducts = document.getElementById(PRODUCTS_DIV_ID).querySelectorAll("." + category + "product" + ":not(." + "endoflife");
    if (allProducts == null) {
      console.debug("addCategoryTileClickHandler: No featured products found");
    } else {
      showElements(allProducts);
    }
    familyDiv.scrollIntoView({ behavior: "smooth" , block: "center" });
    const allFamily = document.getElementById(PRODUCT_CHOOSER_CSS_BASE + category + "__family__all-products");
    makeFamilyActive(allFamily);
    //allFamily.click();
  }

  /**
   * Adds event listeners to the product family tiles.
   */
  function addFamilyFilterClickHandler() {
    const categoryFamilies = document.querySelectorAll(".product-chooser__category__families");
    if (categoryFamilies == null) {
      console.debug("addFamilyFilterClickHandler: No category families found");
      return;
    }
    for (const categoryFamily of categoryFamilies) {
      const familyLinks = categoryFamily.querySelectorAll("a");
      if (familyLinks == null) {
        console.debug("addFamilyFilterClickHandler: No family links found");
        return;
      }
      for (const familyLink of familyLinks) {
        familyLink.addEventListener("click", ev => {
          ev.preventDefault();

          let nav = ev.currentTarget.closest(".product-chooser__category__families");
          if (nav == null) {
            console.debug("addFamilyFilterClickHandler: No nav found");
            return;
          }

          let category = nav.id.split("__families")[0].split("__")[1];
          if (category == null) {
            console.debug("addFamilyFilterClickHandler: No category found");
            return;
          }

          const currentFamily = nav.querySelector("." + FAMILY_ACTIVE_CLASS);
          if (currentFamily == null) {
            console.debug("addFamilyFilterClickHandler: No current family found");
          } else {
            makeFamilyInactive(currentFamily);
          }
          makeFamilyActive(ev.currentTarget);

          let activeSoftware = null;
          try {
            activeSoftware = document.getElementById(PRODUCT_FAMILY_DIV_ID)
                .querySelectorAll(".product-chooser__family__link--active[data-family='polyucsoftware']");
            console.log("active software: " + activeSoftware);
          } catch (e) {
            console.debug("addFamilyFilterClickHandler: No active software family found");
          }

          let categoryProducts;
          if (activeSoftware === null || activeSoftware.length === 0) {
            categoryProducts = document.querySelectorAll("." + category
                + "product, #" + COMPATIBILITY_GUIDE_ID);
          } else {
            categoryProducts = document.querySelectorAll("." + category
                + "product, #" + COMPATIBILITY_GUIDE_ID + ", [data-family='polyucsoftware']");
          }

          if (categoryProducts == null) {
            console.debug("addFamilyFilterClickHandler: No category products found");
            return;
          }

          // All Products
          if (ALL_PRODUCTS_FAMILY_REGEX.test(ev.currentTarget.id)) {
            categoryProducts.forEach(function(product) {
              if (!product.classList.contains(END_OF_LIFE_PRODUCT_CLASS)) {
                showElements([product]);
              } else {
                hideElements([product]);
              }
            });
            return;
          }

          hideElements(categoryProducts);

          // End of Life
          if (END_OF_LIFE_FAMILY_REGEX.test(ev.currentTarget.id)) {
            categoryProducts.forEach(function(product) {
              if (product.classList.contains(END_OF_LIFE_PRODUCT_CLASS)) {
                showElements([product]);
              }
            });
            return;
          }

          // Specific families
          const family = ev.currentTarget.dataset.family;
          console.log("addFamilyFilterClickHandler: family: " + family);
          if (family == null) {
            console.debug("addFamilyFilterClickHandler: No family found");
            return;
          }
          categoryProducts.forEach(function(product) {
            if (product.dataset.family === family
                && !product.classList.contains(END_OF_LIFE_PRODUCT_CLASS)) {
              showElements([product]);
            } else {
                hideElements([product]);
            }
          });
        });
      }
    }
  }

  /**
   * Makes a family active
   */
  function makeFamilyActive(family) {
    if (family == null) {
      console.debug("makeFamilyActive: No family found");
      return;
    }
    family.classList.remove(FAMILY_INACTIVE_CLASS);
    family.classList.add(FAMILY_ACTIVE_CLASS);
  }

  /**
   * Makes a family inactive
   */
  function makeFamilyInactive(family) {
    if (family == null) {
      console.debug("makeFamilyInactive: No family found");
      return;
    }
    family.classList.remove(FAMILY_ACTIVE_CLASS);
    family.classList.add(FAMILY_INACTIVE_CLASS);
  }

  /**
   * Adds event listeners to the product category expander
   */
  function addExpanderClickHandler() {
    const categoryExpander = document.querySelector("#categoryexpander");
    categoryExpander.addEventListener("click", function (e) {
      const categoryInputLabels = document.querySelectorAll(".categoryinputlabel");
      if (categoryInputLabels == null) {
        console.debug("addExpanderClickHandler: No category input labels found");
        return;
      }
      categoryInputLabels.forEach(function(label) { label.classList.remove("overnine"); });
      const categoryShrinker = document.querySelector("#categoryshrinker");
      if (categoryShrinker != null) {
        showElements([categoryShrinker]);
      }
      hideElements([e.target]);
    });
  }

  function addShrinkerClickHandler() {
    const categoryShrinker = document.querySelector("#categoryshrinker");
    categoryShrinker.addEventListener("click", function (e) {
      const categoryInputLabels = document.querySelectorAll(".categoryinputlabel");
      if (categoryInputLabels == null) {
        console.debug("addShrinkerClickHandler: No category input labels found");
        return;
      }
      categoryInputLabels.forEach(function(label) { label.classList.add("overnine"); });
      const categoryExpander = document.querySelector("#categoryexpander");
      if (categoryExpander != null) {
        showElements([categoryExpander]);
      }
      hideElements([e.target]);
    });
  }

  function addDropdownClickHandlers() {
    const dropdownSelected = document.querySelector("." + DROPDOWN_SELECTED_CLASS);
    const dropdownOptions = document.querySelector("." + DROPDOWN_OPTIONS_CLASS);
    if (dropdownSelected == null || dropdownOptions == null) {
      console.debug("addDropdownClickHandler: No dropdown selected found");
      return;
    }

    const onClickOutsideSelected = (e) => {
      const dropdownOptions = document.querySelector("." + DROPDOWN_OPTIONS_CLASS);
      if (!e.target.classList.contains(DROPDOWN_SELECTED_NAME_CLASS)
        && !e.target.classList.contains(DROPDOWN_SELECTED_FEATURED_CLASS)) {
        dropdownOptions.classList.add(PRODUCT_CHOOSER_HIDDEN_CLASS);
        window.removeEventListener("click", onClickOutsideSelected);
      }
    }

    dropdownSelected.addEventListener("click", function() {
      const dropdownOptions = document.querySelector("."+ DROPDOWN_OPTIONS_CLASS);
      if (dropdownOptions == null) {
        console.debug("addDropdownClickHandler: No dropdown options found");
        return;
      }
      console.log("Dropdown selected clicked");
      window.addEventListener("click", onClickOutsideSelected);
      dropdownOptions.classList.toggle(PRODUCT_CHOOSER_HIDDEN_CLASS);
    });

    for (const option of dropdownOptions.children) {
      option.addEventListener("click", function(ev) {
        const target = ev.target;
        try {
          const selected = document.querySelector("." + DROPDOWN_SELECTED_CLASS).querySelectorAll(":scope > input");
          for (const current of selected) {
            if (target.name === current.name) {
              current.classList.remove(PRODUCT_CHOOSER_HIDDEN_CLASS);
            } else {
                current.classList.add(PRODUCT_CHOOSER_HIDDEN_CLASS);
            }
          }

          if (target.name !== sortOrder) {
            switch (target.name) {
              case PRODUCT_SORT_TYPE.Featured:
                updateProductOrder(PRODUCT_SORT_TYPE.Featured);
                sortOrder = target.name;
                break;
              case PRODUCT_SORT_TYPE.Alphabetical:
              default:
                updateProductOrder(PRODUCT_SORT_TYPE.Alphabetical);
                sortOrder = target.name;
                break;
            }
          }
        } catch (e) {
          console.debug("addDropdownClickHandler: No selected dropdown found");
        }
      });
    }
  }

  function navigateAfterSetup() {
    const hash = window.location.hash;
    if (hash != null && hash.length > 0) {
      navigateToHash();
      return;
    }
    if (window.navigate_happened) {
      return;
    }
    window.navigate_happened = true;
    let searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has(CATEGORY_SEARCH_PARAM)
        && searchParams.has(FAMILY_SEARCH_PARAM)) {
      let category = searchParams.get(CATEGORY_SEARCH_PARAM).replaceAll("-","");
      document.querySelector("#category" + category + "div").querySelector("input").click();
      showCategoryFamilies(category);
      let familyId = "#" + PRODUCT_CHOOSER_CSS_BASE + category
          + "__family__" + searchParams.get(FAMILY_SEARCH_PARAM).replaceAll("-","");
      document.querySelector(familyId).click();
    }
  }

  /**
   * Selects and focuses on a category if provided in the url as a location
   * // TODO: Check if anywhere in code navigates to this page with a # and remove if not
   */
  function navigateToHash() {
    let hash = window.location.hash;
    if (hash) {
      let queryString = hash.indexOf("?");
      if (queryString > 0) {
        hash = hash.substring(0, queryString);
      }
      const expanderDiv = document.querySelector("#categoryexpanderdiv");
      if (expanderDiv == null) {
        console.debug("productChooser: No expander div found for has navigation");
      }
      expanderDiv.click();

      $('#categoryexpanderdiv').click();
      const categoryDiv = document.querySelector(hash);
      if (categoryDiv == null) {
        console.debug("productChooser: No category div found for hash navigation");
        return;
      }
      categoryDiv.click();
      // TODO: Is this really the desired behaviour, or should we navigate to the products?
      categoryDiv.focus();
    }
  }

  hideEmptyEndOfLifeFamilies();
  addCategoryTileClickHandler();
  addFamilyFilterClickHandler()
  addExpanderClickHandler();
  addShrinkerClickHandler();
  addDropdownClickHandlers();
  updateProductOrder(PRODUCT_SORT_TYPE.Alphabetical);
  navigateAfterSetup();
});


if( $('#portalAccessForm').length > 0) {
    $('#country').on('change', function () {
        var stateHook = document.getElementById("state-hook");
        var province = ["* " + Granite.I18n.get("Select Company State/Province") + "...", 'AB', 'BC', 'MB', 'NB', 'NF', 'NS', 'ON', 'PE', 'PQ', 'QC', 'SK'];
        var states= ["* " + Granite.I18n.get("Select Company State/Province") + "...", 'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VI', 'VT', 'WA', 'WI', 'WV', 'WY'];
        if ($(this).val() === "United States") {
            if(stateHook.childNodes[0]) {
                stateHook.removeChild(stateHook.childNodes[0]);
            }
            stateHook.appendChild(createStateSelect(states));
        } else if ($(this).val() === "Canada") {
            if(stateHook.childNodes[0]) {
                stateHook.removeChild(stateHook.childNodes[0]);
            }
            stateHook.appendChild(createStateSelect(province));
        } else {
            if (stateHook.childNodes[0]) {
                stateHook.removeChild(stateHook.childNodes[0]);
            }
            var stateInput = document.createElement("input");
            stateInput.id = "state";
            stateInput.name = "state";
            stateInput.type = "text";
            stateInput.placeholder = "* " + Granite.I18n.get("Company State/Province");
            stateHook.appendChild(stateInput);
        }
    });
    $().ready(function () {
        $('#portalAccessForm').validate({
            rules: {
                company: "required",
                street: "required",
                city: "required",
                zip: "required",
                country: "required",
                state: "required",
                first_name: "required",
                last_name: "required",
                '00N50000001puIX': "required",
                '00N50000002mKxi': "required",
                email: "required",
                phone: "required"
            },
            messages: {
                company: Granite.I18n.get("This field is required."),
                street: Granite.I18n.get("This field is required."),
                city: Granite.I18n.get("This field is required."),
                zip: Granite.I18n.get("This field is required."),
                country: Granite.I18n.get("This field is required."),
                state: Granite.I18n.get("This field is required."),
                first_name: Granite.I18n.get("This field is required."),
                last_name: Granite.I18n.get("This field is required."),
                '00N50000001puIX': Granite.I18n.get("This field is required."),
                '00N50000002mKxi': Granite.I18n.get("This field is required."),
                email: Granite.I18n.get("This field is required."),
                phone: Granite.I18n.get("This field is required.")
            },
            errorPlacement: function (error, element) {
                if (element.attr("name") == "company")
                    error.insertBefore("#company");
                else if (element.attr("name") == "street")
                    error.insertBefore("#street");
                else if (element.attr("name") == "city")
                    error.insertBefore("#city");
                else if (element.attr("name") == "zip")
                    error.insertBefore("#zip");
                else if (element.attr("name") == "country")
                    error.insertBefore("#country");
                else if (element.attr("name") == "state")
                    error.insertBefore("#state");
                else if (element.attr("name") == "first_name")
                    error.insertBefore("#first_name");
                else if (element.attr("name") == "last_name")
                    error.insertBefore("#last_name");
                else if (element.attr("id") == "job_role")
                    error.insertBefore("#job_role");
                else if (element.attr("id") == "job_function")
                    error.insertBefore("#job_function");
                else if (element.attr("name") == "email")
                    error.insertBefore("#email");
                else if (element.attr("name") == "phone")
                    error.insertBefore("#phone");
            }
        });
    });
}
if( $('#pppRegistrationForm').length > 0) {

    $('#country').on('change', function () {
        var sales_emphasis = $('#sales_emphasis').val();
        var stateHook = document.getElementById("state-hook");
        var province = ["* " + Granite.I18n.get("Select Company State/Province") + "...", 'AB', 'BC', 'MB', 'NB', 'NF', 'NS', 'ON', 'PE', 'PQ', 'QC', 'SK'];
        var states= ["* " + Granite.I18n.get("Select Company State/Province") + "...", 'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VI', 'VT', 'WA', 'WI', 'WV', 'WY'];
        if ($(this).val() === "United States") {
            if(stateHook.childNodes[0]) {
                stateHook.removeChild(stateHook.childNodes[0]);
            }
            stateHook.appendChild(createStateSelect(states));
            if(sales_emphasis === "B2C") {
                $('#b2cModal').foundation('open');
                $('#register_submit').prop('disabled', true);
            } else {
                $('#register_submit').prop('disabled', false);
            }
        } else if ($(this).val() === "Canada") {
            if(stateHook.childNodes[0]) {
                stateHook.removeChild(stateHook.childNodes[0]);
            }
            stateHook.appendChild(createStateSelect(province));
            if(sales_emphasis === "B2C") {
                $('#b2cModal').foundation('open');
                $('#register_submit').prop('disabled', true);
            } else {
                $('#register_submit').prop('disabled', false);
            }
        } else if ($(this).val() === "Puerto Rico" && sales_emphasis === "B2C") {
            $('#b2cModal').foundation('open');
            $('#register_submit').prop('disabled', true);
        } else {
            if(stateHook.childNodes[0]) {
                stateHook.removeChild(stateHook.childNodes[0]);
            }
            $('#register_submit').prop('disabled', false);
            var stateInput = document.createElement("input");
            stateInput.id = "state";
            stateInput.name = "state";
            stateInput.type = "text";
            stateInput.placeholder = "* " + Granite.I18n.get("Company State/Province");
            stateHook.appendChild(stateInput);
        }
    });

    $('#partner_terms').on('change', function () {
        if ($(this).is(":checked")) {
            $('#sfdc_form_info').show();
        } else {
            $('#sfdc_form_info').hide();
        }
    });

    $('#sales_emphasis').on('change', function () {
        var country = $('#country').val();
        if($(this).val() === "B2C" && (country === "United States" || country === "Canada" || country === "Puerto Rico")) {
            $('#b2cModal').foundation('open');
            $('#register_submit').prop('disabled', true);
        } else {
            $('#register_submit').prop('disabled', false);
        }
    });

    $().ready(function () {
        $('#pppRegistrationForm').validate({
            rules: {
                '00N38000003IUVA': "required",
                '00N38000003IUV9': "required",
                company: "required",
                street: "required",
                city: "required",
                zip: "required",
                country: "required",
                state: "required",
                URL: "required",
                '00N50000002omX4': "required",
                first_name: "required",
                last_name: "required",
                '00N50000001puIX': "required",
                '00N50000002mKxi': "required",
                email: "required",
                phone: "required"
            },
            messages: {
                '00N38000003IUVA': Granite.I18n.get("This field is required."),
                '00N38000003IUV9': Granite.I18n.get("This field is required."),
                company: Granite.I18n.get("This field is required."),
                street: Granite.I18n.get("This field is required."),
                city: Granite.I18n.get("This field is required."),
                zip: Granite.I18n.get("This field is required."),
                country: Granite.I18n.get("This field is required."),
                state: Granite.I18n.get("This field is required."),
                URL: Granite.I18n.get("This field is required."),
                '00N50000002omX4': Granite.I18n.get("This field is required."),
                first_name: Granite.I18n.get("This field is required."),
                last_name: Granite.I18n.get("This field is required."),
                '00N50000001puIX': Granite.I18n.get("This field is required."),
                '00N50000002mKxi': Granite.I18n.get("This field is required."),
                email: Granite.I18n.get("This field is required."),
                phone: Granite.I18n.get("This field is required.")
            },
            errorPlacement: function (error, element) {
                if (element.attr("name") == "company")
                    error.insertBefore("#company");
                else if (element.attr("id") == "authorized_user")
                    error.insertBefore("#authorized_user");
                else if (element.attr("name") == "street")
                    error.insertBefore("#street");
                else if (element.attr("name") == "city")
                    error.insertBefore("#city");
                else if (element.attr("name") == "zip")
                    error.insertBefore("#zip");
                else if (element.attr("name") == "country")
                    error.insertBefore("#country");
                else if (element.attr("name") == "state")
                    error.insertBefore("#state");
                else if (element.attr("name") == "URL")
                    error.insertBefore("#url");
                else if (element.attr("id") == "sales_emphasis")
                    error.insertBefore("#sales_emphasis");
                else if (element.attr("name") == "first_name")
                    error.insertBefore("#first_name");
                else if (element.attr("name") == "last_name")
                    error.insertBefore("#last_name");
                else if (element.attr("id") == "job_role")
                    error.insertBefore("#job_role");
                else if (element.attr("id") == "job_function")
                    error.insertBefore("#job_function");
                else if (element.attr("name") == "email")
                    error.insertBefore("#email");
                else if (element.attr("name") == "phone")
                    error.insertBefore("#phone");
            }
        });
    });
}

function createStateSelect(stateProvArr) {
    var selectList = document.createElement("select");
    selectList.id = "state";
    selectList.name= "state";
    for (var i = 0; i < stateProvArr.length; i++) {
        var option = document.createElement("option");
        if(i == 0) {
            option.value = "";
        } else {
            option.value = stateProvArr[i];
        }
        option.text = stateProvArr[i];
        selectList.appendChild(option);
    }
    return selectList;
}
/*******************************************************************************
 * Copyright 2016 Adobe Systems Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
var CQ = CQ || {};
CQ.WCM = CQ.WCM || {};

CQ.WCM.List = CQ.WCM.List || function () {
    "use strict";

    var self = {};

    var currentState = null;

    var _extractObject = function(queryString) {
        var params = queryString.split("&");
        var paramObj = {

        };

        for (var idx = 0 ; idx < params.length ; idx++) {
            var param = params[idx];
            var paramInfo = param.split("=");
            if (paramInfo.length >= 2) {
                paramObj[paramInfo[0]] = paramInfo[1];
            }
        }

        return paramObj;
    }

    var _combineQueryStrings = function(queryString1, queryString2) {
        var paramObj1 = _extractObject(queryString1);
        var paramObj2 = _extractObject(queryString2);

        for (var param in paramObj2) {
            paramObj1[param] = paramObj2[param];
        }

        var combinedQueryString = "";

        for (var param in paramObj1) {
            if (combinedQueryString != "") {
                combinedQueryString += "&";
            }
            combinedQueryString += param + "=" + paramObj1[param];
        }

        return combinedQueryString;
    };

    self.linkClick = function(element, listId) {
        var goToLink = element.href;

        var urlRegex = /https?:\/\/[^\\/]*(.*)/gi;
        var matches = urlRegex.exec(goToLink);
        var queryString = "";

        if (matches
            && matches.length > 0) {
            var linkPath = matches[1];
            var queryIdx = linkPath.indexOf("?");
            if (queryIdx >= 0) {
                queryString = linkPath.substring(queryIdx + 1);
            }
        }

        // do XHR to load list
        var  xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState == 4
                && xhr.status == 200
                && xhr.responseText != "") {
                var targetList = document.getElementById(listId);
                if (targetList) {

                    if (!window.history.state) {
                        window.history.replaceState({
                            listId: listId,
                            content: targetList.outerHTML
                        }, null, window.location.href);
                    }

                    if (currentState
                            && currentState.listId != listId) {
                        currentState["extraListId"] = listId;
                        currentState["extraContent"] = targetList.outerHTML;
                        window.history.replaceState(currentState, null, window.location.href);
                    }

                    targetList.outerHTML = xhr.responseText;

                    // focus first item of the new list
                    var newTargetList = document.getElementById(listId);
                    var firstListItem = newTargetList.getElementsByTagName("li")[0];
                    var anchors = firstListItem.getElementsByTagName("a");
                    if (anchors.length === 0) {
                        // fall back: no anchor in first list item; focus li itself
                        firstListItem.setAttribute("tabindex", "0");
                        firstListItem.focus();
                    } else {
                        // default: select anchor in first list item
                        anchors[0].focus();
                    }

                    var stateContent = xhr.responseText;
                    var currentUrl = window.location.href;
                    var currentQueryString = "";
                    var queryIdx = currentUrl.indexOf("?");
                    if (queryIdx >= 0) {
                        currentQueryString = currentUrl.substring(queryIdx + 1);
                        currentUrl = currentUrl.substring(0, queryIdx);
                    }

                    var useQueryString = _combineQueryStrings(currentQueryString, queryString);

                    currentState = {
                        listId: listId,
                        content: stateContent
                    };

                    window.history.pushState(currentState, null, currentUrl + "?" + useQueryString);
                }
            }
        }
        xhr.open("GET", goToLink, true);
        xhr.send();

        return false;
    };

    var _updateList = function (listId, content) {
        var targetList = document.getElementById(listId);
        if (targetList) {
            targetList.outerHTML = content;
        }
    }

    self.handlePopStateListNavigation = function(event) {
        if (event.state) {
            _updateList(event.state.listId, event.state.content);

            if (event.state.extraListId) {
                _updateList(event.state.extraListId, event.state.extraContent);
            }
        }
    };

    self.bindHistoryPopStateEvent = function() {
        if (window.addEventListener) {
            window.addEventListener("popstate", CQ.WCM.List.handlePopStateListNavigation);
        } else if (window.attachEvent) {
            window.attachEvent("popstate", CQ.WCM.List.handlePopStateListNavigation);
        }
    };

    return self;
}();

CQ.WCM.List.bindHistoryPopStateEvent();

$(window).resize(function(){
    if(typeof Foundation != 'undefined' && Foundation.MediaQuery.current == 'small'){
        $("ul.menu > div").has("link[title='Atom 1.0 (List)']").each(function(){
            if($(this)){
               var inner = $(this).html();
               $(this).replaceWith(inner);
               }
        })
    }
}).resize();
$(document).ready(function(){
	$('.btn-contact-sales').on("click", function(e){
		if(digitalData != undefined && digitalData.hasOwnProperty('site')) {
            if(digitalData.site.hasOwnProperty('countryCode') && digitalData.site.hasOwnProperty('languageCode')) {
				let locationURL = "https://www.poly.com/"+digitalData.site.countryCode+"/"+digitalData.site.languageCode+"/company/contact/sales";
                location.href = locationURL;
			}
        }
	});
});

$(document).ready(function() {
  if (Granite && Granite.I18n) {
    Granite.I18n.setLocale(window.locale);
  }

  $("#newsletterButton").on(
          "click",
          function(event) {
            event.preventDefault();

            var email = $('#signupEmail').val();
            if (validateEmail(email)) {
              $("#email").val(email);
              getSelectOptions('/inc/snips/select-options-countries.html', '#exclusive-offer-country');
              $('#modalNewsletter').modal('show');
            } else {
              alert(Granite.I18n.get("Please enter a valid email address."));
            }
          }
  );

  $('#exclusive-offer-country').change(
          function(e) {
            e.preventDefault();
            if (!$(this).val()) {
              alert(Granite.I18n.get("Select your country"));
            }
            return false;
          });

  $('#submitCountry').on(
          "click",
          function(event) {
            event.preventDefault();
            var email = $('#email').val();
            if ($('#exclusive-offer-country').val()) {
              $.ajax({
                type: "POST",
                url: getServletPath(".exclusive-offers.json"),
                dataType: "text",
                data: $("#formSignUp").serialize(),
                success: function(data, textStatus, jqXHR) {
                  var $modal = $("#modalNewsletterGuts");

                  $modal.find('.modal-title').html(Granite.I18n.get('Thank you')).css('text-transform', 'none');
                  $modal.find('.modal-body').html(`<p>${Granite.I18n.get('We received your information')}</p><button data-dismiss="modal" aria-label="Close" class="btn btn-close">${Granite.I18n.get('Close Window')}</button>`);
                },

              });
            } else {
              alert(Granite.I18n.get("Select your country"));
              event.preventDefault();
            }

            return false;
          })

  function validateEmail($email) {
    var emailReg = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if ($email) {
      return emailReg.test($email);
    }

  }
  function getServletPath(servletPath){
    let url = document.location.href;
    let retUrl = "";
    //ends with slash
    if(url.endsWith("/")){
      retUrl = url.slice(0, retUrl.length - 2) + servletPath;
    }else if((url.indexOf("author") != -1) || (url.indexOf("localhost") != -1)){//is author env
      retUrl = url.substring(0, location.href.lastIndexOf('.')) + servletPath;
    }else if(url.indexOf("?") != -1){//contains parameters
      retUrl = url.substring(0, url.indexOf("?")) + servletPath;
    }else{//default
      retUrl = url + servletPath;
    }
    return retUrl;
  }

  function getSelectOptions(url, target) {
    var xml = ' <option value="AF">Afghanistan</option><option value="AL">Albania</option><option value="DZ">Algeria</option><option value="AD">Andorra</option><option value="AO">Angola</option><option value="AI">Anguilla</option><option value="AQ">Antarctica</option><option value="AG">Antigua and Barbuda</option><option value="AR">Argentina</option><option value="AM">Armenia</option><option value="AW">Aruba</option><option value="AU">Australia</option><option value="AT">Austria</option><option value="AZ">Azerbaijan</option><option value="BS">Bahamas</option><option value="BH">Bahrain</option><option value="BD">Bangladesh</option><option value="BB">Barbados</option><option value="BY">Belarus</option><option value="BE">Belgium</option><option value="BZ">Belize</option><option value="BJ">Benin</option><option value="BM">Bermuda</option><option value="BT">Bhutan</option><option value="BO">Bolivia</option><option value="BA">Bosnia-Herzegovina</option><option value="BW">Botswana</option><option value="BV">Bouvet Island</option><option value="BR">Brazil</option><option value="IO">British Indian Ocean Ter</option><option value="BN">Brunei Darussalam</option><option value="BG">Bulgaria</option><option value="BF">Burkina Faso</option><option value="BI">Burundi</option><option value="KH">Cambodia</option><option value="CM">Cameroon</option><option value="CA">Canada</option><option value="CV">Cape Verde</option><option value="KY">Cayman Islands</option><option value="CF">Central African Republic</option><option value="TD">Chad</option><option value="CL">Chile</option><option value="CN">China</option><option value="CX">Christmas Island</option><option value="CC">Cocos Islands</option><option value="CO">Colombia</option><option value="KM">Comoros</option><option value="CG">Congo</option><option value="CK">Cook Islands</option><option value="CR">Costa Rica</option><option value="CI">Cote D"Ivoire</option><option value="HR">Croatia</option><option value="CU">Cuba</option><option value="CY">Cyprus</option><option value="CZ">Czech Republic</option><option value="DK">Denmark</option><option value="DJ">Djibouti</option><option value="DM">Dominica</option><option value="DO">Dominican Republic</option><option value="TP">East Timor</option><option value="EC">Ecuador</option><option value="EG">Egypt</option><option value="SV">El Salvador</option><option value="GQ">Equatorial Guinea</option><option value="EE">Estonia</option><option value="ET">Ethiopia</option><option value="FO">Faeroe Islands</option><option value="FK">Falkland Islands</option><option value="FJ">Fiji</option><option value="FI">Finland</option><option value="FR">France</option><option value="GF">French Guiana</option><option value="PF">French Polynesia</option><option value="TF">French Southern Ter</option><option value="GA">Gabon</option><option value="GM">Gambia</option><option value="GE">Georgia</option><option value="DE">Germany</option><option value="GH">Ghana</option><option value="GI">Gibraltar</option><option value="GR">Greece</option><option value="GL">Greenland</option><option value="GD">Grenada</option><option value="GP">Guadeloupe</option><option value="GT">Guatemala</option><option value="GG">Guernsey, C.I.</option><option value="GN">Guinea</option><option value="GW">Guinea-Bissau</option><option value="GY">Guyana</option><option value="HT">Haiti</option><option value="HM">Heard &amp; McDonald Isls</option><option value="HN">Honduras</option><option value="HK">Hong Kong</option><option value="HU">Hungary</option><option value="IS">Iceland</option><option value="IN">India</option><option value="ID">Indonesia</option><option value="IR">Iran</option><option value="IQ">Iraq</option><option value="IE">Ireland</option><option value="IM">Isle of Man</option><option value="IL">Israel</option><option value="IT">Italy</option><option value="JM">Jamaica</option><option value="JP">Japan</option><option value="JE">Jersey, C.I.</option><option value="JO">Jordan</option><option value="KZ">Kazakhstan</option><option value="KE">Kenya</option><option value="KI">Kiribati</option><option value="KW">Kuwait</option><option value="KG">Kyrgyzstan</option><option value="LA">Laos</option><option value="LV">Latvia</option><option value="LB">Lebanon</option><option value="LS">Lesotho</option><option value="LR">Liberia</option><option value="LY">Libya</option><option value="LI">Liechtenstein</option><option value="LT">Lithuania</option><option value="LU">Luxembourg</option><option value="MO">Macau</option><option value="MG">Madagascar</option><option value="MW">Malawi</option><option value="MY">Malaysia</option><option value="MV">Maldives</option><option value="ML">Mali</option><option value="MT">Malta</option><option value="MH">Marshall Islands</option><option value="MQ">Martinique</option><option value="MR">Mauritania</option><option value="MU">Mauritius</option><option value="MX">Mexico</option><option value="FM">Micronesia</option><option value="MD">Moldova</option><option value="MC">Monaco</option><option value="MN">Mongolia</option><option value="MS">Montserrat</option><option value="MA">Morocco</option><option value="MZ">Mozambique</option><option value="MM">Myanmar</option><option value="NA">Namibia</option><option value="NR">Nauru</option><option value="NP">Nepal</option><option value="AN">Netherland Antilles</option><option value="NL">Netherlands</option><option value="NT">Neutral Zone (Saudi/Iraq)</option><option value="NC">New Caledonia</option><option value="NZ">New Zealand</option><option value="NI">Nicaragua</option><option value="NE">Niger</option><option value="NG">Nigeria</option><option value="NU">Niue</option><option value="NF">Norfolk Island</option><option value="KP">North Korea</option><option value="MP">Northern Mariana Isls</option><option value="NO">Norway</option><option value="OM">Oman</option><option value="PK">Pakistan</option><option value="PW">Palau</option><option value="PA">Panama</option><option value="PZ">Panama Canal Zone</option><option value="PG">Papua New Guinea</option><option value="PY">Paraguay</option><option value="PE">Peru</option><option value="PH">Philippines</option><option value="PN">Pitcairn</option><option value="PL">Poland</option><option value="PT">Portugal</option><option value="PR">Puerto Rico</option><option value="QA">Qatar</option><option value="RE">Reunion</option><option value="RO">Romania</option><option value="RU">Russia</option><option value="RW">Rwanda</option><option value="KN">Saint Kitts &amp; Nevis</option><option value="LC">Saint Lucia</option><option value="WS">Samoa</option><option value="SM">San Marino</option><option value="ST">Sao Tome &amp; Principe</option><option value="SA">Saudi Arabia</option><option value="SN">Senegal</option><option value="SC">Seychelles</option><option value="SL">Sierra Leone</option><option value="SG">Singapore</option><option value="SK">Slovakia</option><option value="SI">Slovenia</option><option value="SB">Solomon Islands</option><option value="SO">Somalia</option><option value="ZA">South Africa</option><option value="KR">South Korea</option><option value="ES">Spain</option><option value="LK">Sri Lanka</option><option value="SH">St. Helena</option><option value="PM">St. Pierre &amp; Miquelon</option><option value="VC">St. Vincent &amp; Grenadines</option><option value="SD">Sudan</option><option value="SR">Suriname</option><option value="SJ">Svalbard &amp; Jan Mayen Isls</option><option value="SZ">Swaziland</option><option value="SE">Sweden</option><option value="CH">Switzerland</option><option value="SY">Syria</option><option value="TW">Taiwan</option><option value="TJ">Tajikistan</option><option value="TZ">Tanzania</option><option value="TH">Thailand</option><option value="TG">Togo</option><option value="TK">Tokelau</option><option value="TO">Tonga</option><option value="TT">Trinidad and Tobago</option><option value="TN">Tunisia</option><option value="TR">Turkey</option><option value="TM">Turkmenistan</option><option value="TC">Turks &amp; Caicos Isls</option><option value="TV">Tuvalu</option><option value="UM">U.S.Minor Outlying Isls</option><option value="UG">Uganda</option><option value="UA">Ukraine</option><option value="AE">United Arab Emirates</option><option value="UK">United Kingdom</option><option value="US">United States</option><option value="UY">Uruguay</option><option value="UZ">Uzbekistan</option><option value="VU">Vanuatu</option><option value="VA">Vatican City State</option><option value="VE">Venezuela</option><option value="VN">Vietnam</option><option value="VG">Virgin Islands</option><option value="WF">Wallis &amp; Futuna Isls</option><option value="EH">Western Sahara</option><option value="YE">Yemen</option><option value="YU">Yugoslavia</option><option value="ZR">Zaire</option><option value="ZM">Zambia</option><option value="ZW">Zimbabwe</option>';
    $(target).append(xml);
    $(target).val("US");
    $(target).trigger('change');
  }

});
$('.emailValidate').click(function() {
	let failure = function(err) {
		console.log("Unable to retrive data "+err);
	};
	let spinner = "<span class=\"spinner-border spinner-border-md\" role=\"status\" aria-hidden=\"true\"></span>";
	$(this).prepend(spinner);
	//Get the user-defined values
	let email= $('#emailEpp').val();
	//Use JQuery AJAX request to post data to a Sling Servlet
	$.ajax({
		 type: 'POST',
		 url: getPath(".epp.json"),
		 data: 'email=' + email,
		 dataType: "json",
		 success: function(result){
			if(result.status == "success"){
				$("#epp").hide();
				$("#success").show();
			}else{
				$("#epp").hide();
				$("#alternative").show();
			}
			 $('.spinner-border').remove();
		 },
		 error: function(result) {
			console.log("Error with email domain");
			$("#epp").hide();
			$("#alternative").show();
			$('.emailValidate').removeClass('submit-button-processing');
		 }
	});
});

function getPath(servletPath){
	let url = document.location.href;
	let retUrl = "";
	//ends with slash
	if(url.endsWith("/")){
		retUrl = url.slice(0, retUrl.length - 2) + servletPath;
	}else if((url.indexOf("author") != -1) || (url.indexOf("localhost") != -1)){//is author env
		retUrl = url.substring(0, location.href.lastIndexOf('.')) + servletPath;
	}else if(url.indexOf("?") != -1){//contains parameters
		retUrl = url.substring(0, url.indexOf("?")) + servletPath;
	}else{//default
		retUrl = url + servletPath;
	}
	return retUrl;
}
	$( document ).ready(function() {
		if (("#shopping").length >0) {
			let x = $("#shopping").attr("data-x");
			let y = $("#shopping").attr("data-y");
			let marketingId;
			let storeId;
			let successUrl;
			let emaildomain;
			if(x === undefined || y === undefined){
				$("#message").show();
				return;
			}
		 	$.ajax({
		 		type: 'GET',
				url:getPath(".epp.json") + '?x=' + x + '&y=' + y + '&langloc=',
		 		success: function(result){
					if(result == "false"){
						$("#message").show();
					}else{
						marketingId = result.marketingid;
						storeId = result.storeid;
						successUrl = result.successurl;
						emaildomain = result.emaildomain;
						$("#shopping").show();
					}
				}
	     });
	     $('#shopping').on("click", function(){
			 	if(Cookies.get("limitedAccess") == null){
				 	getLAT();
				}
				let token = Cookies.get("limitedAccess");
			 	checkToken(token);
	     	$.ajax({
	     		type: 'GET',
					dataType: 'text',
	     		url: getPath(".privateStore.json") + '?storeid=' + storeId + '&emaildomain=' + emaildomain + '&marketingid=' + marketingId + '&successurl=' + successUrl + '&limitedToken=' + Cookies.get("limitedAccess"),
	     		success: function(result){
	     			window.location = successUrl;
	     		},
					error: function(jqXHR, exception) {
						console.log("Error in private store");
						console.log(jqXHR.status);
						console.log(exception);
					}
				});
		 	});
	 	}
	});

	function getPath(servletPath){
		let url = document.location.href;
		let retUrl = "";
		//ends with slash
		if(url.endsWith("/")){
			retUrl = url.slice(0, retUrl.length - 2) + servletPath;
		}else if((url.indexOf("author") != -1) || (url.indexOf("localhost") != -1)){//is author env
			retUrl = url.substring(0, location.href.lastIndexOf('.')) + servletPath;
		}else if(url.indexOf("?") != -1){//contains parameters
			retUrl = url.substring(0, url.indexOf("?")) + servletPath;
		}else{//default
			retUrl = url + servletPath;
		}
		return retUrl;
	}
(function($) {
    "use strict";

    var hasRequestCountryLanguageServlet = false;
    $("#regionPickerModal").on("show.bs.modal", function(e) {

        if (hasRequestCountryLanguageServlet) {
            return;
        }
        $(this).find(".modal-body").css('visibility', 'hidden');//make it occupy space

        //we may need loading animation for most ajax requests, this could be considered to be a global feature later.
        var servletPath;
		$('meta').each(function(){
			var el = $(this);
			if(el.attr('property')==='og:url'){
				servletPath=new URL(el.attr('content')).pathname
			}
		});
        if(servletPath.split('/').pop().indexOf(".")>0){
            servletPath = servletPath.substring(0, servletPath.lastIndexOf('.'));
        }
        $.getJSON(servletPath + '.country-language-selector.json', { pageUrl: location.pathname }).then(data => {


            var regionToHtml = region => {
                return `
              <div class="region-section">
                <h6>${region.regionType}</h5>
                <hr/>
                <ul class="list-unstyled">
                    ${region.countries.map(country=>countryToHtml(country)).join('\n')}
                </ul>
              </div>`
            };

            var countryToHtml = (country) => {
                return country.languages.map(language => languageToHtml(language, country)).join('\n');
            };

            var languageToHtml = (language, country) => {
                return `
                    <li>
                        <a href="${language.path}">
                            <span>${country.countryName}</span>
                            <span>(${language.name})</span>
                        </a>
                    </li>
                `;
            };

            $(this).find(".modal-body").css('visibility', 'visible').html(data.regions.map(regionToHtml).join('\n'));
            hasRequestCountryLanguageServlet = true;

        });

    });

}(jQuery));

let prodBaseUrl = "https://api.digitalriver.com/v1/shoppers/";
let cteBaseUrl = "https://api-cte-ext.digitalriver.com/v1/shoppers/";
let sessionUrlDev = "https://drhadmin-cte.digitalriver.com/store/plt/SessionToken";
let sessionUrlProd = "https://shop.poly.com/store/plt/SessionToken";
let baseUrl =" ";
let sessionUrl = " ";
let locale;
let offerChecked = false;
let pstore= false;
let errorCheck = 0;

$(document).ready(function() {
    dataLayer.push({
        event: 'e_pageView'
    });
    /* Since no more commerce no need to make any commerce related calls
    locale = getLocale();
    if(locale){
        checkLocale();
        baseUrl = isProduction() ? prodBaseUrl : cteBaseUrl;
        sessionUrl = isProduction() ? sessionUrlProd : sessionUrlDev;
        if( Cookies.get("sessionToken") == null){
            getSessionToken();
        }else{
            getLAT();
        }
        if($('div.commerce').length){
            categorySaleCheck();
        }
        if(Cookies.get("numberOfItems") != null && Cookies.get("numberOfItems") > 0){
            updateCartIcon(Cookies.get("numberOfItems"));
        }
        $('.dr-add-to-cart').on("click", function(){
            $(this).prop('disabled', true);
            let spinner = "<span class=\"spinner-border spinner-border-md\" role=\"status\" aria-hidden=\"true\"></span>";
            $(this).prepend(spinner);
            let partNumber = $(this).attr("data-pn");
            addToCart(partNumber);
        });

        $('.icon-cart').on("click", function(){
            openCart();
        });

        $('#guestCheckout').on("click", function(){
            guestCheckout();
        });

        $('#signIn').on("click", function(){
            checkout();
        });
        checkForSalePrice();
        $('.btn-buy-now, .btn-cat-buy-now').on("click", function () {
            if(!offerChecked){
                checkForSalePrice();
            }
        });
        $('#header-cart').on('hidden.bs.collapse', function () {
            $('#primary-navigation').collapse('hide');
        })
        if((Cookies.get('pStoreByUrl') != null)){
            pstore = true;
            privateStoreByUrl();
        }
    }
    */
});

function checkForSalePrice(){
    if(errorCheck > 5){
        return;
    }
    if(!$('div.buy-now-container').length){
        return;
    }

    $('.models').each(function(){
        let partNumber = $(this).attr("data-pn");
        let model = $(this);
        if (partNumber != undefined && partNumber !=null) {

            $.ajax({
                url: baseUrl + 'me/products?externalReferenceId=' + partNumber + '&format=json&expand=all&token=' + getLAT(),
                dataType: 'jsonp',
                success: function(result){
                        let stockLevel;
                        if(result.products != undefined && result.products.product != undefined){
                            stockLevel = result.products.product[0].inventoryStatus.availableQuantity;
                        }else{ //fallback, shouldn't change behavior
                            stockLevel = 100;
                        }
                        // set stock level
                        model.attr("data-stock", stockLevel);
                        //less than one mark as non purchasable
                        if (stockLevel < 1) {
                            model.attr("data-purchasable", "false");
                        }
                        //single item
                        if ($("#buy-now-addtocart").hasClass("single-model")) {
                            //show message
                            if (stockLevel < 5 && stockLevel > 0) {
                                $("#stockArea").show();
                                $("#stockNumber").text("");
                                $("#stockNumber").text(stockLevel);
                            } else if (stockLevel < 1) { //hide atc and show contact sales
                                $("#buy-now-addtocart").hide();
                                $("#buy-contact-modal").show();
                                $(".product-cart-details #no-stock-msg").show();
                            } else { //fallback to hide messaging
                                $("#stockArea").hide();
                            }
                        }

                },
                error: function(xhr, status, error){
                    console.log("product error : " + error);
                }
            });
        }
    });

    offerChecked = true;

    // $('.price').each(function(){
    //     let partNumber = $(this).attr("data-pn");
    //     let model = $(this);
    //     if (partNumber != undefined && partNumber !=null) {
    //         $.ajax({
    //             url: baseUrl + 'me/products?externalReferenceId=' + partNumber + '&format=json&token=' + getLAT(),
    //             dataType: 'jsonp',
    //             success: function(result){
    //                 if(result.hasOwnProperty("errors")){
    //                     errorCheck = errorCheck + 1;
    //                     if(errorCheck > 5){
    //                         return;
    //                     }
    //                     console.log("token error in offer check");
    //                     clearCookies();
    //                     getSessionToken();
    //                     checkForSalePrice();
    //                     return;
    //                 }
    //             },
    //             error: function(xhr, status, error){
    //                 console.log("product error : " + error);
    //             }
    //         });
    //     }
    // });
    // offerChecked = true;
}


function clearCookies(){
    deleteCookie('locale');
    deleteCookie('sessionToken');
    deleteCookie('limitedAccess');
    deleteCookie('numOfProduct');
}

function categorySaleCheck(){
    let partList = [];
    //get all part numbers on page no dupes
    $('.price-cart').each(function(){
        let lastPN = $(this).find('.price').last().attr("data-pn");
        $(this).find('.price').each(function(index, element){
            let partNumber = $(this).attr("data-pn");
            if(partList.includes(partNumber) === false){
                partList.push(partNumber);
            }
        });
    });
    //dr api calls limited to 50 so chunk up number
    let chunkNumber = Math.ceil(partList.length/45);
    let arraySet = [0];
    for(let i = 1; i <= chunkNumber; i++){
        if( (i*45) < partList.length){
            arraySet.push(i*45);
        }else{
            arraySet.push(partList.length);
        }
    }
    if(partList.length > 0){
        for( let i = 0;i<chunkNumber;i++) {
            let tempArray = partList.slice(arraySet[i], arraySet[i+1]);
            $.ajax({
                url: baseUrl + 'me/products?externalReferenceId=' + tempArray.join(",") + '&format=json&expand=all&token=' + getLAT(),
                dataType: 'jsonp',
                success: function (result) {
                    let saleModels = {};
                    if(result.products != undefined && result.products.product != undefined){
                        for(let i = 0; i < result.products.product.length; i++){
                            if(result.products.product[i].pricing != undefined && result.products.product[i].pricing.formattedListPrice != undefined && result.products.product[i].pricing.formattedSalePriceWithQuantity != undefined) {
                                if(result.products.product[i].pricing.formattedListPrice !== result.products.product[i].pricing.formattedSalePriceWithQuantity){
                                    saleModels[result.products.product[i].externalReferenceId] = result.products.product[i].pricing.formattedSalePriceWithQuantity;
                                }
                            }
                        }
                    }
                    $('.price-cart').each(function(){
                        $(this).find('.price').each(function(index, element){
                            let partNumber = $(this).attr("data-pn");
                            let salePrice;
                            let catId;
                            if(saleModels[partNumber]){
                                salePrice = saleModels[partNumber];
                                catId = $(this).children('.base-price').attr('class').split(' ')[1];
                                //update modal
                                if( !$(this).children('.base-price').hasClass('prevPrice') ){ //not already updated
                                    $(this).append('<span class="salePrice">' + saleModels[partNumber] + '</span>');
                                    $(this).children('.base-price').addClass('prevPrice');
                                }
                                //update product card
                                $('.display-price' ).each(function(){
                                    if( $(this).hasClass(catId)){
                                        let pagePrice = $(this).get(0);
                                        let normalizePagePrice = pagePrice.innerHTML.replace(/[^0-9.]/g, "");
                                        let normalizeSalePrice = salePrice.replace(/[^0-9.]/g, "");
                                        if(parseFloat(normalizeSalePrice) < parseFloat(normalizePagePrice )){
                                            //already had a sale price added
                                            if( $(this).next().hasClass('catSalePrice')){
                                                let csp = $(this).next().get(0);
                                                let normalizeCurrentPrice = csp.innerHTML.replace(/[^0-9.]/g, "");
                                                //check if new sale price is lower
                                                if(parseFloat(normalizeSalePrice) < parseFloat(normalizeCurrentPrice )){
                                                    csp.innerHTML = "";
                                                    csp.innerHTML = salePrice;
                                                }
                                            //first sale price
                                            }else{
                                                pagePrice.outerHTML = '<span class="display-price prevPrice ' + catId + '" >'+ pagePrice.innerHTML + '</span><span class="catSalePrice"> ' + salePrice + '</span>';
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    });
                },
                error: function (xhr, status, error) {
                    console.log("product error : " + error);
                }
            });
        }
    }
}

function getServletPath(servletPath){
    let url = document.location.href;
    let retUrl = "";
    //ends with slash
    if(url.endsWith("/")){
        retUrl = url.slice(0, retUrl.length - 2) + servletPath;
    }else if((url.indexOf("author") != -1) || (url.indexOf("localhost") != -1)){//is author env
        retUrl = url.substring(0, location.href.lastIndexOf('.')) + servletPath;
    }else if(url.indexOf("?") != -1){//contains parameters
        retUrl = url.substring(0, url.indexOf("?")) + servletPath;
    }else{//default
        let tempArr = url.split("/").slice(0, 5);
        url = tempArr.join("/");
        retUrl = url + servletPath;
    }
    return retUrl;
}

function deleteCookie(name) {
    Cookies.remove(name, {path: '/'});
}

function isProduction(){
    var currUrl = document.location.href;
    if( (currUrl.indexOf("localhost") != -1) || (currUrl.indexOf("dev.poly") != -1 ) || (currUrl.indexOf("dev-author") != -1 )) {
        return false;
    }else{
        return true;
    }
}

function checkout(){
    var lang = getLocale();
    //required for salesForce mapping of parameters
    if(lang.indexOf("en_") != -1 ) {
        lang = "en-US";
    }else if(lang.indexOf("fr_") != -1) {
        lang = "fr-FR";
    }else{
        lang = lang.replace("_", "-");
    }

    if(isProduction()){
        window.open("https://myaccount.plantronics.com/MyAccountDRLink?token=" + getLAT() + "&lang=" + lang, "_self");
    }else{
        window.open("https://gsadev-plantronics.cs60.force.com/myaccount/apex/MyAccountDRLink?token=" + getLAT() + "&lang=" + lang, "_self");
    }
}

function guestCheckout(){
    window.open(baseUrl + '/me/carts/active/web-checkout?token=' + getLAT(), "_self" );
}

function deleteItem(productId){
    $.ajax({
        url : baseUrl + 'me/carts/active/line-items/'+ productId + '/?token=' + getLAT(),
        type : 'DELETE',
        success : function(result) {
            openCart();
        },
        error : function() {
            console.log("Error delete item"+productId);
        }
    });
}

function openCart(){
    $('.header-cart__list').empty();
    $.ajax({
        url: baseUrl + 'me/carts/active?locale='+ getLocale() + '&format=json&expand=lineitems.lineitem.product.customAttributes,lineitems.lineItem.product.sku&method=get&token=' + getLAT(),
        dataType: 'jsonp',
        success: function (results) {
            if(results.hasOwnProperty("errors")){
                console.log("token error getting current cart");
                clearCookies();
                getSessionToken();
            }
            let numOfItems = 0;
            $.each(results.cart.lineItems.lineItem, function(indexOne, firstLevel) {
                let cartItem = $('.cartItem').clone();
                cartItem.removeClass('cartItem');
                cartItem.show();
                //title
                let titleNode = cartItem.children().find('.header-cart__title');
                titleNode.empty();
                titleNode.append("<strong>" + firstLevel.product.displayName + "</strong>");
                //price
                let priceNode = cartItem.children().find('.header-cart__price');
                priceNode.empty();
                priceNode.append(firstLevel.pricing.formattedSalePriceWithQuantity);
                //image
                let imageNode = cartItem.find('div.img-box');
                imageNode.empty();
                let image = firstLevel.product.thumbnailImage;
                if(image.indexOf("http:") != -1){
                    image = image.replace("http", "https");
                }
                imageNode.append("<img src=\"" + image + "\" alt=\"Product\">");
                //add on click for delete
                let deleteButton = cartItem.find('.header-cart__item-remove');
                deleteButton.on("click", function() { deleteItem(firstLevel.id); });

                //// add in qty selector
                let qtySelect = cartItem.children().find('.quantity');
                qtySelect.val(firstLevel.quantity);
                var id = firstLevel.id;
                qtySelect.on("click", function() {updateCart(id, qtySelect.val())});

                numOfItems = numOfItems + firstLevel.quantity;
                $('.header-cart__list').append(cartItem);
            });

            Cookies.set('numberOfItems', numOfItems, { path: '/' });
            if(numOfItems > 0){
                updateCartIcon(numOfItems);
            }else{
                let empty = $('.emptyCart').clone();
                empty.show();
                $('.header-cart__list').append(empty);
                $('#num').remove();
            }
            if( results.cart.pricing.formattedDiscount.replace(/\D/g, '') != 0 ){
                $('#discount').show();
                $('.header-cart__discount-price').empty();
                $('.header-cart__discount-price').append("- " + results.cart.pricing.formattedDiscount);
            }else{
                $('#discount').hide();
            }
            $('.header-cart__total-price').empty();
            $('.header-cart__total-price').append(results.cart.pricing.formattedOrderTotal);
        },
        error: function(results) {
            console.log("in error" + results);
        }
    });
}


/*Called when the product quantity is changed and user clicks refresh*/
function updateCart(itemId, quan){
    $.ajax({
        url: baseUrl + 'me/carts/active/line-items/' + itemId + '?action=update&quantity=' + quan,
        type: 'POST',
        data:{token: getLAT()},
        success: function(results){
            openCart();
        },
        error : function(jqXHR, textStatus) {
            console.log("Error updating cart");
            console.log(jqXHR.statusText);
        }
    });
}
function getSessionToken(){
    var sessionToken = Cookies.get('sessionToken');
    if(sessionToken != null){
        getLAT();
    }else{
        $.ajax({
            url: sessionUrl,
            dataType: "jsonp",
            success: function(result){
                Cookies.set('sessionToken', result.session_token, { path: '/'});
                sessionToken = result.session_token;
                getLAT();
            },
            error: function(xhr, status, error) {
                console.log("error on session token");
            }
        });
    }
}

function getLAT(){
    if(Cookies.get('sessionToken') == null){
        getSessionToken();
        return;
    }
    var limitedAccessToken = Cookies.get('limitedAccess');
    if(limitedAccessToken != null ){
        return limitedAccessToken;
    }else{
        $.ajax({
            type: "GET",
            url: getServletPath(".limited-access-token.json") + "?sessionToken=" + Cookies.get('sessionToken'),
            dataType: "json",
            success: function(result){
                Cookies.set('limitedAccess', result.access_token, { path: '/'});
                $.ajax({
                    url: baseUrl + "me?format=json&locale=" + getLocale() + "&method=post&token=" + result.access_token,
                    success: function(result){
                        if(pstore){
                            privateStoreByUrl();
                        }
                    },
                    error: function(xhr, status, error) {
                        console.log("error on updated shopper");
                    }
                });
                return limitedAccessToken;
            },
            error: function(xhr, status, error) {
                console.log("error on limited access token");
            }
        });
    }
}

function addToCartWarranty(parentSku, childSku, offerId){
    var myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    var raw = JSON.stringify({"cart":{"lineItems":{"lineItem":[{"quantity":1,"product":{"externalReferenceId":parentSku}}],"appliedProductOffers":{"offer":{"offerId":offerId}}}}});

    var requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
        redirect: 'follow'
    };
    fetch( baseUrl + "me/carts/active?format=json&locale=en_US&expand=all&token=" + getLAT(), requestOptions)
            .then(response => response.text())
            .then(function(result) {
                $('.spinner-border').remove();
                $('.dr-add-to-cart').prop('disabled', false);
                openCart();
                $('.navbar-toggler').click();
                $('.header-cart__open').click();
                $("html, body").animate({ scrollTop: 0 }, "slow");
                let jsonResult = JSON.parse(result);
                let items = jsonResult.cart.lineItems.lineItem;
                for(let i = items.length-1; i >= 0; i--){
                    if(items[i].product.sku === childSku){
                        addWarranty($.trim(parentSku), items[i].uri);
                        break;
                    }
                }
            })
            .catch(error => {
                console.log('error', error);
                $('.spinner-border').remove();
                $('.dr-add-to-cart').prop('disabled', false);
            });
}

/*Add a product to cart by DR product ID*/
function addToCart(addProductId) {
    let checkPolyPlus;
    $('.form-check-input').each(function(index){
        if($(this).is(":checked")){
            checkPolyPlus = $(this).attr("data-pn");
            $(this).prop("checked", false);
            let offerId = $(this).attr("data-model-number");
            addToCartWarranty($.trim(addProductId), $.trim(checkPolyPlus), $.trim(offerId));
			$('.modal').modal('hide');
            return;
        }
    });
    if(checkPolyPlus){
        return;
    }
    let pn = $.trim(addProductId);
    let qty = 1;
    if($('div.buynow').length){
        qty = parseInt($('#quantity').val());
    }
    $.ajax({
        url: baseUrl + 'me/carts/active/line-items?format=json&locale=' + getLocale() + '&method=post&expand=all&quantity=' + qty + '&productId=' + pn + '&token=' + getLAT(),
        dataType: 'jsonp',
        success: function(results) {
            if(results.hasOwnProperty("errors")){
                console.log("token error adding to cart");
                $('.spinner-border').remove();
                $('.dr-add-to-cart').prop('disabled', false);
                clearCookies();
                getSessionToken();
                return;
            }
            let items = results.lineItems.lineItem;
            let numOfItems = 0;
            items.forEach(function(offer){
                numOfItems=numOfItems+offer.quantity;
            });
            Cookies.set('numberOfItems', numOfItems, { path: '/' });
            updateCartIcon(numOfItems);
            $('.spinner-border').remove();
            $('.modal').modal('hide');
            openCart();
            // $('.navbar-toggler').click();
            // $('.header-cart__open').click();
            $("html, body")
            .animate({ scrollTop: 0 }, "slow")
            .promise()
            .then(function() {
                if($("#primary-navigation").css("visibility") == "hidden") {
                    $('.navbar-toggler').click();
                    $('.header-cart__open').click();
                } else {
                    $('.header-cart__open').click();
                }
            });
            $('.dr-add-to-cart').prop('disabled', false);
        },
        error: function(results) {
            $('.spinner-border').remove();
            $('.dr-add-to-cart').prop('disabled', false);
            console.log("Failed to add to cart");
        }
    });
}

function addWarranty(sku, url){
    $.ajax({
        url: url + "?token=" + getLAT() + "&method=post&attribute=[name.WarrantyConnect,value." + sku + "]&format=json&expand=all",
        dataType: "jsonp",
        success: function(result){

        },
        error: function(result){
            $('.spinner-border').remove();
            $('.dr-add-to-cart').prop('disabled', false);
            console.log("error adding warranty : " + result);
        }
    });
}
function updateCartIcon(numOfItems){
    $('#num').remove();
    if(numOfItems != null || numOfItems !== 0){
        $('.icon-cart').after("<span id=\"num\">" + numOfItems + "</span>");
    }

}
function getLocale(){
    var pageUrl = document.location.href;
    let retLoc;
    if( pageUrl.indexOf("/us/en")!= -1 ){
        retLoc =  "en_US";
    }else if(pageUrl.indexOf("/de/de")!= -1){
        retLoc = "de_DE";
    }else if(pageUrl.indexOf("/es/es")!= -1){
        retLoc = "es_ES";
    }else if(pageUrl.indexOf("/fr/fr")!= -1){
        retLoc = "fr_FR";
    }else if(pageUrl.indexOf("/gb/en")!= -1){
        retLoc = "en_GB";
    }else if(pageUrl.indexOf("/ie/en")!= -1){
        retLoc = "en_IE";
    }else{
        retLoc = null;
    }
    return retLoc;
}
function checkLocale(){
    var loc = getLocale();
    if(Cookies.get('locale') == null){
        Cookies.set('locale', loc, { path: '/'});
    }else if( Cookies.get('locale') !=  loc){
        clearCookies();
        Cookies.set('locale', loc, { path: '/'});
        updateCartIcon(0);
    }
}
function checkToken(laToken){
    if(laToken == null){
        getLAT();
        return;
    }
    $.ajax({
        url: baseUrl + "me?format=json&locale=" + getLocale() + "&method=post&token=" + laToken,
        dataType: "jsonp",
        success: function(result){
            if(result.shopper == null || typeof result.shopper === "undefined"){
                clearCookies();
                getLAT();
            }
        },
        error: function(result){
            console.log("in error of checktoken : " + result);
        }
    });
}

function privateStoreByUrl(){
    var storeId = $("#store").attr("data-store-id");
    var marketingId = $("#store").attr("data-marketing-id");
    var token = getLAT();
    if(token != null || token != undefined) {
        $.ajax({
            url: getServletPath(".privateStore.json") + "?limitedToken=" + token + "&storeid=" + storeId + "&marketingid=" + marketingId + "&emaildomain=digitalriver.com",
            dataType: "json",
            success: function (results) {
                pstore = false;
                deleteCookie('pStoreByUrl');
            },
            error: function (xhr, status, error) {
                console.log("error on private store call : " + error);
            }
        });
    }
}

/*!
 * jQuery Cookie Plugin v1.4.1
 * https://github.com/carhartl/jquery-cookie
 *
 * Copyright 2006, 2014 Klaus Hartl
 * Released under the MIT license
 */
(function (factory) {
	if (typeof define === 'function' && define.amd) {
		// AMD (Register as an anonymous module)
		define(['jquery'], factory);
	} else if (typeof exports === 'object') {
		// Node/CommonJS
		module.exports = factory(require('jquery'));
	} else {
		// Browser globals
		factory(jQuery);
	}
}(function ($) {

	var pluses = /\+/g;

	function encode(s) {
		return config.raw ? s : encodeURIComponent(s);
	}

	function decode(s) {
		return config.raw ? s : decodeURIComponent(s);
	}

	function stringifyCookieValue(value) {
		return encode(config.json ? JSON.stringify(value) : String(value));
	}

	function parseCookieValue(s) {
		if (s.indexOf('"') === 0) {
			// This is a quoted cookie as according to RFC2068, unescape...
			s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
		}

		try {
			// Replace server-side written pluses with spaces.
			// If we can't decode the cookie, ignore it, it's unusable.
			// If we can't parse the cookie, ignore it, it's unusable.
			s = decodeURIComponent(s.replace(pluses, ' '));
			return config.json ? JSON.parse(s) : s;
		} catch(e) {}
	}

	function read(s, converter) {
		var value = config.raw ? s : parseCookieValue(s);
		return $.isFunction(converter) ? converter(value) : value;
	}

	var config = $.cookie = function (key, value, options) {

		// Write

		if (arguments.length > 1 && !$.isFunction(value)) {
			options = $.extend({}, config.defaults, options);

			if (typeof options.expires === 'number') {
				var days = options.expires, t = options.expires = new Date();
				t.setMilliseconds(t.getMilliseconds() + days * 864e+5);
			}

			return (document.cookie = [
				encode(key), '=', stringifyCookieValue(value),
				options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
				options.path    ? '; path=' + options.path : '',
				options.domain  ? '; domain=' + options.domain : '',
				options.secure  ? '; secure' : ''
			].join(''));
		}

		// Read

		var result = key ? undefined : {},
			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all. Also prevents odd result when
			// calling $.cookie().
			cookies = document.cookie ? document.cookie.split('; ') : [],
			i = 0,
			l = cookies.length;

		for (; i < l; i++) {
			var parts = cookies[i].split('='),
				name = decode(parts.shift()),
				cookie = parts.join('=');

			if (key === name) {
				// If second argument (value) is a function it's a converter...
				result = read(cookie, value);
				break;
			}

			// Prevent storing a cookie that we couldn't decode.
			if (!key && (cookie = read(cookie)) !== undefined) {
				result[name] = cookie;
			}
		}

		return result;
	};

	config.defaults = {};

	$.removeCookie = function (key, options) {
		// Must not alter options, thus extending a fresh object...
		$.cookie(key, '', $.extend({}, options, { expires: -1 }));
		return !$.cookie(key);
	};

}));
/*!
 * JavaScript Cookie v2.1.4
 * https://github.com/js-cookie/js-cookie
 *
 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 * Released under the MIT license
 */
;(function (factory) {
	var registeredInModuleLoader = false;
	if (typeof define === 'function' && define.amd) {
		define(factory);
		registeredInModuleLoader = true;
	}
	if (typeof exports === 'object') {
		module.exports = factory();
		registeredInModuleLoader = true;
	}
	if (!registeredInModuleLoader) {
		var OldCookies = window.Cookies;
		var api = window.Cookies = factory();
		api.noConflict = function () {
			window.Cookies = OldCookies;
			return api;
		};
	}
}(function () {
	function extend () {
		var i = 0;
		var result = {};
		for (; i < arguments.length; i++) {
			var attributes = arguments[ i ];
			for (var key in attributes) {
				result[key] = attributes[key];
			}
		}
		return result;
	}

	function init (converter) {
		function api (key, value, attributes) {
			var result;
			if (typeof document === 'undefined') {
				return;
			}

			// Write

			if (arguments.length > 1) {
				attributes = extend({
					path: '/'
				}, api.defaults, attributes);

				if (typeof attributes.expires === 'number') {
					var expires = new Date();
					expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
					attributes.expires = expires;
				}

				// We're using "expires" because "max-age" is not supported by IE
				attributes.expires = attributes.expires ? attributes.expires.toUTCString() : '';

				try {
					result = JSON.stringify(value);
					if (/^[\{\[]/.test(result)) {
						value = result;
					}
				} catch (e) {}

				if (!converter.write) {
					value = encodeURIComponent(String(value))
						.replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
				} else {
					value = converter.write(value, key);
				}

				key = encodeURIComponent(String(key));
				key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
				key = key.replace(/[\(\)]/g, escape);

				var stringifiedAttributes = '';

				for (var attributeName in attributes) {
					if (!attributes[attributeName]) {
						continue;
					}
					stringifiedAttributes += '; ' + attributeName;
					if (attributes[attributeName] === true) {
						continue;
					}
					stringifiedAttributes += '=' + attributes[attributeName];
				}
				return (document.cookie = key + '=' + value + stringifiedAttributes);
			}

			// Read

			if (!key) {
				result = {};
			}

			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all. Also prevents odd result when
			// calling "get()"
			var cookies = document.cookie ? document.cookie.split('; ') : [];
			var rdecode = /(%[0-9A-Z]{2})+/g;
			var i = 0;

			for (; i < cookies.length; i++) {
				var parts = cookies[i].split('=');
				var cookie = parts.slice(1).join('=');

				if (cookie.charAt(0) === '"') {
					cookie = cookie.slice(1, -1);
				}

				try {
					var name = parts[0].replace(rdecode, decodeURIComponent);
					cookie = converter.read ?
						converter.read(cookie, name) : converter(cookie, name) ||
						cookie.replace(rdecode, decodeURIComponent);

					if (this.json) {
						try {
							cookie = JSON.parse(cookie);
						} catch (e) {}
					}

					if (key === name) {
						result = cookie;
						break;
					}

					if (!key) {
						result[name] = cookie;
					}
				} catch (e) {}
			}

			return result;
		}

		api.set = api;
		api.get = function (key) {
			return api.call(api, key);
		};
		api.getJSON = function () {
			return api.apply({
				json: true
			}, [].slice.call(arguments));
		};
		api.defaults = {};

		api.remove = function (key, attributes) {
			api(key, '', extend(attributes, {
				expires: -1
			}));
		};

		api.withConverter = init;

		return api;
	}

	return init(function () {});
}));

