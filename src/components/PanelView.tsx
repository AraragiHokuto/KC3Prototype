import React from 'react'
import ReactDOM from 'react-dom'
import { Tab, Tabs, FormGroup, Switch, InputGroup, Button } from "@blueprintjs/core"
import styled from 'styled-components'
import { ipcRenderer } from 'electron'
import fs from 'fs'
import path from 'path'

interface Panel {
    name: string
    url: string
}

const WrapperDiv = styled.div`
    width: 100%;
    padding: 10px;
`

const ConfigPanel = () => {
    console.log(__dirname)
    let initConfig = JSON.parse(fs.readFileSync('./config.json', 'utf8'))
    const [proxyURL, setProxyURL] = React.useState<string>(initConfig.proxyConfig ? initConfig.proxyConfig.proxyRules : '')
    const [useProxy, setUseProxy] = React.useState<boolean>(!!initConfig.proxyConfig)

    const submit = () => {
	ipcRenderer.send('kc3proto-update-config',
			 {
			     proxyConfig: useProxy ? {
				 proxyRules: proxyURL
			     } : undefined
			 }
	)
    }
    
    return (
	<WrapperDiv>
	    <FormGroup>
		<Switch checked={useProxy} onChange={ev => setUseProxy((ev.target as HTMLInputElement).checked)} label="Use Proxy" />
	    </FormGroup>
	    <FormGroup>
		<InputGroup
		disabled={!useProxy}
		onKeyUp={ev => ev.keyCode === 13 && submit()}
		onChange={(ev: React.FormEvent<HTMLInputElement>) => setProxyURL((ev.target as HTMLInputElement).value)}
		value={proxyURL}
		/>
	    </FormGroup>
	</WrapperDiv>
    )
}

const PanelIFrame = styled.iframe`
    width: 100%;
    height: 650px;
    border: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
`

const PanelView = () => {
    const [panels,  setPanels] = React.useState<Panel[]>([])
    const [currentPanel, setCurrentPanel] = React.useState<string | number>('config')

    ipcRenderer.on('kc3proto-add-panel', (_ev, panel: Panel) => {
	setPanels(panels.concat([panel]))
	setCurrentPanel(panel.url)
    })
    
    return (
	<Tabs id="panelView" onChange={newTabId => setCurrentPanel(newTabId)} selectedTabId={currentPanel}>
	    <Tab key="config" id="config" title="KC3Prototype Configure" panel={<ConfigPanel />} />
	    {
		panels.map(panel => (
		    <Tab key={panel.url} id={panel.url} title={panel.name} panel={
			<PanelIFrame scrolling="no" src={`kc3kai/src/${panel.url}`} />
		    } />
		))
	    }
	</Tabs>
    )
}

const container = document.querySelector('#react-container')
ReactDOM.render(
    <PanelView />,
    container
)
