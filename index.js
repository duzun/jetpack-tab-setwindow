/**
 * Monkey patch Firefox Addon SDK's Tab class with a method for moving tabs to other windows.
 *
 *
 *  See discussions:
 *      https://stackoverflow.com/a/33847868/1242333
 *      https://discourse.mozilla-community.org/t/tear-off-tab-with-sdk/7085/9
 *
 *
 * @license MIT
 * @version 1.0.1
 * @author Dumitru Uzun (DUzun.Me)
 */

// -------------------------------------------------------------
const VERSION = '1.0.1';
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
                aNewTab = aOldWin.gBrowser.replaceTabWithWindow(aTab, {});
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
                if ( index != undefined ) {
                    var length = gBrowser.tabContainer.childElementCount;
                    if ( length ) {
                        if ( index < 0 ) index = length - (index % length);
                    }
                }

                if ( gBrowser.adoptTab ) {
                    aNewTab = gBrowser.adoptTab(aTab, index, isSelected);
                }
                else {
                    aNewTab = adoptTab(gBrowser, aTab, index, isSelected);
                }
            }

            // Log for debugging:
            // console.log('setWindow', {index, isSelected, tab, tabId});

            var newTab = modelFor(aNewTab);

            // console.log('setWindow.done', {tabId, newTabId: newTab.id});

            // Old tab (model) no longer usable
            tab.destroy();

            cb && cb(newTab, tabId);
            return resolve(newTab);
        }());
    });
};

// -------------------------------------------------------------
/// In the case gBrowser.adoptTab not defined ...
function adoptTab(gBrowser, aTab, index, selected) {
    // Create a placeholder-tab on destination windows
    var newTab = gBrowser.addTab('about:newtab');

    var Ci = require('chrome').Ci;
    newTab.linkedBrowser.webNavigation.stop(Ci.nsIWebNavigation.STOP_ALL); // we don't need this tab anyways

    // If index specified, move placeholder-tab to desired index
    if ( index != undefined ) {
        var length = gBrowser.tabContainer.childElementCount;
        if ( length ) {
            if ( index < 0 ) index = length - (index % length);
            if( 0 <= index && index < length ) {
                gBrowser.moveTabTo(newTab, index);
            }
        }
    }

    // Copy tab properties to placeholder-tab
    var numPinned = gBrowser._numPinnedTabs;
    if (index < numPinned || (aTab.pinned && index == numPinned)) {
        gBrowser.pinTab(newTab);
    }

    // For some reason this doesn't seem to work :-(
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
