import electron from 'electron'
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
	    x: 0, y: 0,
	    width: 1205,
	    height: 725
	})
	panelView.setBounds({
	    x: 1210, y: 0,
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

	// gameView.webContents.loadFile('gameView.html')
	gameView.webContents.loadFile('kc3kai/src/pages/game/direct.html')
	// gameView.webContents.loadURL('http://www.dmm.com/netgame/social/-/gadgets/=/app_id=854854/')
	// gameView.webContents.loadURL('http://203.104.209.134/kcs2/index.php?api_root=/kcsapi&voice_root=/kcs/sound&osapi_root=osapi.dmm.com&version=4.5.2.3&api_token=923ec8f58232998c665c4eb67ad5d5f641f0d044&api_starttime=1577953238030')
	// gameView.webContents.loadURL('http://osapi.dmm.com/gadgets/ifr?synd=dmm&container=dmm&owner=16118662&viewer=16118662&aid=854854&mid=26966574&country=jp&lang=ja&view=canvas&parent=http%3A%2F%2Fwww.dmm.com%2Fnetgame%2Fsocial%2F&url=http%3A%2F%2F203.104.209.7%2Fgadget_html5.xml&st=6YByb8Pk1qQTkPZjWZhOejtaE3bG1pCv6%2FDeb7NaR98dllbC0O7YaWq%2F%2B4B%2FhhTFQ%2BU3GtphqJZ%2F47C7Y4an9iLKfGiKihzrj1VioHUzlo8m%2Frnz7DwZAARQxlHVd%2BuLoFJu6HAmzT3YUO3hDrmdbV1c%2F9SJt%2FcJKLh7LL9a2MaWRHD9L6tH98e1g3bdaYkxEUCRSY1aDReaFh4b7GlFXpjsI64%3D#rpctoken=1795250053')
	
	gameView.webContents.openDevTools()
	
	// activate panel after gameview has loaded
	panelView.webContents.loadFile('panelView.html')
	panelView.webContents.openDevTools()
    })
