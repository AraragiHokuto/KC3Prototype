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
	onKeyUp={ev => ev.keyCode === 13 && props.navigate()}
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

    React.useEffect(() => {
	const listener = (_ev: any, url: string) => setVal(url)
	electron.ipcRenderer.on('kc3proto-on-game-navigate', listener)

	return () => {
	    electron.ipcRenderer.removeListener('kc3proto-on-game-navigate', listener)
	}
    })

    return <NavigationArea url={val} onChange={setVal} navigate={() => navigate(val)} />
}

const NavigationDiv = styled.div`
    text-align: center;
    height: 100%;
    flex-grow: 1;
`

const ButtonGroupDiv = styled.div`
    text-align: center;
    width: 600px;
`

const ContainerDiv = styled.div`
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
    padding: 10px;
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
