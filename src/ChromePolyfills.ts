// Polyfills for chrome API
// Implement on a as needed basis

import { remote, ipcRenderer, webFrame } from 'electron'
import process from 'process'
import path from 'path'
import fs from 'fs'

import { MessageBusClient } from './MessageBus'

declare global {
    interface Window { chrome: any }
}

const logToMain = (...args: any[]) => ipcRenderer.send('renderer-logging', ...args)

let bus = new MessageBusClient

window.chrome = {
    cookies: {
	set(cookie: any, callback: (cookie: any) => void) {
	    remote.getCurrentWebContents().session.cookies.set(cookie)
		.then(() => {
		    callback(cookie)
		})
	},
	onChanged: {
	    addListener(callback: any) {
		remote.getCurrentWebContents().session.cookies.on(
		    'changed',
		    (_ev: any, cookie: any, cause: any, removed: any) => {
			callback({
			    removed: removed,
			    cookie: cookie,
			    cause: cause
			})
		    })
	    }
	}
    },
    runtime: {
	onMessage: {
	    addListener(callback: any) {
		bus.addListener((msg: any, _sender: any, reply: any) =>
				callback(
				    msg.msg,
				    { tab: msg.tab }, 
				    reply
				))
	    }
	},

	onUpdateAvailable: {
	    addListener(_callback: any) {}
	},

	_sendMessage(message: any, responseCallback?: (response: any) => void, tabId?: number) {
	    logToMain(`sendMsg: ${tabId ? tabId : ""} ${webFrame.routingId} ${JSON.stringify(message)}`)
	    let promise
	    let msg = {
		tab: window.chrome.tabs._getCurrent(),
		msg: message
	    }
	    if (tabId)
		promise = bus.specific(msg, !!responseCallback, tabId)
	    else
		promise = bus.broadcast(msg, !!responseCallback)
	    if (responseCallback) {
		promise && promise.then(reply => reply && responseCallback(reply))
	    }
	},

	sendMessage(a: any, b: any, c: any) {
	    // Chrome API is s**t
	    if (a !== undefined && b !== undefined && c !== undefined) {
		// a = tabId, b = message, c = callback
		this._sendMessage(b, c, a)
	    } else if (a !== undefined && b === undefined && c === undefined) {
		// a = message
		this._sendMessage(b)
	    } else if (a !== undefined && b !== undefined && c === undefined) {
		if (typeof a === 'number') {
		    // assume a = tabId, b = message
		    this._sendMessage(b, undefined, a)
		} else {
		    // assume a = message, b = callback
		    this._sendMessage(a, b)
		}
	    }
	},
	
	getPlatformInfo(callback: (info: any) => void) {
	    callback({
		os: process.platform
	    })
	},

	getManifest() {
	    return JSON.parse(fs.readFileSync('kc3kai/src/manifest.json', 'utf8'))
	}
    },

    notifications: {
	onClicked: {
	    addListener(_callback: any) {}
	},
	onButtonClicked: {
	    addListener(_callback: any) {}
	}
    },

    tabs: {
	_getCurrent() {
	    return {
		id: webFrame.routingId,
		url: window.location.href
	    }
	},
	update(_tab: any, _info: any, callback: any) {
	    callback()
	}
    },

    extension: {
	getURL(file: string) {
	    return `file://${path.join(__dirname, '../kc3kai/src', file)}`
	}
    },

    devtools: {
	panels: {
	    create(title: string, _iconPath: string, pagePath: string, callback: (panel: any) => void) {
		ipcRenderer.sendTo(
		    remote.getCurrentWebContents().id,
		    'kc3proto-add-panel',
		    {
			name: title,
			url: pagePath
		    }
		);
		callback({})
	    }
	},
	inspectedWindow: {
	},
	network: {
	    onRequestFinished: {
		addListener(_callback: any) {} // XXX: stub
	    }
	}
    }
}
