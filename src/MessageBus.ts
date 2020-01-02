import electron from 'electron'

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
	    logToMain(sender, ...msg)
	    this.clients.map(item => {
		electron.webContents
		    .fromId(item.contentId)
		    .sendToFrame(item.frameId, 'message-bus-broadcast', sender, ...msg)
	    })
	})
	electron.ipcMain.addListener('message-bus-specific', (_ev, sender: Route, id, receiver: Route, ...msg) => {
	    // directly send to receiver
	    electron.webContents.fromId(receiver.contentId).sendToFrame(receiver.frameId, 'message-bus-specific', sender, id, ...msg)
	})
	electron.ipcMain.addListener('message-bus-specific-main', (_ev, sender: Route, id, receiver: number, ...msg) => {
	    logToMain(`specific-main ${JSON.stringify(msg)}`)
	    // hack: send to all frames under the specific webContents
	    let content = electron.webContents.fromId(receiver)
	    this.clients.filter(item => item.contentId == receiver)
		.map(item => {
		    content.sendToFrame(item.frameId, 'message-bus-specific', sender, id, ...msg)
		})
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

    private sendToBus(channel: string, ...args:any[]) {
	let id = this.allocId()
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
	    logToMain(`recvMsg broadcast: ${sender.contentId} ${sender.frameId} ${JSON.stringify(msg)}`)
	    let asyncReply = false
	    this.listeners.map(callback => {
		asyncReply = asyncReply || callback(msg, {}, (reply: any) =>
						    this.sendToBus('message-bus-reply', sender, id, true, reply))
	    })
	    if (!asyncReply)
		this.sendToBus('message-bus-reply', sender, id, false)
	})
	
	electron.ipcRenderer.on('message-bus-specific', (_ev, sender, id, msg) => {
	    let asyncReply = false
	    this.listeners.map(callback => {
		asyncReply = asyncReply || callback(msg, {}, (reply: any) =>
						    this.sendToBus('message-bus-reply', sender, id, reply))
	    })
	    if (!asyncReply)
		this.sendToBus('message-bus-reply', sender, id, false)
	})

	electron.ipcRenderer.on('message-bus-reply', (_ev, id, hasReply, reply) => {
	    logToMain(`recvMsg: reply: ${JSON.stringify(hasReply)} ${JSON.stringify(reply)}`)
	    let handler = this.pendingReplies[id] 
	    handler && handler(hasReply, reply)
	})

	this.sendToBus('message-bus-new-client')
    }

    addListener(callback: any) {
	this.listeners.push(callback)
    }

    broadcast(msg: any, waitReply: boolean) {
	let id = this.sendToBus('message-bus-broadcast', msg)
	return waitReply ? this.createReplyPromise(id) : undefined
    }

    specific(msg: any, waitReply: boolean, contentId: number, frameId?: number) {
	let channel, receiver
	if (frameId) {
	    channel = 'message-bus-specific'
	    receiver = {
		contentId: contentId,
		frameId: frameId
	    }
	} else {
	    channel = 'message-bus-specific-main'
	    receiver = contentId
	}
	logToMain(`specific-send: ${receiver}`)
	let id = this.sendToBus(channel, receiver, msg)
	return waitReply ? this.createReplyPromise(id) : undefined
    }
}
