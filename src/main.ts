import { Game } from './game/game'
import { loadCharacterAssets } from './render/characters/characterAssets'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Missing #game canvas')
const gameCanvas = canvas

// The character models are small; wait for them so no kart ever shows up empty
void loadCharacterAssets().then(() => {
  const game = new Game(gameCanvas)
  // Dev only: lets browser tests drive the game (e.g. finish a race without waiting for it)
  if (import.meta.env.DEV) Object.assign(window, { game })
  game.start()
})
