# JetPack Tab.setWindow

Monkey patch Firefox Addon SDK's Tab class with a method for moveing tabs to other windows.

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
    return TABS[1].setWindow(null);
});

```


