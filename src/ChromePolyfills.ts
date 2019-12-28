// Polyfills for chrome API
// Implement on a as needed basis

import { remote } from 'electron'
import process from 'process'

declare global {
    interface Window { chrome: any }
}

window.chrome = {
    cookies: {
	set(cookie: any, callback: (cookie: any) => void) {
	    remote.session.defaultSession.cookies.set(cookie)
		.then(() => {
		    callback(cookie)
		})
	}
    },
    runtime: {
	onMessage: {
	    _listener: undefined as any,
	    addListener(callback: any) {
		this._listener = callback
	    }
	},
	
	sendMessage(_extId: string, message: any, _options: any, responseCallback: (response: any) => void) {
	    let listener = this.onMessage._listener;
	    listener && listener(message, {}, responseCallback)
	},
	
	getPlatformInfo(callback: (info: any) => void) {
	    callback({
		os: process.platform
	    })
	}
    }
}
