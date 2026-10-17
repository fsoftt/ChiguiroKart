/**
 * Exports every character (procedural, see `src/render/characters`) to `public/models/<id>.glb`.
 * Run with `npm run models` from the repo root; the npm script bundles this file with rolldown and runs it in Node.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { characterIds } from '../src/config/characters'
import { buildCharacterAsset } from '../src/render/characters/buildCharacter'

// GLTFExporter reads blobs through FileReader, which Node does not have
class NodeFileReader {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }

  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
      this.onloadend?.()
    })
  }
}
Object.assign(globalThis, { FileReader: NodeFileReader })

const outDir = new URL('public/models/', `file://${process.cwd()}/`)
await mkdir(outDir, { recursive: true })

for (const id of characterIds) {
  const asset = buildCharacterAsset(id)
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(asset.scene, {
    binary: true,
    animations: asset.animations,
    onlyVisible: true,
  })
  if (!(result instanceof ArrayBuffer)) throw new Error(`Expected a binary glTF for ${id}`)
  await writeFile(new URL(`${id}.glb`, outDir), new Uint8Array(result))
  console.log(`${id}.glb ${(result.byteLength / 1024).toFixed(1)} kB`)
}
