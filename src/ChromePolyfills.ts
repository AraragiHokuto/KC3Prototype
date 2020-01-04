// Polyfills for chrome API
// Implement on a as needed basis

import { remote, ipcRenderer, webFrame, ipcMain } from 'electron'
import process from 'process'
import path from 'path'
import { promisify } from 'util'
import fs from 'fs'
import storage from 'electron-json-storage'

import { MessageBusClient } from './MessageBus'

declare global {
    interface Window { chrome: any }
}

const logToMain = (...args: any[]) => ipcRenderer.send('renderer-logging', ...args)

let bus = new MessageBusClient

interface ChromeTabInfo {
    id: number
    windowId: number
    url: string
    mutedInfo: {
	muted: boolean
    }
    [key: string]: any
}

interface ChromeTabCreateProps {
    windowId: number,
    index: number,
    url: string,
    active: boolean,
    selected: boolean,
    pinned: boolean,
    openerTabId: number
}

class ChromeStorage {
    constructor(private key: string) {}

    private async _getAll() {
	return promisify(storage.get)(this.key) as Promise<any>
    }

    private async _getWithDefault(obj: { [key: string]: any }) {
	let storageContent = await this._getAll()
	let ret = {} as any
	Object.keys(obj).forEach(key => ret[key] = storageContent[key] || obj[key])
    }

    private async _getList(keys: string[]) {
	let storageContent = await this._getAll()
	let ret = {} as any
	keys.forEach(key => ret[key] = storageContent[key])
    }

    private async _getKey(key: string) {
	let storageContent = await this._getAll()
	let ret = {} as any
	ret[key] = storageContent[key]
	return ret
    }

    get(key: string | string[] | any, callback: (result?: any) => void) {
	let promise
	if (key === null) {
	    promise = this._getAll()
	} else if (typeof(key) === "string") {
	    promise = this._getKey(key)
	} else if (typeof(key[0]) === "string") { // assume string array
	    promise = this._getList(key)
	} else { // assume object
	    promise = this._getWithDefault(key)
	}
	promise.then(callback)
    }

    private async _set(items: { [key: string]: any }) {
	let oldContent = await this._getAll()
	let change = {} as any
	Object.keys(items).forEach(key => change[key] = {
	    oldValue: oldContent[key],
	    newValue: items[key]
	})

	bus.broadcast({
	    type: 'storage',
	    area: this.key,
	    changes: change
	}, false)
	
	return promisify(storage.set)(
	    this.key,
	    {
		...oldContent,
		...items
	    }
	)
    }

    set(items: { [key: string]: any }, callback: () => void) {
	this._set(items).then(callback)
    }

    private async _remove(key: string | string[]) {
	let oldContent = await this._getAll()

	let changes = {} as any

	if (typeof(key) === 'string') {
	    changes[key] = {
		oldValue: oldContent[key],
		newValue: undefined
	    }
	    oldContent[key] = undefined
	} else {
	    key.forEach(item => {
		changes[item] = {
		    oldValue: oldContent[item],
		    newValue: undefined
		}
		oldContent[item] = undefined
	    })
	}
	bus.broadcast({
	    type: 'storage',
	    area: this.key,
	    changes: changes
	}, false)
	return promisify(storage.set)(this.key, oldContent)
    }

    remove(key: string | string[], callback: () => void) {
	this._remove(key).then(callback)
    }

    clear(callback: () => void) {
	promisify(storage.set)(this.key, {}).then(callback)
    }
}

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
		bus.addListener(
		    (msg: any, _sender: any, reply: any) =>
			msg.type == 'runtime' && callback(msg.msg, { tab: msg.tab }, reply)
		)
	    }
	},

	onUpdateAvailable: {
	    addListener(_callback: any) {}
	},

	sendMessage(message: any, responseCallback?: (response: any) => void) {
	    logToMain(`sendMsg: ${webFrame.routingId} ${JSON.stringify(message)}`)
	    let promise
	    let msg = {
		type: "runtime",
		tab: window.chrome.tabs._getCurrent(),
		msg: message
	    }
	    promise = bus.broadcast(msg, !!responseCallback)
	    responseCallback && promise && promise.then(reply => responseCallback(reply))
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
	_notifications: {} as { [key: string]: Notification },
	_castNotifyOpt(chromeOpts: any) {
	    return {
		icon: chromeOpts.iconUrl,
		body: `${chromeOpts.message || ''}\n${chromeOpts.contextMessage || ''}`,
		requireInteraction: chromeOpts.requireInteraction,
		silent: chromeOpts.silent
	    }
	},
	create(id: string, chromeOptions: any, callback?: (id: string) => void) {
	    let opts = this._castNotifyOpt(chromeOptions)
	    let title = chromeOptions.title
	    let n = new Notification(title, opts)
	    n.onclick = () => this.onClicked._callbacks.map(c => c(id))
	    n.onclose = ev => this.onClosed._callbacks.map(c => c(id, ev.returnValue))
	    this._notifications[id] = n
	    callback && callback(id)
	},
	clear(id: string, callback?: (wasCleared: boolean) => void) {
	    this._notifications[id] && this._notifications[id].close()
	    callback && callback(true)
	},
	onClicked: {
	    _callbacks: [] as any[],
	    addListener(callback: any) {
		this._callbacks.push(callback)
	    }
	},
	onClosed: {
	    _callbacks: [] as any[],
	    addListener(callback: (id: string, byUser: boolean) => void) {
		this._callbacks.push(callback)
	    }
	},
	onButtonClicked: {
	    addListener(_callback: any) {}
	}
    },

    downloads: {
	setShelfEnabled(_e: boolean) {}, // stub
	async _download(options: { url: string, filename?: string }) {
	    if (!options.url.startsWith('blob'))
		return
	    let blob = await (await fetch(options.url)).blob()
	    let reader = new FileReader
	    reader.readAsArrayBuffer(blob)
	    let saveRet = await remote.dialog.showSaveDialog({
		defaultPath: options.filename
	    })

	    if (saveRet.canceled)
		return
	    return promisify(fs.writeFile)(saveRet.filePath as string, new Buffer(reader.result as ArrayBuffer))
	},
	download(options: { url: string, filename?: string }, callback: (id: number) => void) {
	    //stub
	    this._download(options).then(() => callback(1))
	}
    },

    tabs: {
	_getCurrent(): ChromeTabInfo {
	    return {
		id: remote.getCurrentWebContents().id,
		windowId: remote.getCurrentWebContents().id, // XXX: hack
		url: window.location.href,
		mutedInfo: {
		    muted: remote.getCurrentWebContents().audioMuted
		}
	    }
	},
	create(props: Partial<ChromeTabCreateProps>, callback: any) {
	    props.url && ipcRenderer.send('kc3proto-open-window', props.url)
	    callback()
	},
	_requestTab(id: number, request: string, data?: any) {
	    return bus.specific({ type: 'tabs', request: request, data: data}, true, id)
	},
	update(tabId: number, info: any, callback?: (info: ChromeTabInfo) => void) {
	    let promise = this._requestTab(tabId, 'update', info)
	    callback && promise.then(callback)
	},
	async _captureVisibleTab(tabId: number, options: Partial<{ format: "jpeg" | "png", quality: number} >) {
	    let nativeImage = await remote.webContents.fromId(tabId).capturePage()
	    let format = options.format || 'png'
	    let quality = options.quality || 100
	    let buffer
	    if (format == 'png')
		buffer = nativeImage.toPNG()
	    else
		buffer = nativeImage.toJPEG(quality)

	    return `data:image/${format};base64,` + buffer.toString('base64')
	},
	captureVisibleTab(tabId: number, options: Partial<{ format: "jpeg" | "png", quality: number }>, callback: (url: string) => void) {
	    this._captureVisibleTab(tabId, options).then(callback)
	},
	sendMessage(tabId: number, message: any, responseCallback?: (response: any) => void) {
	    logToMain(`sendMsg: ${webFrame.routingId} ${JSON.stringify(message)}`)
	    let promise
	    let msg = {
		type: "runtime",
		tab: window.chrome.tabs._getCurrent(),
		msg: message
	    }
	    promise = bus.specific(msg, !!responseCallback, tabId)
	    responseCallback && promise && promise.then(reply => responseCallback(reply))
	},
	getCurrent(callback: (info: ChromeTabInfo) => void) {
	    callback(this._getCurrent())
	},
	get(tabId: number, callback?: (info: ChromeTabInfo) => void) {
	    let promise = this._requestTab(tabId, 'get')
	    callback && promise.then(callback)
	},
	getZoom(tabId: number, callback?: (factor: number) => void) {
	    let promise = this._requestTab(tabId, 'getZoom')
	    callback && promise.then(callback)
	}
    },

    // hacky windows implementation to allow fitScreen
    windows: {
	getCurrent(callback: (wind: any) => void) {
	    callback({
		id: 0, width: 0, height: 0
	    })
	},
	update() {
	    ipcRenderer.send('kc3proto-window-update')
	}
    },

    extension: {
	getURL(file: string) {
	    return `file://${path.join(__dirname, '../kc3kai/src/', file)}`
	}
    },

    storage: {
	sync: new ChromeStorage("sync") as any,
	local: new ChromeStorage("local"),
	onChanged: {
	    _listeners: [] as any[],
	    addListener(callback: any) {
		this._listeners.push(callback)
		bus.addListener((msg: any) => msg.type == 'storage' && callback(msg.changes, msg.area))
	    },
	    hasListener(listener: any) {
		!!this._listeners.find(item => item == listener)
	    },
	    removeListener(_listener: any) {
		// stub
	    }
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
	    _tabId: undefined,
	    get tabId() {
		if (!this._tabId)
		    this._tabId = ipcRenderer.sendSync('kc3proto-request-inspected-tab-id')
		return this._tabId
	    }
	},
	network: {
	    onRequestFinished: {
		addListener(callback: any) {
		    bus.addListener((msg: any) => {
			if (msg.type != 'interceptor')
			    return
			
			let res = msg.response
			let headers = []
			for (let key in res.headers) {
			    headers.push({ name: key, value: res.headers[key]})
			}
			headers.push({ name: "Date", value: res.headers.date })
			callback({
			    request: {
				url: res.config.url
			    },
			    response: {
				status: res.status,
				statusText: res.statusText,
				headers: headers
			    },
			    getContent(callback: any) {
				callback(res.data, "")
			    }
			})
		    })
		} // XXX: stub
	    }
	}
    }
}

const _tabHandlers = {
    get: () => {
	return window.chrome.tabs._getCurrent()
    },
    getZoom: () => {
	return webFrame.getZoomFactor()
    },
    update: (data: any) => {
	remote.getCurrentWebContents().audioMuted = data.muted
	return window.chrome.tabs._getCurrent()
    }
} as any

// tab event handlers
bus.addListener((msg: any, _sender: any, reply: (rep: any) => void) => {
    // only run handler in main frame
    if (webFrame.parent)
	return
    
    let handler = _tabHandlers[msg.request]
    msg.type == 'tabs' && reply(handler && handler(msg.data))
})

// devtools page will freeze without those properties
window.chrome.storage.sync.QUOTA_BYTES = 102400
window.chrome.storage.sync.QUOTA_BYTES_PER_ITEM = 8192
window.chrome.storage.sync.MAX_ITEMS = 512
window.chrome.storage.sync.MAX_WRITE_OPERATIONS_PER_HOUR = 1800
window.chrome.storage.sync.MAX_WRITE_OPTIONS_PER_MINUTE = 120
