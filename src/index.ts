import electron  from 'electron'
import path from 'path'
import fs from 'fs'

import { MessageBusServer } from './MessageBus'

electron.app
    .on('ready', () => {
	electron.ipcMain.addListener('renderer-logging', (_ev, ...args: any[]) => console.log(...args))
	let window = new electron.BrowserWindow({
	    width: 1800,
	    height: 800,
	    title: "KC3 Prototype",
	    webPreferences: {
		webSecurity: false,
		nodeIntegration: true,
		nodeIntegrationInSubFrames: true,
		preload: path.resolve(__dirname, 'preload.js')
	    }
	})

	window.setMenuBarVisibility(false)

	let gameView = new electron.BrowserView({
	    webPreferences: {
		webSecurity: false,
		nodeIntegration: true,
		nodeIntegrationInSubFrames: true,
		preload: path.resolve(__dirname, 'preload.js')
	    }
	})
	    
	let panelView = new electron.BrowserView({
	    webPreferences: {
		webSecurity: false,
		nodeIntegration: true,
		nodeIntegrationInSubFrames: true,
		preload: path.resolve(__dirname, 'preload.js')
	    }
	})

	// Bus server
	new MessageBusServer

	window.addBrowserView(gameView)
	window.addBrowserView(panelView)

	gameView.setBounds({
	    x: 0, y: 50,
	    width: 1205,
	    height: 725
	})
	panelView.setBounds({
	    x: 1210, y: 50,
	    width: window.getBounds().width - 1210,
	    height: 750
	})
	panelView.setAutoResize({ width: true })

	// remove X-Frame-Options to allow login page in iframe
	gameView.webContents.session.webRequest.onHeadersReceived((details, callback) => {
	    if (!details.responseHeaders)
		return callback({cancel: false, responseHeaders: details.responseHeaders})
	    
	    if (details.responseHeaders['x-frame-options'] || details.responseHeaders['X-Frame-Options']) {
		delete details.responseHeaders['x-frame-options']
		delete details.responseHeaders['X-Frame-Options']
	    }

	    callback({cancel: false, responseHeaders: details.responseHeaders})
	})

	gameView.webContents.session.setProxy({ proxyRules: "socks5://localhost:1080" } as electron.Config)

	window.loadFile('index.html')

	// setup gameview navigation handlers
	gameView.webContents.on(
	    'will-navigate',
	    (_ev, url) => window.webContents.send('kc3proto-on-game-navigate', url)
	)
	gameView.webContents.on(
	    'will-redirect',
	    (_ev, url) => window.webContents.send('kc3proton-on-game-navigate', url)
	)
	electron.ipcMain.addListener(
	    'kc3proto-game-navigate',
	    (_ev, url) => gameView.webContents.loadURL(url)
	)
	electron.ipcMain.addListener(
	    'kc3proto-open-window',
	    (_ev, url) => {
		let win = new electron.BrowserWindow({
		    webPreferences: {
			webSecurity: false,
			nodeIntegration: true,
			nodeIntegrationInSubFrames: true,
			preload: path.resolve(__dirname, 'preload.js')
		    }
		})
		win.setMenuBarVisibility(false)
		win.loadURL(url)
	    }
	)

	// some theme (e.g. natsuiro) use absolute paths to load assets
	// intercept them here so we can redirect to the correct paht
	panelView.webContents.session.protocol.interceptFileProtocol(
	    'file',
	    (req, callback) => {
		let p = req.url.substr(7)
		let redirected = path.join(__dirname, '../kc3kai/src', p)
		console.log(`intercept: ${p} => ${redirected}`)
		if (fs.existsSync(redirected))
		    callback(redirected)
		else
		    callback(p)
	    }
	)

	electron.ipcMain.on('kc3proto-request-inspected-tab-id', (ev) => {
	    ev.returnValue = gameView.webContents.id
	})

	gameView.webContents.loadFile('kc3kai/src/pages/game/direct.html')
	
	// activate panel after gameview has loaded
	panelView.webContents.loadFile('panelView.html')
    })
