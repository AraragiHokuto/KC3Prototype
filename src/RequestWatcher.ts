import electron from 'electron'

export interface Request {
    url: string
    urlFragment?: string
    method: string
    headers: any
    postData?: string
    hasPostData?: boolean
    referrerPolicy: string
    isLinkPreload?: boolean
}

export interface Response {
    url: string
    status: number
    statusText: string
    headers: any
    mimeType: string

    body?: () => Promise<ResponseBody>
}

type ResponseBody = string | Buffer

export interface Watcher {
    requestWillBeSent(request: Request): void
    responseReceived(response: Response): void
    loadingFinished(response: Response): void
    loadingFailed(request: Request, error: string, canceled?: boolean, blockedReason?: any): void
}
    
export default class RequestWatcher {
    private watchers: { rule: RegExp, watcher: Watcher }[] = []
    private requestMap: { [id: string]: { watcher: Watcher, req: Request, res?: Response } } = {}

    constructor() {}

    private _onMessage(dbg: electron.Debugger, _: any, method: string, params: any) {
	switch(method) {
	    case 'Network.requestWillBeSent':
		for (let i of this.watchers) {
		    if (i.rule.exec(params.request.url)) {
			this.requestMap[params.requestId] = { watcher: i.watcher, req: params.request }
			i.watcher.requestWillBeSent(params.request)
		    }
		    break
		}
		return
	    case 'Network.responseReceived':
		if (this.requestMap[params.requestId]) {
		    let r = this.requestMap[params.requestId]
		    this.requestMap[params.requestId] = { ...r, res: params.response }
		    r.watcher.responseReceived(params.response)
		}
		return
	    case 'Network.loadingFinished':
		if (this.requestMap[params.requestId]) {
		    let r = this.requestMap[params.requestId]
		    delete this.requestMap[params.requestId]
		    r.watcher.loadingFinished({ ...r.res as Response, body: async () => {
			let body = await dbg.sendCommand(
			    'Network.getResponseBody',
			    {
				requestId: params.requestId
			    }
			)
			return body.base64Encoded ? Buffer.from(body.body, 'base64') : body.body as string
		    }})
		}
		return
	    case 'Network.loadingFailed':
		if (this.requestMap[params.requestId]) {
		    let r = this.requestMap[params.requestId]
		    delete this.requestMap[params.requestId]
		    r.watcher.loadingFailed(r.req, params.errorText, params.canceled, params.blockedReason)
		}
		return
	}
	   
    }

    watchContent(content: electron.webContents) {
	let dbg = content.debugger

	dbg.attach('1.1')
	dbg.on('detach', (_: any, reason: any) => {
	    // XXX: detach handling

	    console.log(`RequestWatcher: debugger detached: ${JSON.stringify(reason)}`)    
	})
	dbg.on('message', (ev: any, method: string, params: any) => this._onMessage(dbg, ev, method, params))

	dbg.sendCommand('Network.enable')
    }

    addWatcher(rule: RegExp, watcher: Watcher) {
	this.watchers.push({ rule: rule, watcher: watcher })
    }
}
