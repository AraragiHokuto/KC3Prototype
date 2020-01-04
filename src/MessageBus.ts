import electron, { WebFrame, webContents } from 'electron'

// necessary info to find route to a specific client
interface Route {
    contentId: number
    frameId: number
}

const logToMain = (...args: any[]) => {
    if (electron.ipcRenderer) {
	electron.ipcRenderer.send('renderer-logging', ...args)
    } else {
	console.log(...args)
    }
}

// bus server class. running in main process.
export class MessageBusServer {
    private clients: Route[] = []

    constructor() {
	electron.ipcMain.addListener('message-bus-broadcast', (_ev, sender: Route, ...msg) => {
	    // routing msg to all clients
	    this.clients.map(item => {
		let content = electron.webContents.fromId(item.contentId)
		content && content.sendToFrame(item.frameId, 'message-bus-broadcast', sender, ...msg)
	    })
	})
	electron.ipcMain.addListener('message-bus-specific', (_ev, sender: Route, id: number, receiver: Route | number, ...msg) => {
	    let frames: number[] = []
	    let content: webContents
	    if (typeof(receiver) === 'number') {
		content = electron.webContents.fromId(receiver)
		// forward to all frames in specific content
		frames = this.clients.filter(item => item.contentId == receiver).map(item => item.frameId)
	    } else {
		content = electron.webContents.fromId(receiver.contentId)
		// directly forward to specific frame
		frames = [receiver.frameId]
	    }
	    frames.map(
		frameId => content.sendToFrame(frameId, 'message-bus-specific', sender, id, ...msg)
	    )
	})
	electron.ipcMain.addListener('message-bus-reply', (_ev, _sender, _id, receiver: Route, ...msg) => {
	    // directly send to receiver
	    electron.webContents.fromId(receiver.contentId).sendToFrame(receiver.frameId, 'message-bus-reply', ...msg)
	})

	// new client event
	electron.ipcMain.addListener('message-bus-new-client', (_ev, client: Route) => {
	    this.clients.find(item => item.contentId == client.contentId && item.frameId == client.frameId)
		|| this.clients.push(client)
	})
    }
}

// bus client class. running in renderer processes
export class MessageBusClient {
    private nextId: number = 0
    private listeners: any[] = [] 

    private pendingReplies: { [key: number]: any } = {}

    private getRoute() {
	return {
	    contentId: electron.remote.getCurrentWebContents().id,
	    frameId: electron.webFrame.routingId
	}
    }

    private allocId() {
	this.nextId += 1
	return this.nextId
    }

    private sendToBus(id: number, channel: string, ...args: any[]): number
    private sendToBus(channel: string, ...args: any[]): number
    private sendToBus(id_or_channel: number | string, maybe_channel: string | any, ...args:any[]) {
	let id, channel
	if (typeof(id_or_channel) === 'number') {
	    id = id_or_channel
	    channel = maybe_channel as string
	} else {
	    id = this.allocId()
	    channel = id_or_channel
	    args = [maybe_channel].concat(args)
	}
	electron.ipcRenderer.send(channel, this.getRoute(), id, ...args)
	return id
    }

    private createReplyPromise(id: number) {
	return new Promise<any | undefined>(resolve => {
	    this.pendingReplies[id] = (hasReply: boolean, reply: any) => {
		hasReply && (resolve(reply), delete this.pendingReplies[id])
	    }
	})
    }
    
    constructor() {
	electron.ipcRenderer.on('message-bus-broadcast', (_ev, sender, id, msg) => {
	    let asyncReply = false
	    this.listeners.map(callback => {
		asyncReply = callback(
		    msg, {},
		    (reply: any) => this.sendToBus('message-bus-reply', sender, id, true, reply)
		) || asyncReply
	    })
	    if (!asyncReply)
		this.sendToBus('message-bus-reply', sender, id, false)
	})
	
	electron.ipcRenderer.on('message-bus-specific', (_ev, sender, id, msg) => {
	    let asyncReply = false
	    this.listeners.map(callback => {
		asyncReply = callback(msg, {}, (reply: any) =>
				      this.sendToBus('message-bus-reply', sender, id, true, reply)) || asyncReply
	    })
	    if (!asyncReply)
		this.sendToBus('message-bus-reply', sender, id, false)
	})

	electron.ipcRenderer.on('message-bus-reply', (_ev, id, hasReply, reply) => {
	    let handler = this.pendingReplies[id] 
	    handler && handler(hasReply, reply)
	})

	this.sendToBus('message-bus-new-client')
    }

    addListener(callback: any) {
	this.listeners.push(callback)
    }

    broadcast(msg: any): void
    broadcast(msg: any, waitReply: false): void
    broadcast(msg: any, waitReply: true): Promise<any>
    broadcast(msg: any, waitReply: boolean): Promise<any> | void
    
    broadcast(msg: any, waitReply: boolean = false) {
	let id = this.sendToBus('message-bus-broadcast', msg)
	return waitReply ? this.createReplyPromise(id) : undefined
    }

    specific(msg: any, waitReply: true, contentId: number, frameId?: number): Promise<any>;
    specific(msg: any, waitReply: false, contentId: number, frameId?: number): void;
    specific(msg: any, waitReply: boolean, contentId: number, frameId?: number): Promise<any> | void;
    
    specific(msg: any, waitReply: boolean, contentId: number, frameId?: number) {
	let receiver = {
	    contentId: contentId,
	    frameId: frameId
	}
	let id = this.sendToBus('message-bus-specific', frameId ? receiver : contentId, msg)
	return waitReply ? this.createReplyPromise(id) : undefined
    }
}
