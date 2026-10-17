import { Game } from './game/game'
import { loadCharacterAssets } from './render/characters/characterAssets'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Missing #game canvas')
const gameCanvas = canvas

// The character models are small; wait for them so no kart ever shows up empty
void loadCharacterAssets().then(() => new Game(gameCanvas).start())
