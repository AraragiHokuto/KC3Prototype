import electron from 'electron'
import path from 'path'
import RequestWatcher, { Watcher, Request, Response } from './RequestWatcher'

function ellipsis(text: string, maxLen: number) {
    const ELLIPSIS = '...'
    if (text.length > maxLen)
	text = text.substr(0, maxLen - ELLIPSIS.length) + ELLIPSIS
    return text
}

class KCWatcher implements Watcher {
    requestWillBeSent(req: Request) {
	console.log(`requestWillBeSent: ${req.url}`)
    }

    responseReceived(res: Response) {
	console.log(`responseReceived: ${res.url}`)
    }
    
    loadingFailed(req: Request, error: string) {
	console.log(`loadingFailed: ${error}: ${req.url}`)
    }
    
    async loadingFinished(res: Response) {
	let body = res.body && await res.body()
	console.log(`loadingFinished: ${(typeof(body) === 'string') ? ellipsis(body as string, 200) : '<binary>'}`)
    }
}

let watcher = new RequestWatcher
watcher.addWatcher(/kcsapi/, new KCWatcher)

electron.app
    .on('web-contents-created', (_ev, webContents) => {
	console.log('web-contents-created')
	watcher.watchContent(webContents)
    })	
    .on('ready', () => {
    let window = new electron.BrowserWindow({
	width: 1200,
	height: 720,
	title: "KC3Drei",
	webPreferences: {
	    preload: path.resolve(__dirname, 'ChromePolyfills.js')
	}
    })
    window.webContents.session.setProxy({ proxyRules: "socks5://localhost:1080" } as electron.Config)

    window.loadFile("kc3kai/src/pages/game/direct.html")
})
