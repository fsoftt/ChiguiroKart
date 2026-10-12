import { Game } from './game/game'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Missing #game canvas')

new Game(canvas).start()
