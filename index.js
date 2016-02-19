/**
 * Monkey patch Firefox Addon SDK's Tab class with a method for moving tabs to other windows.
 *
 *
 *  See discussions:
 *      https://stackoverflow.com/a/33847868/1242333
 *      https://discourse.mozilla-community.org/t/tear-off-tab-with-sdk/7085/9
 *
 * Tested with Firefox 44 and Nightly 47.
 * It might break in future releases because it uses low-level API.
 *
 * @license MIT
 * @version 1.0.4
 * @author Dumitru Uzun (DUzun.Me)
 */

// -------------------------------------------------------------
const VERSION = '1.0.4';
// -------------------------------------------------------------
const Tab = require("sdk/tabs/tab").Tab;
const viewFor = require("sdk/view/core").viewFor;
const modelFor = require("sdk/model/core").modelFor;
const { Promise, defer } = require('sdk/core/promise');

// -------------------------------------------------------------
/**
 * Move an SDK tab to a different window (patch Tab.prototype).
 *
 * @param BrowserWindow window - destination window, if empty - new window created
 * @param int index - tab index in the destination window (optional)
 * @param function cb(newTab, oldId) (optional)
 *
 * @param Promise newTab
 */
function setWindow(window, index, cb) {
    var tab = this;
    var tabId = tab.id;
    var oldWindow = tab.window;

    // var tmr = Date.now();

    return new Promise(function (resolve, reject) {
        // Same window
        if ( oldWindow === window ) {
            if ( index != undefined ) {
                if ( index < 0 ) {
                    var length = tab.window.tabs.length;
                    index = length - (index % length);
                }
                if ( index != tab.index ) {
                    tab.index = index;
                }
            }
            cb && cb(tab, tabId);
            resolve(tab);
            return tab;
        }

        // New window
        (function _move() {
            // We have to use lower-level API here
            var aTab = viewFor(tab);
            var aNewTab;

            if ( !window ) {
                var aOldWin = viewFor(oldWindow);
                var aNewWin = aOldWin.gBrowser.replaceTabWithWindow(aTab, {/*screenX: left, screenY: top, ...*/});
                var newWin;

                // console.log('setWindow.replaceTabWithWindow', Date.now()-tmr, {aNewWin, aOldWin, gBrowser: aNewWin.gBrowser})

                // New window is not ready yet, but in case things change, test window readiness
                if ( aNewWin.gBrowser && (newWin = modelFor(aNewWin)) ) {
                    onNewTab(newWin.tabs[0]);
                }
                // Wait for newWin.onOpen event - can't use model yet, so listen for DOM events and catch newWin.onOpen:
                else {
                    var _onWindowOpen = function (evt) {
                        // evt.currentTarget === aNewWin, but this could be an event from a different target

                        // we should avoid calling modelFor(aNewWin) before it is ready
                        if ( !aNewWin.gBrowser ) return;

                        newWin = modelFor(aNewWin);

                        // make sure one more time we a ok to continue
                        if ( !newWin ) return;

                        // Cleanup!
                        aNewWin.removeEventListener('DOMContentLoaded', _onWindowOpen);
                        aNewWin.removeEventListener('load', _onWindowOpen);

                        // Now we have the new tab in SDK
                        onNewTab(newWin.tabs[0]);

                        // Alternative:
                        // onNewTab(modelFor(aNewWin.gBrowser.tabContainer.childNodes[0]));
                    }

                    aNewWin.addEventListener('DOMContentLoaded', _onWindowOpen);
                    aNewWin.addEventListener('load', _onWindowOpen);
                }
            }
            else {
                var aWin = viewFor(window);
                var gBrowser = aWin.gBrowser;

                // If setWindow(window) called before window initialized (before window.on('open')), gBrowser is undefined
                if ( !gBrowser ) {
                    return window.once('open', _move);
                }

                // Get tab properties
                var isSelected = oldWindow.activeTab == tab;

                // If index specified, move placeholder-tab to desired index
                var length = gBrowser.tabContainer.childElementCount;
                if ( index != undefined ) {
                    if ( length ) {
                        if ( index < 0 ) index = length - (index % length);
                    }
                }
                else {
                    index = length;
                }

                aNewTab = adoptTab(gBrowser, aTab, index, isSelected);

                onNewTab(modelFor(aNewTab));
            }
        }());

        function onNewTab(newTab) {
            // Avoid calling this more then once
            if ( !resolve ) return;

            // Log for debugging:
            // console.log('setWindow.onNewTab', Date.now()-tmr, {newTab: newTab, id: newTab&&newTab.id, oldId: tabId});

            // Old tab (model) no longer usable
            tab.destroy();

            cb && cb(newTab, tabId);
            resolve(newTab);
            resolve = undefined;
        }
    });
};

// -------------------------------------------------------------
/// On first call, choose custom vs built-in implementation of `adoptTab()`
var adoptTab = (gBrowser, ...args) => {
    if ( gBrowser.adoptTab ) {
        adoptTab = (gBrowser, ...args) => gBrowser.adoptTab(...args);
    }
    else {
        adoptTab = _adoptTab;
    }
    return adoptTab(gBrowser, ...args);
};

// -------------------------------------------------------------
/// In the case gBrowser.adoptTab not defined yet (FF44) ...
function _adoptTab(gBrowser, aTab, index, selected) {
    // Create a placeholder-tab on destination windows
    var newTab = gBrowser.addTab('about:newtab');
    var newBrowser = newTab.linkedBrowser || gBrowser.getBrowserForTab(newTab);

    // Stop the about:blank load.
    newBrowser.stop();

    // Make sure it has a docshell.
    newBrowser.docShell;

    // Copy tab properties to placeholder-tab
    var numPinned = gBrowser._numPinnedTabs;
    if (index < numPinned || (aTab.pinned && index == numPinned)) {
        gBrowser.pinTab(newTab);
    }

    gBrowser.moveTabTo(newTab, index);

    // @TODO: Test this, not sure it works
    if ( selected ) {
        gBrowser.selectedTab = newTab;
    }

    // Swap tabs and remove placeholder-tab
    aTab.parentNode._finishAnimateTabMove();
    gBrowser.swapBrowsersAndCloseOther(newTab, aTab);

    if (selected) {
        // Call updateCurrentBrowser to make sure the URL bar is up to date
        // for our new tab after we've done swapBrowsersAndCloseOther.
        gBrowser.updateCurrentBrowser(true);
    }

    return newTab;
}
// -------------------------------------------------------------
exports.setWindow = Tab.prototype.setWindow = setWindow;
exports.VERSION = setWindow.VERSION = VERSION;

exports.Tab = Tab;

// -------------------------------------------------------------
