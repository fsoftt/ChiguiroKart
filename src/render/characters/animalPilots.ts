import { SEAT } from './kartModel'
import { addArms, addLegs, addMouth } from './characterParts'
import { addClaws, headEyes, paint, type Ellipsoid } from './heroParts'
import { cone, gradient, sphere, torus, tube, type ModelKit, type Vec3 } from './modelKit'

/** The other six pilots, built to the same "hero" standard as the Chigüiro and the Oso. */

type Color = Parameters<ModelKit['add']>[2]

/** Eyelid resting angle that leaves the eye wide open, and the travel that closes it. */
const OPEN_LID = -1.75

/** Places the driver bones: neck pivot, ears (or crest) and tail root. */
function driverRig(kit: ModelKit, neck: Vec3, ear: Vec3, tail: Vec3 = [0, 0.85, -0.65]): void {
  kit
    .bone('body', 0, SEAT.y, SEAT.z)
    .bone('head', ...neck)
    .bone('earL', ear[0], ear[1], ear[2])
    .bone('earR', -ear[0], ear[1], ear[2])
    .bone('tail', ...tail)
}

/** One smooth head ellipsoid whose pole faces forward, so the face has no pinched seam. */
function headBall(kit: ModelKit, head: Ellipsoid, color: Color): void {
  const [rx, ry, rz] = head.radii
  kit.add('head', sphere(1, 24), color, {
    position: head.center,
    rotation: [Math.PI / 2, 0, 0],
    scale: [rx, rz, ry],
  })
}

/** Rounded torso ellipsoid on the body bone. */
function torsoBall(kit: ModelKit, torso: Ellipsoid, color: Color): void {
  kit.add('body', sphere(1, 12), color, { position: torso.center, scale: torso.radii })
}

/** Small white-faced monkey (tití): white mask with dark eye rings, cotton-top crest, long curly tail. */
export function titiDriver(kit: ModelKit): void {
  const fur = '#5e4636'
  const furLight = '#8a6a50'
  const white = '#f6f0e4'
  const skin = '#e3a98f'
  const ring = '#3a2b25'
  const head: Ellipsoid = { center: [0, 1.64, -0.08], radii: [0.42, 0.4, 0.44] }
  const torso: Ellipsoid = { center: [0, 1.0, -0.38], radii: [0.38, 0.38, 0.38] }
  driverRig(kit, [0, 1.38, -0.2], [0.4, 1.7, -0.1], [0, 0.9, -0.7])

  torsoBall(kit, torso, gradient('y', 0.62, 1.4, furLight, fur))
  kit.add('body', sphere(1, 10), white, { position: [0, 1.0, -0.04], scale: [0.25, 0.27, 0.13] })
  addLegs(kit, { skin: fur, shoe: '#4a362b', sole: '#2b211c', radius: 0.1, hip: 0.18 })
  addArms(kit, {
    shoulder: [0.34, 1.14, -0.3],
    elbow: [0.46, 0.98, -0.04],
    radii: [0.11, 0.1, 0.085],
    skin: fur,
    hand: '#3a2b25',
    size: 1.3,
  })

  headBall(kit, head, gradient('y', 1.3, 2.04, furLight, fur))
  // White face mask with dark rings around the eyes
  paint(kit, 'head', head, { yaw: 0, pitch: -0.08, a: 0.72, b: 0.7, color: white, segments: 20 })
  paint(
    kit,
    'head',
    head,
    { yaw: 0.39, pitch: 0.15, a: 0.4, b: 0.36, color: ring, lift: 0.01, segments: 16 },
    true,
  )
  kit.add('head', sphere(1, 12), white, { position: [0, 1.51, 0.3], scale: [0.19, 0.15, 0.16] })
  kit.add('head', sphere(1, 10), '#51382f', {
    position: [0, 1.56, 0.45],
    scale: [0.07, 0.05, 0.04],
  })
  addMouth(kit, {
    jawColor: white,
    hinge: [0, 1.5, 0.05],
    jaw: [0, 1.42, 0.28],
    jawSize: [0.14, 0.06, 0.15],
    cavity: [0, 1.45, 0.41],
    cavitySize: [0.08, 0.025, 0.05],
    tongue: true,
  })
  headEyes(kit, head, 0.16, 1.7, 0.1, {
    iris: '#3c2515',
    irisSize: 0.7,
    lid: white,
    lidRest: OPEN_LID,
    brow: ring,
    browSize: 0.9,
    browTilt: -0.25,
    cushion: false,
  })
  // Big round ears
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'earL' : 'earR'
    kit.add(bone, sphere(1, 8), fur, {
      position: [side * 0.41, 1.72, -0.1],
      scale: [0.1, 0.15, 0.15],
    })
    kit.add(bone, sphere(1, 8), skin, {
      position: [side * 0.44, 1.72, -0.07],
      scale: [0.05, 0.1, 0.1],
    })
  }
  // Cotton-top crest sweeping back
  const crest = (side: number, spread: number, lift: number): Vec3[] => [
    [side * 0.04, 1.98, 0.12],
    [side * (0.04 + spread * 0.4), 2.1 + lift, -0.06],
    [side * (0.04 + spread * 0.8), 2.14 + lift, -0.28],
    [side * (0.04 + spread), 2.04 + lift, -0.48],
  ]
  kit.add('head', tube(crest(0, 0, 0.06), [0.07, 0.07, 0.055, 0.015], 5, 4), white)
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'earL' : 'earR'
    kit.add(bone, tube(crest(side, 0.13, 0.02), [0.06, 0.06, 0.045, 0.012], 5, 4), white)
    kit.add(bone, tube(crest(side, 0.25, -0.04), [0.055, 0.055, 0.04, 0.012], 5, 4), white)
  }
  // Long curly tail with a dark tip
  kit.add(
    'tail',
    tube(
      [
        [0, 0.9, -0.7],
        [0, 0.88, -1.15],
        [0.02, 1.25, -1.4],
        [0.05, 1.65, -1.22],
        [0.16, 1.82, -0.95],
        [0.3, 1.7, -0.85],
      ],
      [0.08, 0.075, 0.07, 0.065, 0.06, 0.05],
      8,
      14,
    ),
    fur,
  )
  kit.add('tail', sphere(0.065, 8), ring, { position: [0.3, 1.7, -0.85] })
}

/** Andean condor: black plumage, white ruff, bald wrinkled head with a comb and a hooked beak. */
export function condorDriver(kit: ModelKit): void {
  const black = '#1f1e27'
  const grey = '#3b3a46'
  const skinTop = '#b9605a'
  const skin = '#8f423f'
  const ivory = '#eadfc4'
  const head: Ellipsoid = { center: [0, 1.76, -0.1], radii: [0.38, 0.38, 0.42] }
  const torso: Ellipsoid = { center: [0, 1.0, -0.38], radii: [0.46, 0.44, 0.44] }
  driverRig(kit, [0, 1.46, -0.2], [0.34, 1.78, -0.2], [0, 0.85, -0.7])

  torsoBall(kit, torso, gradient('y', 0.6, 1.4, grey, black))
  addLegs(kit, { skin: '#55505a', shoe: '#6b6670', sole: '#c9c0aa', radius: 0.11, hip: 0.2 })
  addArms(kit, {
    shoulder: [0.4, 1.18, -0.3],
    elbow: [0.54, 1.0, -0.02],
    radii: [0.15, 0.13, 0.11],
    skin: black,
    hand: grey,
    size: 1.35,
  })
  // White wing patches and flight feathers sweeping back
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'armL' : 'armR'
    kit.add(bone, sphere(1, 10), '#f4f0e6', {
      position: [side * 0.55, 1.03, -0.1],
      rotation: [0.2, 0, side * 0.35],
      scale: [0.07, 0.13, 0.17],
    })
    for (const [x, y, z, roll] of [
      [0.58, 1.08, -0.36, 0.2],
      [0.5, 0.98, -0.42, -0.1],
    ] as const) {
      kit.add(bone, sphere(1, 6), black, {
        position: [side * x, y, z],
        rotation: [0.05, 0, side * roll],
        scale: [0.06, 0.07, 0.3],
      })
    }
  }

  // Neck, then the white ruff with a fluffy edge
  kit.add(
    'head',
    tube(
      [
        [0, 1.3, -0.26],
        [0, 1.52, -0.2],
        [0, 1.64, -0.12],
      ],
      [0.17, 0.15, 0.14],
      10,
      4,
    ),
    skin,
  )
  kit.add('body', torus(0.2, 0.1, 14, 6), '#f6f3ea', {
    position: [0, 1.4, -0.26],
    rotation: [Math.PI / 2, 0, 0],
  })
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    kit.add('body', sphere(1, 6), '#f6f3ea', {
      position: [Math.cos(a) * 0.26, 1.36, -0.26 + Math.sin(a) * 0.26],
      rotation: [0, -a, 0],
      scale: [0.11, 0.08, 0.08],
    })
  }

  headBall(kit, head, gradient('y', 1.45, 2.1, '#5e3f4e', '#bd5f5a'))
  // Fleshy comb and wrinkles on the bald head
  kit.add('head', sphere(1, 10), '#7b2d2f', { position: [0, 2.12, 0.06], scale: [0.045, 0.1, 0.2] })
  paint(
    kit,
    'head',
    head,
    { yaw: 0.95, pitch: 0.1, a: 0.35, b: 0.2, color: '#7e3a38', spin: 0.5 },
    true,
  )
  // Hooked beak: upper bill curving down, lower bill on the jaw
  kit.add(
    'head',
    tube(
      [
        [0, 1.72, 0.3],
        [0, 1.7, 0.5],
        [0, 1.62, 0.62],
        [0, 1.5, 0.62],
      ],
      [0.12, 0.1, 0.075, 0.02],
      10,
      8,
      0.85,
    ),
    ivory,
  )
  for (const side of [1, -1] as const) {
    kit.add('head', sphere(1, 8), '#3a342e', {
      position: [side * 0.04, 1.77, 0.5],
      scale: [0.025, 0.02, 0.02],
    })
  }
  addMouth(kit, {
    jawColor: ivory,
    hinge: [0, 1.66, 0.1],
    jaw: [0, 1.58, 0.42],
    jawSize: [0.09, 0.05, 0.19],
    cavity: [0, 1.62, 0.5],
    cavitySize: [0.07, 0.02, 0.07],
  })
  headEyes(kit, head, 0.16, 1.82, 0.1, {
    iris: '#c77a1f',
    irisSize: 0.72,
    lid: skinTop,
    lidRest: OPEN_LID,
    brow: '#6a2b2a',
    browSize: 1.1,
    browTilt: 0.12,
    cushion: false,
  })
  // Tail feathers fanning out behind the seat
  for (const [x, roll] of [
    [0, 0],
    [0.12, -0.25],
    [-0.12, 0.25],
  ] as const) {
    kit.add('tail', sphere(1, 8), black, {
      position: [x, 0.84, -1.0],
      rotation: [0.28, roll, 0],
      scale: [0.09, 0.03, 0.38],
    })
  }
}

/** Jaguar: golden coat with rosettes, cream muzzle, round ears with black backs, ringed tail. */
export function jaguarDriver(kit: ModelKit): void {
  const coat = '#f2b23a'
  const coatLight = '#fad074'
  const cream = '#f8eed9'
  const spot = '#3a2616'
  const head: Ellipsoid = { center: [0, 1.67, -0.08], radii: [0.45, 0.42, 0.5] }
  const torso: Ellipsoid = { center: [0, 1.0, -0.38], radii: [0.46, 0.42, 0.42] }
  driverRig(kit, [0, 1.42, -0.2], [0.36, 1.96, -0.2], [0, 0.85, -0.65])

  torsoBall(kit, torso, gradient('y', 0.62, 1.4, coatLight, coat))
  kit.add('body', sphere(1, 10), cream, { position: [0, 1.02, -0.02], scale: [0.28, 0.3, 0.14] })
  addLegs(kit, { skin: coat, shoe: cream, sole: '#4a3626', radius: 0.12, hip: 0.2 })
  addArms(kit, {
    shoulder: [0.4, 1.18, -0.3],
    elbow: [0.52, 1.0, -0.02],
    radii: [0.14, 0.13, 0.11],
    skin: coat,
    hand: cream,
    size: 1.4,
  })

  headBall(kit, head, gradient('y', 1.3, 2.05, coatLight, coat))
  // Rosettes painted on the back and shoulders of the torso
  for (const [yaw, pitch, size] of [
    [2.5, 0.2, 0.2],
    [3.3, 0.35, 0.22],
    [2.9, -0.2, 0.2],
    [3.6, -0.15, 0.2],
    [1.9, 0.45, 0.18],
    [1.5, 0.05, 0.17],
    [2.1, -0.4, 0.17],
    [0.9, 0.5, 0.16],
  ] as const) {
    for (const sign of [1, -1] as const) {
      paint(kit, 'body', torso, {
        yaw: yaw * sign,
        pitch,
        a: size * 1.4,
        b: size * 1.2,
        color: spot,
        hole: 0.5,
        segments: 10,
      })
    }
  }
  // Spots on top and back of the head
  for (const [yaw, pitch, size] of [
    [0.55, 1.0, 0.1],
    [1.3, 0.8, 0.1],
    [2.2, 0.7, 0.1],
    [2.9, 0.4, 0.11],
    [1.9, 0.2, 0.09],
    [0.0, 1.25, 0.09],
    [3.14, 0.9, 0.1],
  ] as const) {
    paint(
      kit,
      'head',
      head,
      { yaw, pitch, a: size * 1.5, b: size * 1.5, color: spot, segments: 8 },
      true,
    )
  }
  // Cream muzzle, black nose
  kit.add('head', sphere(1, 12), cream, { position: [0, 1.54, 0.32], scale: [0.21, 0.15, 0.2] })
  kit.add('head', sphere(1, 12), '#2b1a1a', {
    position: [0, 1.6, 0.51],
    scale: [0.1, 0.065, 0.05],
  })
  addMouth(kit, {
    jawColor: cream,
    hinge: [0, 1.5, 0.0],
    jaw: [0, 1.42, 0.34],
    jawSize: [0.22, 0.09, 0.2],
    cavity: [0, 1.45, 0.5],
    cavitySize: [0.1, 0.03, 0.06],
    tongue: true,
  })
  headEyes(kit, head, 0.2, 1.76, 0.1, {
    iris: '#b9c43a',
    irisSize: 0.7,
    lid: coat,
    lidRest: OPEN_LID,
    brow: spot,
    browSize: 1,
    browTilt: 0.22,
    cushion: false,
  })
  // Round ears: golden front, black back with a white spot
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'earL' : 'earR'
    kit.add(bone, sphere(1, 8), '#241a14', {
      position: [side * 0.37, 1.97, -0.23],
      scale: [0.15, 0.15, 0.07],
    })
    kit.add(bone, sphere(1, 8), cream, {
      position: [side * 0.37, 1.99, -0.29],
      scale: [0.07, 0.06, 0.03],
    })
    kit.add(bone, sphere(1, 8), coat, {
      position: [side * 0.37, 1.97, -0.19],
      scale: [0.14, 0.14, 0.07],
    })
    kit.add(bone, sphere(1, 8), '#e9a9a0', {
      position: [side * 0.37, 1.97, -0.14],
      scale: [0.08, 0.08, 0.04],
    })
  }
  // Thick tail curling up with a black tip
  kit.add(
    'tail',
    tube(
      [
        [0, 0.86, -0.68],
        [0, 0.8, -1.1],
        [0.14, 0.95, -1.45],
        [0.36, 1.25, -1.5],
      ],
      [0.11, 0.1, 0.095, 0.09],
      8,
      10,
    ),
    coat,
  )
  kit.add('tail', sphere(0.095, 8), '#241a14', { position: [0.36, 1.27, -1.5] })
}

/** Scarlet macaw: red plumage, bare white face patch, big ivory beak, yellow and blue wings. */
export function guacamayaDriver(kit: ModelKit): void {
  const red = '#e0262b'
  const redLight = '#ff5a48'
  const yellow = '#ffcc1a'
  const blue = '#1f6fe0'
  const ivory = '#f0e6d0'
  const head: Ellipsoid = { center: [0, 1.67, -0.08], radii: [0.43, 0.42, 0.46] }
  const torso: Ellipsoid = { center: [0, 1.0, -0.38], radii: [0.42, 0.42, 0.42] }
  driverRig(kit, [0, 1.42, -0.2], [0.14, 2.0, -0.2], [0, 0.85, -0.68])

  torsoBall(kit, torso, gradient('y', 0.62, 1.4, redLight, red))
  kit.add('body', sphere(1, 10), '#ff7a5c', {
    position: [0, 1.02, -0.02],
    scale: [0.26, 0.3, 0.13],
  })
  addLegs(kit, { skin: '#8a857c', shoe: '#6f6a62', sole: '#3c3934', radius: 0.1, hip: 0.19 })
  addArms(kit, {
    shoulder: [0.38, 1.18, -0.3],
    elbow: [0.5, 1.0, -0.02],
    radii: [0.13, 0.12, 0.1],
    skin: red,
    hand: blue,
    size: 1.3,
  })
  // Yellow and blue wing feathers swept back along each arm
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'armL' : 'armR'
    kit.add(bone, sphere(1, 10), yellow, {
      position: [side * 0.55, 1.07, -0.22],
      rotation: [0.15, 0, side * 0.2],
      scale: [0.06, 0.1, 0.26],
    })
    kit.add(bone, sphere(1, 10), blue, {
      position: [side * 0.56, 0.96, -0.3],
      rotation: [0.15, 0, side * 0.2],
      scale: [0.06, 0.09, 0.3],
    })
  }

  headBall(kit, head, gradient('y', 1.3, 2.08, redLight, red))
  // Bare white face patch around each eye, with fine feather lines
  paint(
    kit,
    'head',
    head,
    { yaw: 0.62, pitch: 0.25, a: 0.55, b: 0.5, color: '#fbf6ee', segments: 18 },
    true,
  )
  for (const row of [-0.08, 0.06]) {
    paint(
      kit,
      'head',
      head,
      {
        yaw: 0.72,
        pitch: 0.25 + row * 2,
        a: 0.3,
        b: 0.015,
        color: '#d9c9b3',
        lift: 0.01,
        segments: 8,
      },
      true,
    )
  }
  // Big curved beak with a dark lower bill
  kit.add(
    'head',
    tube(
      [
        [0, 1.74, 0.32],
        [0, 1.75, 0.52],
        [0, 1.65, 0.7],
        [0, 1.46, 0.72],
      ],
      [0.16, 0.15, 0.12, 0.025],
      10,
      9,
      1.1,
    ),
    ivory,
  )
  for (const side of [1, -1] as const) {
    kit.add('head', sphere(1, 8), '#3a3430', {
      position: [side * 0.05, 1.8, 0.47],
      scale: [0.025, 0.02, 0.02],
    })
  }
  addMouth(kit, {
    jawColor: '#4b4540',
    hinge: [0, 1.6, 0.12],
    jaw: [0, 1.5, 0.45],
    jawSize: [0.11, 0.07, 0.19],
    cavity: [0, 1.55, 0.52],
    cavitySize: [0.08, 0.02, 0.08],
  })
  headEyes(kit, head, 0.25, 1.78, 0.1, {
    iris: '#e8a21c',
    irisSize: 0.7,
    lid: '#fbf6ee',
    lidRest: OPEN_LID,
    brow: red,
    browSize: 0.8,
    browTilt: -0.1,
    cushion: false,
  })
  // Long tail feathers behind the seat
  for (const [x, color, roll, length] of [
    [0, red, 0, 0.55],
    [0.12, blue, -0.2, 0.48],
    [-0.12, yellow, 0.2, 0.48],
  ] as const) {
    kit.add('tail', sphere(1, 8), color, {
      position: [x, 0.8, -1.1],
      rotation: [0.32, roll, 0],
      scale: [0.07, 0.025, length],
    })
  }
}

/** Pink river dolphin: round melon forehead, long snout, flippers for hands and a fluke tail. */
export function delfinDriver(kit: ModelKit): void {
  const pink = '#f29bb6'
  const pinkLight = '#f9bfd2'
  const belly = '#fcdde6'
  const pinkDark = '#d96f93'
  const head: Ellipsoid = { center: [0, 1.67, -0.08], radii: [0.44, 0.4, 0.46] }
  const torso: Ellipsoid = { center: [0, 1.0, -0.38], radii: [0.44, 0.42, 0.42] }
  driverRig(kit, [0, 1.4, -0.2], [0.42, 1.65, -0.05], [0, 0.85, -0.68])

  torsoBall(kit, torso, gradient('y', 0.62, 1.4, pinkLight, pink))
  kit.add('body', sphere(1, 10), belly, { position: [0, 1.02, -0.02], scale: [0.28, 0.3, 0.13] })
  kit.add('body', cone(0.12, 0.34, 8), pinkDark, {
    position: [0, 1.38, -0.7],
    rotation: [-0.5, 0, 0],
    scale: [0.45, 1, 1],
  })
  addLegs(kit, { skin: pink, shoe: pinkDark, sole: '#f6e3ea', radius: 0.11, hip: 0.19 })
  addArms(kit, {
    shoulder: [0.4, 1.18, -0.3],
    elbow: [0.52, 1.0, -0.02],
    radii: [0.14, 0.13, 0.11],
    skin: pink,
    hand: pinkLight,
    size: 1.4,
  })
  // Broad flippers along the arms
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'armL' : 'armR'
    kit.add(bone, sphere(1, 8), pinkDark, {
      position: [side * 0.56, 1.0, -0.12],
      rotation: [0.3, 0, side * 0.5],
      scale: [0.05, 0.2, 0.12],
    })
  }

  headBall(kit, head, gradient('y', 1.3, 2.05, pinkLight, pink))
  // Round melon forehead
  kit.add('head', sphere(1, 12), pinkLight, { position: [0, 1.95, 0.1], scale: [0.34, 0.26, 0.33] })
  // Long snout (rostrum): upper part on the head, lower jaw on the jaw bone
  kit.add(
    'head',
    tube(
      [
        [0, 1.56, 0.2],
        [0, 1.55, 0.55],
        [0, 1.53, 0.95],
      ],
      [0.22, 0.16, 0.09],
      12,
      6,
      0.8,
    ),
    pinkLight,
  )
  kit.add('head', sphere(1, 10), '#6a3a48', {
    position: [0, 1.55, 1.01],
    scale: [0.04, 0.04, 0.03],
  })
  addMouth(kit, {
    jawColor: belly,
    inside: '#8a3550',
    hinge: [0, 1.47, 0.1],
    jaw: [0, 1.41, 0.56],
    jawSize: [0.12, 0.06, 0.4],
    cavity: [0, 1.46, 0.6],
    cavitySize: [0.09, 0.02, 0.36],
    tongue: true,
  })
  // Smile line along the snout
  for (const side of [1, -1] as const) {
    kit.add(
      'head',
      tube(
        [
          [side * 0.065, 1.455, 0.92],
          [side * 0.12, 1.45, 0.6],
          [side * 0.185, 1.5, 0.3],
          [side * 0.2, 1.57, 0.2],
        ],
        [0.008, 0.012, 0.012, 0.008],
        5,
        8,
      ),
      '#a94a6c',
    )
  }
  // Rosy cheeks
  paint(kit, 'head', head, { yaw: 0.78, pitch: -0.2, a: 0.24, b: 0.17, color: '#f47a9e' }, true)
  headEyes(kit, head, 0.27, 1.76, 0.09, {
    iris: '#2c1a22',
    irisSize: 0.75,
    pupil: false,
    lid: pink,
    lidRest: OPEN_LID,
    brow: pinkDark,
    browSize: 0.9,
    browTilt: -0.15,
    cushion: false,
  })
  // Tail fluke behind the seat
  kit.add(
    'tail',
    tube(
      [
        [0, 0.86, -0.7],
        [0, 0.82, -0.95],
        [0, 0.85, -1.1],
      ],
      [0.12, 0.09, 0.07],
      8,
      4,
    ),
    pink,
  )
  for (const side of [1, -1] as const) {
    kit.add('tail', sphere(1, 10), pinkDark, {
      position: [side * 0.19, 0.86, -1.18],
      rotation: [0.1, side * 0.5, side * 0.15],
      scale: [0.2, 0.035, 0.12],
    })
  }
}

/** Sloth: shaggy fur, pale face with dark eye patches, sleepy eyes and long curved claws. */
export function perezosoDriver(kit: ModelKit): void {
  const fur = '#8f7d64'
  const furLight = '#b09c80'
  const face = '#eadfc4'
  const patch = '#4a3a2a'
  const moss = '#7f9a52'
  const head: Ellipsoid = { center: [0, 1.67, -0.08], radii: [0.47, 0.42, 0.46] }
  const torso: Ellipsoid = { center: [0, 1.0, -0.38], radii: [0.46, 0.43, 0.43] }
  driverRig(kit, [0, 1.42, -0.2], [0.42, 1.86, -0.15], [0, 0.88, -0.7])

  torsoBall(kit, torso, gradient('y', 0.6, 1.4, furLight, fur))
  kit.add('body', sphere(1, 8), face, { position: [0, 1.0, -0.02], scale: [0.27, 0.3, 0.13] })
  // Shaggy fur clumps and moss on the back
  for (const [x, y, z, s] of [
    [0.34, 1.2, -0.5, 0.15],
    [0.4, 0.92, -0.45, 0.14],
    [0.18, 1.34, -0.6, 0.14],
  ] as const) {
    kit.addMirrored('body', 'body', sphere(1, 6), furLight, {
      position: [x, y, z],
      rotation: [0.3, 0, 0.4],
      scale: [s * 0.8, s * 1.3, s * 0.8],
    })
  }
  kit.add('body', sphere(1, 6), moss, { position: [0.12, 1.42, -0.6], scale: [0.14, 0.07, 0.1] })
  kit.add('body', sphere(1, 6), moss, { position: [-0.2, 1.25, -0.74], scale: [0.1, 0.06, 0.08] })
  addLegs(kit, { skin: fur, shoe: furLight, sole: patch, radius: 0.12, hip: 0.2 })
  addArms(kit, {
    shoulder: [0.4, 1.18, -0.3],
    elbow: [0.54, 1.0, -0.02],
    radii: [0.15, 0.14, 0.12],
    skin: fur,
    hand: furLight,
    size: 1.4,
  })
  for (const side of [1, -1] as const) {
    addClaws(kit, side === 1 ? 'armL' : 'armR', side, '#f2ead2', 1.4, 1.35)
  }

  headBall(kit, head, gradient('y', 1.3, 2.05, furLight, fur))
  // Pale face with the dark mask stripes running down from the eyes
  paint(kit, 'head', head, { yaw: 0, pitch: -0.12, a: 0.85, b: 0.7, color: face, segments: 20 })
  paint(
    kit,
    'head',
    head,
    {
      yaw: 0.44,
      pitch: 0.02,
      a: 0.42,
      b: 0.17,
      color: patch,
      spin: -0.5,
      lift: 0.01,
      segments: 16,
    },
    true,
  )
  kit.add('head', sphere(1, 8), face, { position: [0, 1.53, 0.3], scale: [0.2, 0.15, 0.18] })
  kit.add('head', sphere(1, 8), '#2b211c', {
    position: [0, 1.6, 0.46],
    scale: [0.09, 0.065, 0.05],
  })
  addMouth(kit, {
    jawColor: face,
    hinge: [0, 1.5, 0.05],
    jaw: [0, 1.43, 0.3],
    jawSize: [0.16, 0.07, 0.15],
    cavity: [0, 1.46, 0.43],
    cavitySize: [0.09, 0.025, 0.05],
  })
  // Contented smile
  const smile: Vec3[] = []
  for (let i = 0; i <= 8; i++) {
    const x = ((i - 4) / 4) * 0.14
    const y = 1.46 + 0.06 * (x / 0.14) ** 2
    smile.push([x, y, 0.45 - 0.1 * Math.abs(x) + 0.015])
  }
  kit.add('head', tube(smile, [0.011], 4, 8), patch)
  headEyes(kit, head, 0.2, 1.74, 0.085, {
    iris: '#20150f',
    irisSize: 0.8,
    pupil: false,
    lid: patch,
    lidRest: -0.35,
    brow: patch,
    browSize: 0.8,
    browTilt: -0.12,
    cushion: false,
    highlights: 1,
  })
  // Little round ears and a shaggy fur tuft on top
  for (const side of [1, -1] as const) {
    const bone = side === 1 ? 'earL' : 'earR'
    kit.add(bone, sphere(1, 8), fur, {
      position: [side * 0.42, 1.86, -0.15],
      scale: [0.09, 0.1, 0.07],
    })
  }
  kit.add(
    'head',
    tube(
      [
        [0, 2.02, 0.06],
        [0, 2.1, -0.06],
        [0, 2.06, -0.22],
      ],
      [0.08, 0.065, 0.02],
      5,
      3,
    ),
    furLight,
  )
  // A fluffy tail stub
  kit.add('tail', sphere(1, 8), furLight, { position: [0, 0.9, -0.82], scale: [0.14, 0.14, 0.16] })
}
