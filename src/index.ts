import electron  from 'electron'
import path from 'path'
import fs from 'fs'

import { MessageBusServer } from './MessageBus'

interface KC3ProtoConfig {
    proxyConfig?: electron.Config
}

const PANEL_WIDTH = 600;
const DEFAULT_GAME_WIDTH = 1200;
const DEFAULT_GAME_HEIGHT = 720;
const DEFAULT_FRAME_HEIGHT = 50;
const DEFAULT_WINDOW_WIDTH = PANEL_WIDTH + DEFAULT_GAME_WIDTH
const DEFAULT_WINDOW_HEIGHT = DEFAULT_FRAME_HEIGHT + DEFAULT_GAME_HEIGHT

electron.app
    .on('ready', () => {
	electron.ipcMain.addListener('renderer-logging', (_ev, ...args: any[]) => console.log(...args))
	let window = new electron.BrowserWindow({
	    width: PANEL_WIDTH + DEFAULT_GAME_WIDTH,
	    height: DEFAULT_FRAME_HEIGHT + DEFAULT_GAME_HEIGHT,
	    title: "KC3 Prototype",
	    webPreferences: {
		webSecurity: false,
		nodeIntegration: true,
		nodeIntegrationInSubFrames: true,
		preload: path.resolve(__dirname, 'preload.js')
	    }
	})

	let config
	try {
	    config = JSON.parse(fs.readFileSync('./config.json', 'utf8')) as KC3ProtoConfig
	} catch (_) {
	    config = {}
	}

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

	const onWindowResize = (vw: number, vh: number) => {
	    let gameWidth = vw - PANEL_WIDTH
	    let height = vh - DEFAULT_FRAME_HEIGHT
	    
	    gameView.setBounds({
		x: 0, y: DEFAULT_FRAME_HEIGHT,
		width: gameWidth,
		height: height
	    })
	    panelView.setBounds({
		x: gameWidth, y: DEFAULT_FRAME_HEIGHT,
		width: PANEL_WIDTH,
		height: height
	    })

	    gameView.webContents.insertCSS("::-webkit-scrollbar { display: none; }")
	}
	onWindowResize(window.getBounds().width, window.getBounds().height)
	window.on('resize', () => onWindowResize(window.getBounds().width, window.getBounds().height))
	electron.ipcMain.on('kc3proto-window-update', () => {
	    // assume this means fitScreen for now
	    window.setBounds({ width: DEFAULT_WINDOW_WIDTH, height: DEFAULT_WINDOW_HEIGHT })
	})

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

	config && config.proxyConfig && gameView.webContents.session.setProxy(config.proxyConfig)

	electron.ipcMain.addListener(
	    'kc3proto-update-config',
	    (_ev, config: KC3ProtoConfig) => {
		config.proxyConfig && gameView.webContents.session.setProxy(config.proxyConfig)
		fs.writeFile('./config.json', JSON.stringify(config), () => {})
	    }
	)

	// window.webContents.openDevTools()
	
	window.loadFile('index.html')

	// setup gameview navigation handlers
	gameView.webContents.on(
	    'will-navigate',
	    (_ev, url) => window.webContents.send('kc3proto-on-game-navigate', url)
	)
	electron.ipcMain.addListener(
	    'kc3proto-game-navigate',
	    (_ev, url) => {
		console.log(`navigate: ${url}`)
		gameView.webContents.loadURL(url)
		window.webContents.send('kc3proto-on-game-navigate', url)
	    }
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
	electron.ipcMain.addListener(
	    'kc3proto-game-ready',
	    () => {
		gameView.webContents.insertCSS('::-webkit-scrollbar { display: none; }')
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
	panelView.webContents.loadFile('panelView.html')
	// gameView.webContents.openDevTools()
	// panelView.webContents.openDevTools()
    })
