import matcher from 'matcher'
import fs from 'fs'
import electron from 'electron'
import path from 'path'
import { MessageBusClient } from './MessageBus'

// replace console.log to allow logging to main
const log = (...args: any[]) => electron.ipcRenderer.send('renderer-logging', ...args)
console.log = log

// Chrome Polyfill
require('./ChromePolyfills')

let manifest = JSON.parse(fs.readFileSync('kc3kai/src/manifest.json', 'utf8'))
let background_scripts = manifest.background.scripts
let content_scripts = manifest.content_scripts

declare global {
    interface Window { _isKC3PrototypeIndex?: boolean; KC3Meta: any; axios: any; }
}

function loadJS(path: string) {
    return (new Promise<void>((resolve, reject) => {
	var script = document.createElement("script")
	script.src = `file://${path}`
	script.onload = () => { log(`onload: ${path}`); resolve() }
	script.onerror = () => { reject() }
	document.body.appendChild(script)
    }))
}

window.addEventListener('DOMContentLoaded', async () => {
    if (window._isKC3PrototypeIndex) {
	// load backgrounds
	for (let item of background_scripts) {
	    try {
		await loadJS(path.join(__dirname, `../kc3kai/src/${item}`))
		if (path.basename(item) == 'Meta.js') {
		    // monkeypatch init to rewrite repo
		    let oldInit = window.KC3Meta.init;
		    window.KC3Meta.init = function (_repo: string) {
			let repo = 'kc3kai/src/data/'
			console.log(`rewrite ${_repo} to ${repo}`)
			oldInit.call(this, repo)
		    }
		}
	    } catch (e) {
		console.log(e)
	    }
	}

    }
	
    for (let i of content_scripts) {
	let match = false
	for (let j of i.matches) {
	    if (matcher.isMatch(document.location.href, j)) {
		match = true
		log(`match: ${j} ${document.location.href}`)
	    }
	}

	if (!match)
	    continue
	
	i.css && i.css.map((item: string) => {
	    item = path.join(__dirname, `../kc3kai/src/${item}`)
	    log(`inject CSS: ${item}`)
	    var style = document.createElement("style")
	    style.setAttribute('href', `file://${item}`)
	    document.body.appendChild(style)
	})

	if (!i.js)
	    return

	// can't use map here since we need to load scripts synchronously
	for (let item of i.js) {
	    item = path.join(__dirname, `../kc3kai/src/${item}`)
	    log(`inject JS: ${item}`)

	    await loadJS(item)
	}
    }

    // replace console.log again for KC3Prototype debugging purpose
    console.log = log
})

window.addEventListener('load', () => {
    if (/\/kcs2\/index\.php\?/.exec(document.location.href)) {
	log(`preload: injecting scripts for API page`)

	let bus = new MessageBusClient

	window.axios.interceptors.response.use((res: any) => {
	    log(`interceptor: ${res.config.url}`)
	    // NOTE: optimization possible?
	    bus.broadcast({ type: "interceptor", response: res }, false)
	    return res
	})

	// told main window to resize
	electron.ipcRenderer.send('kc3proto-game-ready')
    }
})

// some library will use modules for export rather than add a global object when nodeIntegration is on (e.g. Dexie)
// remove global and module from window to prevent that from happening
window.global = undefined as any
window.module = undefined as any
    
