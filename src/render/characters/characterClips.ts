import * as THREE from 'three'
import type { CharacterModelSpec, DanceStyle } from './characterModels'
import type { ClipName, DriverBone } from './rig'

type Euler = readonly [number, number, number]
type Offset = readonly [number, number, number]

/** Keyframes of one bone: rotations (rad, XYZ) and optional position offsets from bind pose. */
interface BoneKeys {
  rotations?: readonly Euler[]
  offsets?: readonly Offset[]
}

type Pose = Partial<Record<DriverBone, BoneKeys>>

/** Builds a clip from evenly spaced keyframes over `duration` (first key repeated at the end). */
function clip(
  name: ClipName,
  duration: number,
  pose: Pose,
  bindPosition: (bone: DriverBone) => THREE.Vector3,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = []
  const times = (count: number): number[] =>
    Array.from({ length: count + 1 }, (_, i) => (i / count) * duration)
  for (const [bone, keys] of Object.entries(pose) as [DriverBone, BoneKeys][]) {
    if (keys.rotations) {
      const values: number[] = []
      const loop = [...keys.rotations, keys.rotations[0] ?? [0, 0, 0]]
      for (const [x, y, z] of loop) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z))
        values.push(q.x, q.y, q.z, q.w)
      }
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${bone}.quaternion`,
          times(keys.rotations.length),
          values,
        ),
      )
    }
    if (keys.offsets) {
      const base = bindPosition(bone)
      const values: number[] = []
      const loop = [...keys.offsets, keys.offsets[0] ?? [0, 0, 0]]
      for (const [x, y, z] of loop) values.push(base.x + x, base.y + y, base.z + z)
      tracks.push(
        new THREE.VectorKeyframeTrack(`${bone}.position`, times(keys.offsets.length), values),
      )
    }
  }
  return new THREE.AnimationClip(name, duration, tracks)
}

/** A still pose held by a looping clip (for blending by weight). */
function hold(rotations: Partial<Record<DriverBone, Euler>>): Pose {
  const pose: Pose = {}
  for (const [bone, rotation] of Object.entries(rotations) as [DriverBone, Euler][]) {
    pose[bone] = { rotations: [rotation, rotation] }
  }
  return pose
}

function dance(style: DanceStyle): { duration: number; pose: Pose } {
  switch (style) {
    case 'cumbia':
      // Side-to-side hip sway with alternating arms
      return {
        duration: 1.2,
        pose: {
          body: {
            rotations: [
              [0, 0.2, -0.2],
              [0, 0, 0],
              [0, -0.2, 0.2],
              [0, 0, 0],
            ],
            offsets: [
              [0, 0, 0],
              [0, 0.05, 0],
              [0, 0, 0],
              [0, 0.05, 0],
            ],
          },
          head: {
            rotations: [
              [0, -0.2, 0.15],
              [0.1, 0, 0],
              [0, 0.2, -0.15],
              [0.1, 0, 0],
            ],
          },
          armL: {
            rotations: [
              [-2.4, 0, -0.3],
              [-1.2, 0, 0],
              [-0.6, 0, 0.2],
              [-1.2, 0, 0],
            ],
          },
          armR: {
            rotations: [
              [-0.6, 0, -0.2],
              [-1.2, 0, 0],
              [-2.4, 0, 0.3],
              [-1.2, 0, 0],
            ],
          },
          tail: {
            rotations: [
              [0, 0.5, 0],
              [0, 0, 0],
              [0, -0.5, 0],
              [0, 0, 0],
            ],
          },
        },
      }
    case 'champeta':
      // Fast bouncing with pumping fists
      return {
        duration: 0.6,
        pose: {
          body: {
            rotations: [
              [0.15, 0, 0],
              [-0.1, 0, 0],
            ],
            offsets: [
              [0, -0.04, 0],
              [0, 0.1, 0],
            ],
          },
          head: {
            rotations: [
              [0.3, 0, 0],
              [-0.2, 0, 0],
            ],
          },
          armL: {
            rotations: [
              [-2.8, 0, -0.4],
              [-1.6, 0, -0.2],
            ],
          },
          armR: {
            rotations: [
              [-1.6, 0, 0.2],
              [-2.8, 0, 0.4],
            ],
          },
          earL: {
            rotations: [
              [0.3, 0, 0],
              [-0.4, 0, 0],
            ],
          },
          earR: {
            rotations: [
              [0.3, 0, 0],
              [-0.4, 0, 0],
            ],
          },
          tail: {
            rotations: [
              [0.5, 0, 0],
              [-0.3, 0, 0],
            ],
          },
        },
      }
    case 'joropo':
      // Stomping zapateo with arms open, waving like holding a hat
      return {
        duration: 1.0,
        pose: {
          body: {
            rotations: [
              [0, 0.3, 0],
              [0.1, 0, 0],
              [0, -0.3, 0],
              [0.1, 0, 0],
            ],
            offsets: [
              [0, 0.08, 0],
              [0, -0.02, 0],
              [0, 0.08, 0],
              [0, -0.02, 0],
            ],
          },
          head: {
            rotations: [
              [0, 0.3, 0],
              [0.15, 0, 0],
              [0, -0.3, 0],
              [0.15, 0, 0],
            ],
          },
          armL: {
            rotations: [
              [-2.6, 0, -0.9],
              [-1.8, 0, -1.1],
              [-2.6, 0, -0.9],
              [-1.8, 0, -1.1],
            ],
          },
          armR: {
            rotations: [
              [-1.8, 0, 1.1],
              [-2.6, 0, 0.9],
              [-1.8, 0, 1.1],
              [-2.6, 0, 0.9],
            ],
          },
        },
      }
  }
}

interface Face {
  /** Eyelid angles over time, as a fraction of the character's lid travel (0 rest, 1 closed, <0 wide). */
  lids: readonly number[]
  /** Brow raise (m) over time. */
  raise?: readonly number[]
  /** Brow tilt: positive is angry (inner ends down), negative is sad. */
  mood?: readonly number[]
  /** Jaw opening (rad) over time. */
  jaw?: readonly number[]
}

/** Face bone tracks (eyelids, brows, jaw) for a clip; models without the bones ignore them. */
function facePose(face: Face, travel: number): Pose {
  const lids = face.lids.map((f): Euler => [f * travel, 0, 0])
  const raise = face.raise ?? [0, 0]
  const mood = face.mood ?? [0, 0]
  const pose: Pose = {
    lidL: { rotations: lids },
    lidR: { rotations: lids },
    browL: {
      rotations: mood.map((m): Euler => [0, 0, m]),
      offsets: raise.map((r): Offset => [0, r, 0]),
    },
    browR: {
      rotations: mood.map((m): Euler => [0, 0, -m]),
      offsets: raise.map((r): Offset => [0, r, 0]),
    },
  }
  if (face.jaw) pose.jaw = { rotations: face.jaw.map((j): Euler => [j, 0, 0]) }
  return pose
}

/** Builds every clip of the `rig` contract for a character. */
export function buildCharacterClips(
  spec: CharacterModelSpec,
  bindPosition: (bone: DriverBone) => THREE.Vector3,
): THREE.AnimationClip[] {
  const e = spec.energy
  const travel = spec.lidTravel ?? 1.3
  const victory = dance(spec.dance)
  const make = (name: ClipName, duration: number, pose: Pose, face?: Face): THREE.AnimationClip =>
    clip(name, duration, face ? { ...pose, ...facePose(face, travel) } : pose, bindPosition)
  const steer = (side: 1 | -1): Pose =>
    // side 1 = left (+x). Leaning toward the turn, hands turning the wheel.
    hold({
      body: [0, 0.12 * side, -0.16 * side],
      head: [0, 0.3 * side, -0.12 * side],
      armL: [0.35 * side, 0, 0],
      armR: [-0.35 * side, 0, 0],
      earL: [0, 0, 0.25 * side],
      earR: [0, 0, 0.25 * side],
      tail: [0, -0.5 * side, 0],
    })

  return [
    make(
      'idle',
      2.4,
      {
        body: {
          rotations: [
            [0, 0, 0],
            [0.03, 0, 0],
            [0, 0, 0],
            [0.03, 0, 0],
          ],
          offsets: [
            [0, 0, 0],
            [0, 0.025, 0],
            [0, 0, 0],
            [0, 0.025, 0],
          ],
        },
        head: {
          rotations: [
            [0, 0, 0],
            [0.05, 0.4 * e, 0.05],
            [0, 0, 0],
            [0.05, -0.4 * e, -0.05],
          ],
        },
        earL: {
          rotations: [
            [0, 0, 0],
            [0, 0, 0],
            [-0.3 * e, 0, 0.2],
            [0, 0, 0],
          ],
        },
        earR: {
          rotations: [
            [0, 0, 0],
            [-0.3 * e, 0, -0.2],
            [0, 0, 0],
            [0, 0, 0],
          ],
        },
        tail: {
          rotations: [
            [0, 0.3 * e, 0],
            [0, 0, 0],
            [0, -0.3 * e, 0],
            [0, 0, 0],
          ],
        },
      },
      {
        // A slow blink, then a calm closed smile
        lids: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        jaw: [0, 0],
      },
    ),
    make('steerLeft', 1, steer(1), { lids: [0.1, 0.1], mood: [0.1, 0.1] }),
    make('steerRight', 1, steer(-1), { lids: [0.1, 0.1], mood: [0.1, 0.1] }),
    make(
      'drift',
      1,
      hold({
        body: [0.22, 0, 0],
        head: [0.12, 0, 0],
        armL: [0.15, 0, 0],
        armR: [0.15, 0, 0],
        earL: [-0.6, 0, 0],
        earR: [-0.6, 0, 0],
        tail: [-0.4, 0, 0],
      }),
      { lids: [0.35, 0.35], mood: [0.3, 0.3], jaw: [0.12, 0.12] },
    ),
    make(
      'boost',
      0.3,
      {
        body: {
          rotations: [
            [-0.25, 0, 0],
            [-0.28, 0, 0],
          ],
        },
        head: {
          rotations: [
            [-0.25, 0, 0],
            [-0.3, 0, 0],
          ],
        },
        armL: {
          rotations: [
            [-0.1, 0, 0],
            [-0.1, 0, 0],
          ],
        },
        armR: {
          rotations: [
            [-0.1, 0, 0],
            [-0.1, 0, 0],
          ],
        },
        earL: {
          rotations: [
            [-1.0, 0, 0.1],
            [-0.8, 0, -0.1],
          ],
        },
        earR: {
          rotations: [
            [-0.8, 0, -0.1],
            [-1.0, 0, 0.1],
          ],
        },
        tail: {
          rotations: [
            [-1.0, 0.1, 0],
            [-1.0, -0.1, 0],
          ],
        },
      },
      { lids: [0.45, 0.45], mood: [0.35, 0.35], raise: [0, 0], jaw: [0.25, 0.3] },
    ),
    make(
      'air',
      0.8,
      {
        body: {
          rotations: [
            [-0.1, 0, 0],
            [-0.15, 0, 0],
          ],
          offsets: [
            [0, 0.06, 0],
            [0, 0.08, 0],
          ],
        },
        head: {
          rotations: [
            [-0.3, 0, 0],
            [-0.35, 0, 0],
          ],
        },
        armL: {
          rotations: [
            [-2.5, 0, -0.5],
            [-2.7, 0, -0.6],
          ],
        },
        armR: {
          rotations: [
            [-2.5, 0, 0.5],
            [-2.7, 0, 0.6],
          ],
        },
        earL: {
          rotations: [
            [0.4, 0, 0.3],
            [0.5, 0, 0.3],
          ],
        },
        earR: {
          rotations: [
            [0.4, 0, -0.3],
            [0.5, 0, -0.3],
          ],
        },
        tail: {
          rotations: [
            [0.6, 0, 0],
            [0.7, 0, 0],
          ],
        },
      },
      { lids: [-0.6, -0.6], raise: [0.05, 0.05], mood: [-0.2, -0.2], jaw: [0.35, 0.4] },
    ),
    make(
      'hit',
      0.9,
      {
        body: {
          rotations: [
            [0, 0, 0.15],
            [0.1, 0, 0],
            [0, 0, -0.15],
            [-0.1, 0, 0],
          ],
        },
        head: {
          rotations: [
            [0.3, 0, 0],
            [0, 0, 0.35],
            [-0.2, 0, 0],
            [0, 0, -0.35],
          ],
        },
        armL: {
          rotations: [
            [-2.0, 0, -0.5],
            [-0.5, 0, -0.8],
            [-1.6, 0, -0.3],
            [-0.8, 0, -0.9],
          ],
        },
        armR: {
          rotations: [
            [-0.5, 0, 0.8],
            [-2.0, 0, 0.5],
            [-0.8, 0, 0.9],
            [-1.6, 0, 0.3],
          ],
        },
        earL: {
          rotations: [
            [0.5, 0, 0.4],
            [-0.5, 0, 0],
            [0.5, 0, -0.4],
            [-0.5, 0, 0],
          ],
        },
        earR: {
          rotations: [
            [-0.5, 0, 0],
            [0.5, 0, 0.4],
            [-0.5, 0, 0],
            [0.5, 0, -0.4],
          ],
        },
        tail: {
          rotations: [
            [0, 0.8, 0],
            [0, 0, 0],
            [0, -0.8, 0],
            [0, 0, 0],
          ],
        },
      },
      {
        lids: [-0.5, 1, -0.5, 1],
        raise: [0.04, 0.0, 0.04, 0.0],
        mood: [-0.35, 0.1, -0.35, 0.1],
        jaw: [0.55, 0.45, 0.55, 0.45],
      },
    ),
    make('victory', victory.duration, victory.pose, {
      // Happy closed eyes and a big open smile
      lids: [0.9, 0.9],
      raise: [0.05, 0.04],
      mood: [-0.2, -0.2],
      jaw: [0.6, 0.35],
    }),
    make(
      'defeat',
      1.2,
      {
        body: {
          rotations: [
            [0.35, 0, 0],
            [0.25, 0, 0],
            [0.35, 0, 0],
            [0.25, 0, 0],
          ],
          offsets: [
            [0, -0.05, 0],
            [0, 0, 0],
            [0, -0.05, 0],
            [0, 0, 0],
          ],
        },
        head: {
          rotations: [
            [0.3, 0.45, 0],
            [0.2, 0, 0],
            [0.3, -0.45, 0],
            [0.2, 0, 0],
          ],
        },
        armL: {
          rotations: [
            [-1.6, 0, -0.2],
            [0.4, 0, 0],
            [-1.6, 0, -0.2],
            [0.4, 0, 0],
          ],
        },
        armR: {
          rotations: [
            [0.4, 0, 0],
            [-1.6, 0, 0.2],
            [0.4, 0, 0],
            [-1.6, 0, 0.2],
          ],
        },
        earL: {
          rotations: [
            [0.6, 0, 0.5],
            [0.6, 0, 0.5],
            [0.6, 0, 0.5],
            [0.6, 0, 0.5],
          ],
        },
        earR: {
          rotations: [
            [0.6, 0, -0.5],
            [0.6, 0, -0.5],
            [0.6, 0, -0.5],
            [0.6, 0, -0.5],
          ],
        },
      },
      { lids: [0.55, 0.55], mood: [-0.5, -0.5], raise: [-0.01, -0.01], jaw: [0.12, 0.05] },
    ),
    make(
      'throwForward',
      0.5,
      {
        body: {
          rotations: [
            [0, 0, 0],
            [-0.1, -0.35, 0],
            [0.2, 0.25, 0],
            [0.05, 0, 0],
          ],
        },
        armR: {
          rotations: [
            [0, 0, 0],
            [-2.6, 0, 0.3],
            [-1.0, 0, 0],
            [-0.3, 0, 0],
          ],
        },
        head: {
          rotations: [
            [0, 0, 0],
            [0, -0.2, 0],
            [0.1, 0, 0],
            [0, 0, 0],
          ],
        },
      },
      { lids: [0.3, 0.3], mood: [0.25, 0.25] },
    ),
    make(
      'throwBack',
      0.5,
      {
        body: {
          rotations: [
            [0, 0, 0],
            [0, -0.5, 0],
            [0, -0.7, 0],
            [0, -0.2, 0],
          ],
        },
        armR: {
          rotations: [
            [0, 0, 0],
            [-1.4, 0, 0.6],
            [-3.0, 0, 0.2],
            [-0.4, 0, 0],
          ],
        },
        head: {
          rotations: [
            [0, 0, 0],
            [0, -0.8, 0],
            [0, -1.0, 0],
            [0, -0.3, 0],
          ],
        },
      },
      { lids: [0.3, 0.3], mood: [0.25, 0.25] },
    ),
  ]
}
