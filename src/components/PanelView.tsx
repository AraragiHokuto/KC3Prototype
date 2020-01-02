import React from 'react'
import ReactDOM from 'react-dom'
import { Tab, Tabs } from "@blueprintjs/core"
import styled from 'styled-components'
import { ipcRenderer } from 'electron'

interface Panel {
    name: string
    url: string
}

const PanelIFrame = styled.iframe`
    width: 100%;
    height: 100%;
    border: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
`

const PanelView = () => {
    const [panels,  setPanels] = React.useState<Panel[]>([])

    ipcRenderer.on('kc3proto-add-panel', (_ev, panel: Panel) => {
	setPanels(panels.concat([panel]))
    })
    
    return (
	<Tabs id="panelView" defaultSelectedTabId={panels.length ? panels[panels.length-1].url : undefined}>
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
