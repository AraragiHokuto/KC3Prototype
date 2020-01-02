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

	sendMessage(message: any, responseCallback?: (response: any) => void) {
	    logToMain(`sendMsg: ${webFrame.routingId} ${JSON.stringify(message)}`)
	    let promise = bus.broadcast({ tab: window.chrome.tabs._getCurrent(), msg: message }, !!responseCallback)
	    if (responseCallback) {
		promise && promise.then(reply => reply && responseCallback(reply))
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
    }
}
