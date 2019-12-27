import electron from 'electron'

function ellipsis(text: string, maxLen: number) {
    const ELLIPSIS = '...'
    if (text.length > maxLen)
	text = text.substr(0, maxLen - ELLIPSIS.length) + ELLIPSIS
    return text
}

electron.app.on('ready', () => {
    let window = new electron.BrowserWindow({
	width: 1200,
	height: 720,
	title: "KC3Drei"
    })

    window.webContents.session.setProxy({ proxyRules: "socks5://localhost:1080" } as electron.Config)

    window.webContents.debugger.attach('1.1')
    window.webContents.debugger.on('detach', (_: any, reason: any) => {
	console.log(`Debugger detached: ${reason}`)
    })

    window.webContents.debugger.on('message', async (_: any, method: any, params: any) => {
	if (method == 'Network.requestWillBeSent') {
	    console.log(`requestWillBeSent: ${params.request.url}`)
	} else if (method == 'Network.loadingFinished') {
	    console.log(`loadingFinfished: ${params.requestId}`)
	    try {
		let body = await window.webContents.debugger.sendCommand('Network.getResponseBody', {
		    requestId: params.requestId
		})
		console.log(`body received: ${body.base64Encoded ? '(base64)' : ''} ${ellipsis(body.body, 100)}`)
	    } catch (_) {}
	}
    })

    window.webContents.debugger.sendCommand('Network.enable')
    
    window.loadURL("https://www.dmm.com")
})
