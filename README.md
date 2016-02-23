# JetPack Tab.setWindow

Monkey patch Firefox Addon SDK's Tab class with a method for moving tabs to other windows.

## Install

In you addon folder run

```sh
npm i jetpack-tab-setwindow --save
```

## Usage

In you addon code include

```js
require('jetpack-tab-setwindow');
```

That's it!

Now you can call `setWindow(window, index)` on any SDK tab.


```js
const TABS = require("sdk/tabs");

// Move first tab to the end of second tab's window
TABS[0].setWindow(TABS[1].window, -1)
.then(function (newTab) {
    // newTab is a new object representing TABS[0], but the tab is the same!
    // All states are preserved, even video continues playing.
    // But newTab.id !== TABS[0].id

    // Move second tab to a new window (tear off)
    return TABS[1].setWindow(null)
    .then(function (newTab1) {
        // Note: if TABS[1] is the only tab in its window, tab is not detached and newTab1 === TABS[1]
    });
});

```


## Note

This library uses Addon SDK low-level API, which is not encouraged.

Here is a note from Mozilla's SDK Add-ons website:

> Note that directly accessing XUL objects and web content like this means
> you're no longer protected by the compatibility guarantees made by the SDK's high-level APIs.
> In particular, your code might not work with [multiprocess Firefox](https://billmccloskey.wordpress.com/2013/12/05/multiprocess-firefox/).

So use with care.

Tested with Firefox 44 and Nightly 47.

