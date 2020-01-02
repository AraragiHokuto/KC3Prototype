import electron from 'electron'

import React from 'react'
import ReactDOM from 'react-dom'

import { InputGroup, ButtonGroup, Button } from '@blueprintjs/core'
import styled from 'styled-components'

interface NavigationAreaProps {
    url: string,
    onChange: (url: string) => void
    navigate: () => void
}

const NavigationArea = (props: NavigationAreaProps) => {
    return (
	<InputGroup
	fill={true}
	value={props.url}
	onChange={(ev: any) => props.onChange(ev.target.value)}
	rightElement={
	    <Button minimal={true} icon="arrow-right" onClick={props.navigate} />
	}/>
    )
}

const navigate = (url: string) => {
    electron.ipcRenderer.send('kc3proto-game-navigate', url)
}

const NavigationWrapper = () => {
    const [val, setVal] = React.useState<string>('')
    electron.ipcRenderer.on('kc3proto-on-game-navigate', (_ev, url) => {
	setVal(url)
    })

    return <NavigationArea url={val} onChange={setVal} navigate={() => navigate(val)} />
}

const NavigationDiv = styled.div`
    text-align: center;
    width: 1200px;
    height: 100%;
`

const ButtonGroupDiv = styled.div`
    text-align: center;
    flex-grow: 1;
`

const ContainerDiv = styled.div`
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%:
`

const openWindow = (url: string) => {
    electron.ipcRenderer.send('kc3proto-open-window', url)
}

const navigateToHome = () => {
    electron.ipcRenderer.send('kc3proto-game-navigate', 'file:///pages/game/direct.html')
}

const IndexButtonGroup = () => {
    return (
	<ButtonGroup>
	    <Button icon="home" onClick={navigateToHome}>Back to Start Page</Button>
	    <Button icon="database" onClick={() => openWindow('file:///pages/strategy/strategy.html') }>Strategy room</Button>
	    <Button icon="settings" onClick={() => openWindow('file:///pages/settings/settings.html') }>KC3Kai Settings</Button>
	</ButtonGroup>
    )
}

const IndexTopBar = () => {
    return (
	<ContainerDiv>
	    <NavigationDiv>
		<NavigationWrapper />
	    </NavigationDiv>
	    <ButtonGroupDiv>
		<IndexButtonGroup />
	    </ButtonGroupDiv>
	</ContainerDiv>
    )
}

let container = document.querySelector('#react-container')
ReactDOM.render(
    <IndexTopBar />,
    container
)
