import * as THREE from 'three/webgpu'
import {
  uniform,
  float,
  vec2,
  vec4,
  color,
  uv,
  mix,
  pass,
  mrt,
  output,
  normalView,
  diffuseColor,
  velocity,
  add,
  directionToColor,
  colorToDirection,
  sample,
  metalness,
  roughness,
  positionWorld,
  fract,
  abs,
  max,
  step,
  convertToTexture,
} from 'three/tsl'
import { ssgi } from 'three/examples/jsm/tsl/display/SSGINode.js'
import { ssr } from 'three/examples/jsm/tsl/display/SSRNode.js'
import { traa } from 'three/examples/jsm/tsl/display/TRAANode.js'
import { gaussianBlur } from 'three/examples/jsm/tsl/display/GaussianBlurNode.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import Stats from 'stats-gl'
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { WaterPlane } from './WaterPlane.js'
import { WaterCaustics } from './WaterCaustics.js'
import * as easings from 'eases-jsnext'

// ─── Params ─────────────────────────────────────────────────────────────────
const params = {
  // Camera
  fov: 60,
  cameraEase: 'quadInOut',
  cameraTransitionDuration: 2,
  blur: 0,
  // Lighting
  sunColor: '#fffbe8',
  sunIntensity: 3.8,
  ambientColor: '#70d0e8',
  ambientIntensity: 1.0,
  exposure: 1.5,
  // Fog
  fogEnabled: false,
  fogColor: '#2a6a7a',
  fogDensity: 0.012,
  // Buildings
  buildingColor: '#3a9e96',
  sphereColor: '#ffcc33',
  groundColor: '#2a9a8e',
  causticColor: '#60ffe0',
  floorColor: '#3aafa5',
  floorGroutColor: '#2a9a8e',
  bigSphereEmissiveColor: '#ffaa22',
  bigSphereEmissiveIntensity: 6,
  fresnelBias: 0.1,
  fresnelPower: 2.0,
  fresnelScale: 1.0,
  floorTileSize: 1,
  causticStrength: 1.8,
  causticShadowInfluence: 1.0,
  causticHeightMultiplier: 8,
  // Sky
  skyTopColor: '#1a6070',
  skyBottomColor: '#30b8a8',
  // Sun Position
  sunX: -26,
  sunY: 4,
  sunZ: -9,
  // Shadows
  shadowEnabled: true,
  shadowRadius: 6,
  shadowBlurSamples: 8,
  shadowBias: -0.001,
  shadowNormalBias: 0.02,
  shadowMapSize: 512,
  // Debug
  debug: false,
}

// ─── Scene ──────────────────────────────────────────────────────────────────
const scene = new THREE.Scene()
scene.fog = params.fogEnabled ? new THREE.FogExp2(params.fogColor, params.fogDensity) : null

const camera = new THREE.PerspectiveCamera(params.fov, innerWidth / innerHeight, 0.1, 500)
camera.position.set(0, 3, 12)
camera.lookAt(0, 1.5, -10)
window.camera = camera

const renderer = new THREE.WebGPURenderer({
  antialias: false,
  requiredLimits: { maxStorageBuffersInVertexStage: 2, maxColorAttachmentBytesPerSample: 64 },
  powerPreference: 'high-performance',
})
const pixelRatio = 1
renderer.setPixelRatio(pixelRatio)
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.VSMShadowMap
renderer.setClearColor(params.skyTopColor)
renderer.toneMapping = THREE.AgXToneMapping
renderer.toneMappingExposure = params.exposure
renderer.domElement.style.cssText = 'position:fixed;top:0;left:0;z-index:-1;will-change:transform;'
document.body.appendChild(renderer.domElement)
await renderer.init()

const skyTopColorU = uniform(new THREE.Color(params.skyTopColor))

// ─── Post-Processing (SSGI + TRAA) ──────────────────────────────────────────
const scenePass = pass(scene, camera)
scenePass.setMRT(
  mrt({
    output: output,
    diffuseColor: diffuseColor,
    normal: directionToColor(normalView),
    velocity: velocity,
    metalrough: vec2(metalness, roughness),
  }),
)

const scenePassColor = scenePass.getTextureNode('output')
const scenePassDiffuse = scenePass.getTextureNode('diffuseColor')
const scenePassDepth = scenePass.getTextureNode('depth')
const scenePassNormal = scenePass.getTextureNode('normal')
const scenePassVelocity = scenePass.getTextureNode('velocity')
const scenePassMetalRough = scenePass.getTextureNode('metalrough')

const sceneNormal = sample((uvCoord) => {
  return colorToDirection(scenePassNormal.sample(uvCoord))
})

const giPass = ssgi(scenePassColor, scenePassDepth, sceneNormal, camera)
giPass.sliceCount.value = 1
giPass.stepCount.value = 2
giPass.radius.value = 3
giPass.expFactor.value = 2
giPass.thickness.value = 0.09
giPass.backfaceLighting.value = 0
giPass.aoIntensity.value = 3.1
giPass.giIntensity.value = 22
giPass.useLinearThickness.value = false
giPass.useScreenSpaceSampling.value = true
giPass.useTemporalFiltering = true
giPass.giEnabled = true
giPass.aoEnabled = true

const gi = giPass.rgb
const ao = giPass.a

// ─── Water ──────────────────────────────────────────────────────────────────
const waterPlane = new WaterPlane(scene, renderer, {
  sizeX: 8,
  sizeZ: 8,
  center: new THREE.Vector3(0, 0.25, -1),
  resolution: 128,
  fresnelBias: params.fresnelBias,
  fresnelPower: params.fresnelPower,
  fresnelScale: params.fresnelScale,
  colliderStrength: 0.005,
})

// ─── SSR ─────────────────────────────────────────────────────────────────────
const ssrPass = ssr(scenePassColor, scenePassDepth, sceneNormal, scenePassMetalRough.r, scenePassMetalRough.g)
ssrPass.quality.value = 0.2
ssrPass.blurQuality.value = 1
ssrPass.maxDistance.value = 60
ssrPass.opacity.value = 1
ssrPass.thickness.value = 0.03
ssrPass.enabled = true

const ssrMasked = mix(skyTopColorU.mul(scenePassMetalRough.r), ssrPass.rgb, ssrPass.a)

// ─── RenderPipeline ─────────────────────────────────────────────────────────
const renderPipeline = new THREE.RenderPipeline(renderer)

// SSGI composites (without SSR)
const compositeGiAo = vec4(add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)), scenePassColor.a)
const compositeGiOnly = vec4(add(scenePassColor.rgb, scenePassDiffuse.rgb.mul(gi)), scenePassColor.a)
const compositeAoOnly = vec4(scenePassColor.rgb.mul(ao), scenePassColor.a)

// SSGI composites (with SSR)
const compositeGiAoSsr = vec4(
  add(scenePassColor.rgb.mul(ao), scenePassDiffuse.rgb.mul(gi)).add(ssrMasked),
  scenePassColor.a,
)
const compositeGiOnlySsr = vec4(add(scenePassColor.rgb, scenePassDiffuse.rgb.mul(gi)).add(ssrMasked), scenePassColor.a)
const compositeAoOnlySsr = vec4(scenePassColor.rgb.mul(ao).add(ssrMasked), scenePassColor.a)
const compositeSsrOnly = vec4(scenePassColor.rgb.add(ssrMasked), scenePassColor.a)

// TRAA variants (without SSR)
const traaGiAo = traa(compositeGiAo, scenePassDepth, scenePassVelocity, camera)
const traaGiOnly = traa(compositeGiOnly, scenePassDepth, scenePassVelocity, camera)
const traaAoOnly = traa(compositeAoOnly, scenePassDepth, scenePassVelocity, camera)

// TRAA variants (with SSR)
const traaGiAoSsr = traa(compositeGiAoSsr, scenePassDepth, scenePassVelocity, camera)
const traaGiOnlySsr = traa(compositeGiOnlySsr, scenePassDepth, scenePassVelocity, camera)
const traaAoOnlySsr = traa(compositeAoOnlySsr, scenePassDepth, scenePassVelocity, camera)
const traaSsrOnly = traa(compositeSsrOnly, scenePassDepth, scenePassVelocity, camera)

// ─── Gaussian Blur ──────────────────────────────────────────────────────────
const blurDirectionU = uniform(params.blur * 10)
const blurPass = gaussianBlur(traaGiAoSsr, blurDirectionU, 6)

// Invisible overlay to capture pointer events for dragging in debug mode
const debugOverlay = document.createElement('div')
debugOverlay.style.cssText = 'position:fixed;inset:0;z-index:1;display:none;'
document.body.appendChild(debugOverlay)

const controls = new OrbitControls(camera, debugOverlay)
controls.enableDamping = true
controls.target.set(0, 1.5, -5)
// controls.target.set(0, 1.5, -40)
controls.maxPolarAngle = Math.PI * 0.6
controls.enabled = params.debug

// ─── Uniforms ───────────────────────────────────────────────────────────────
const buildingColorU = uniform(new THREE.Color(params.buildingColor))
const groundColorU = uniform(new THREE.Color(params.groundColor))
const floorColorU = uniform(new THREE.Color(params.floorColor))
const floorGroutColorU = uniform(new THREE.Color(params.floorGroutColor))
const floorTileSizeU = uniform(params.floorTileSize)
const causticStrengthU = uniform(params.causticStrength)
const causticHeightMultiplierU = uniform(params.causticHeightMultiplier)
const causticColorU = uniform(new THREE.Color(params.causticColor))
const bigSphereEmissiveColorU = uniform(new THREE.Color(params.bigSphereEmissiveColor))
const bigSphereEmissiveIntensityU = uniform(params.bigSphereEmissiveIntensity)
const lightDirU = uniform(new THREE.Vector3(params.sunX, params.sunY, params.sunZ).normalize().negate())

// ─── Lighting ───────────────────────────────────────────────────────────────
const sunLight = new THREE.DirectionalLight(params.sunColor, params.sunIntensity)
sunLight.position.set(params.sunX, params.sunY, params.sunZ)
sunLight.castShadow = params.shadowEnabled
sunLight.shadow.mapSize.width = params.shadowMapSize
sunLight.shadow.mapSize.height = params.shadowMapSize
sunLight.shadow.camera.near = 0.1
sunLight.shadow.camera.far = 40
sunLight.shadow.camera.left = -45
sunLight.shadow.camera.right = 10
sunLight.shadow.camera.top = 30
sunLight.shadow.camera.bottom = -30
sunLight.shadow.radius = params.shadowRadius
sunLight.shadow.blurSamples = params.shadowBlurSamples
sunLight.shadow.bias = params.shadowBias
sunLight.shadow.normalBias = params.shadowNormalBias
scene.add(sunLight)

const shadowHelper = new THREE.CameraHelper(sunLight.shadow.camera)
scene.add(shadowHelper)

const ambientLight = new THREE.AmbientLight(params.ambientColor, params.ambientIntensity)
scene.add(ambientLight)

// ─── Sky Gradient (background plane) ────────────────────────────────────────
const skyBottomColorU = uniform(new THREE.Color(params.skyBottomColor))
const skyHeight = 30
const skyGeo = new THREE.PlaneGeometry(120, skyHeight)
const skyMat = new THREE.MeshBasicNodeMaterial({ fog: false })
skyMat.colorNode = mix(skyBottomColorU, skyTopColorU, uv().y)
const skyMesh = new THREE.Mesh(skyGeo, skyMat)
skyMesh.position.set(0, skyHeight / 2, -50)
scene.add(skyMesh)

// ─── Building Material ──────────────────────────────────────────────────────
const buildingMat = new THREE.MeshStandardNodeMaterial()
buildingMat.colorNode = buildingColorU
buildingMat.roughnessNode = float(0.85)
buildingMat.metalnessNode = float(0.0)

// ─── Architecture ───────────────────────────────────────────────────────────

// Boundary walls with arches (left and right)
{
  const wallH = 8
  const wallThickness = 3.5
  const archRadius = 2.2
  const archStraight = 2.5
  const segmentLen = 8
  const distanceFromCenter = 7
  for (const { wallX, rotY } of [
    { wallX: -distanceFromCenter, rotY: Math.PI / 2 },
    { wallX: distanceFromCenter, rotY: -Math.PI / 2 },
  ]) {
    const sign = Math.sign(wallX)
    for (let z = 5; z >= -40; z -= segmentLen) {
      const wallShape = new THREE.Shape()
      wallShape.moveTo(0, 0)
      wallShape.lineTo(segmentLen, 0)
      wallShape.lineTo(segmentLen, wallH)
      wallShape.lineTo(0, wallH)
      wallShape.lineTo(0, 0)

      const hole = new THREE.Path()
      const cx = segmentLen / 2
      hole.moveTo(cx - archRadius, 0)
      hole.lineTo(cx - archRadius, archStraight)
      hole.absarc(cx, archStraight, archRadius, Math.PI, 0, true)
      hole.lineTo(cx + archRadius, 0)
      hole.lineTo(cx - archRadius, 0)
      wallShape.holes.push(hole)

      const geo = new THREE.ExtrudeGeometry(wallShape, { depth: wallThickness, bevelEnabled: false, curveSegments: 12 })
      const mesh = new THREE.Mesh(geo, buildingMat)
      mesh.rotation.y = rotY
      mesh.position.set(wallX + (sign * wallThickness) / 2, -0.1, sign < 0 ? z : z - segmentLen)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
    }
  }
}

// ─── Right side building details ────────────────────────────────────────────

// Floor with water pool indentation
{
  const floorMat = new THREE.MeshStandardNodeMaterial()
  // Procedural square tile pattern using world position
  const worldPos = positionWorld.xz.div(floorTileSizeU)
  const tileUV = fract(worldPos)
  // Distance from tile edge (0 at edge, 0.5 at center)
  const edgeDist = abs(tileUV.sub(0.5))
  const grout = step(0.48, max(edgeDist.x, edgeDist.y))
  floorMat.colorNode = mix(floorColorU, floorGroutColorU, grout)
  floorMat.roughnessNode = float(0.85)
  floorMat.metalnessNode = float(0.0)

  const floorW = 17.5 // spans to outer wall edges at x=±8.75
  const floorD = 50 // z from +7 to -43 (back arch)
  // Derive circular pool cutout from water plane geometry
  const waterCenter = waterPlane.mesh.position
  const poolRadius_ = Math.min(waterPlane.sizeX, waterPlane.sizeZ) / 2

  // Pool center in floor-local coordinates (floor rotated -PI/2 around X, positioned at z=7)
  const poolCenterLocalX = waterCenter.x
  const poolCenterLocalY = 7 - waterCenter.z

  const shape = new THREE.Shape()
  shape.moveTo(-floorW / 2, 0)
  shape.lineTo(floorW / 2, 0)
  shape.lineTo(floorW / 2, floorD)
  shape.lineTo(-floorW / 2, floorD)
  shape.closePath()

  // Circular hole
  const hole = new THREE.Path()
  hole.absarc(poolCenterLocalX, poolCenterLocalY, poolRadius_ + 0.05, 0, Math.PI * 2, false)
  shape.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false })
  const floor = new THREE.Mesh(geo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0, 7)
  floor.receiveShadow = true
  floor.castShadow = true
  scene.add(floor)
}

// Steps from platform to pool
// for (let i = 0; i < 3; i++) {
//   addBox(3, 0.25, 1, 4.5, 0.1 - i * 0.15, 5.5 + i * 1)
// }

// ─── Front arch wall ────────────────────────────────────────────────────────
{
  const wallW = 22
  const wallH = 13
  const archRadius = 3.8
  const archStraight = 7

  const wallShape = new THREE.Shape()
  wallShape.moveTo(-wallW / 2, 0)
  wallShape.lineTo(wallW / 2, 0)
  wallShape.lineTo(wallW / 2, wallH)
  wallShape.lineTo(-wallW / 2, wallH)
  wallShape.lineTo(-wallW / 2, 0)

  const hole = new THREE.Path()
  hole.moveTo(-archRadius, 0)
  hole.lineTo(-archRadius, archStraight)
  hole.absarc(0, archStraight, archRadius, Math.PI, 0, true)
  hole.lineTo(archRadius, 0)
  hole.lineTo(-archRadius, 0)
  wallShape.holes.push(hole)

  const archWallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 0.8, bevelEnabled: false, curveSegments: 24 })
  const archWall = new THREE.Mesh(archWallGeo, buildingMat)
  //   archWall.position.set(0, -0.1, -11.4)
  archWall.position.set(0, -0.1, -19.5)
  archWall.castShadow = true
  archWall.receiveShadow = true
  scene.add(archWall)
}

// ─── Back arch frame (double arch) ──────────────────────────────────────────
{
  const outerRadius = 5.3
  const innerRadius = 3
  const straight = 8

  // Outer arch shape
  const shape = new THREE.Shape()
  shape.moveTo(-outerRadius, 0)
  shape.lineTo(-outerRadius, straight)
  shape.absarc(0, straight, outerRadius, Math.PI, 0, true)
  shape.lineTo(outerRadius, 0)
  shape.lineTo(-outerRadius, 0)

  // Inner arch as hole
  const hole = new THREE.Path()
  hole.moveTo(-innerRadius, 0)
  hole.lineTo(-innerRadius, straight)
  hole.absarc(0, straight, innerRadius, Math.PI, 0, true)
  hole.lineTo(innerRadius, 0)
  hole.lineTo(-innerRadius, 0)
  shape.holes.push(hole)

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false, curveSegments: 24 })
  const archFrameMat = new THREE.MeshStandardNodeMaterial()
  archFrameMat.colorNode = buildingColorU
  archFrameMat.roughnessNode = float(0.85)
  archFrameMat.metalnessNode = float(0.0)
  archFrameMat.side = THREE.DoubleSide
  const archFrame = new THREE.Mesh(geo, archFrameMat)
  //   archFrame.position.set(0, 0, -27.5)
  archFrame.position.set(0, 0, -43)
  archFrame.castShadow = true
  archFrame.receiveShadow = true
  scene.add(archFrame)
}

// ─── Scenography (back half of the set) ─────────────────────────────────────

// Columns — arranged in a semicircle around the pool and along the corridor
{
  const columnGeo = new THREE.CylinderGeometry(0.3, 0.38, 5.5, 12)
  const capGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 12)
  const baseGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.35, 12)
  
  // Semicircle of columns around the back of the pool
  const poolCx = waterPlane.center.x
  const poolCz = waterPlane.center.z
  const poolRadius = Math.min(waterPlane.sizeX, waterPlane.sizeZ) / 2
  const colRing = poolRadius + 1.8
  const columnPositions = []
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI * 0.15 + (Math.PI * 0.7 / 4) * i
    columnPositions.push([poolCx + Math.sin(angle) * colRing, poolCz - Math.cos(angle) * colRing])
  }
  // Corridor columns
  const columnX = 5.2
  columnPositions.push([-columnX, -14], [columnX, -14])
  columnPositions.push([-columnX, -23], [columnX, -23])
  columnPositions.push([-columnX, -33], [columnX, -33])

  for (const [cx, cz] of columnPositions) {
    const column = new THREE.Mesh(columnGeo, buildingMat)
    column.position.set(cx, 2.75, cz)
    column.castShadow = true
    column.receiveShadow = true
    scene.add(column)

    const base = new THREE.Mesh(baseGeo, buildingMat)
    base.position.set(cx, 0.175, cz)
    base.castShadow = true
    base.receiveShadow = true
    scene.add(base)

    const cap = new THREE.Mesh(capGeo, buildingMat)
    cap.position.set(cx, 5.65, cz)
    cap.castShadow = true
    cap.receiveShadow = true
    scene.add(cap)
  }
}

// Decorative spheres on pedestals — flanking the pool and at focal points
{
  const pedestalGeo = new THREE.CylinderGeometry(0.35, 0.4, 1.0, 12)
  const sphereDecGeo = new THREE.IcosahedronGeometry(0.4, 2)

  const spherePositions = [[-3, 3.2], [3, 3.2], [0, -40]]

  const sphereMat = new THREE.MeshStandardNodeMaterial()
  const sphereColorU = uniform(new THREE.Color(params.sphereColor))
  sphereMat.colorNode = sphereColorU
  sphereMat.roughnessNode = float(0.5)
  sphereMat.metalnessNode = float(0.15)

  for (const [sx, sz] of spherePositions) {
    const pedestal = new THREE.Mesh(pedestalGeo, buildingMat)
    pedestal.position.set(sx, 0.5, sz)
    pedestal.castShadow = true
    pedestal.receiveShadow = true
    scene.add(pedestal)

    const sph = new THREE.Mesh(sphereDecGeo, sphereMat)
    sph.position.set(sx, 1.4, sz)
    sph.castShadow = true
    sph.receiveShadow = true
    scene.add(sph)
  }
}

// Freestanding arches
{
  function createArch(x, z, scale = 1, rotY = 0) {
    const outerR = 1.2 * scale
    const innerR = 0.9 * scale
    const straight = 2.5 * scale
    const depth = 0.4 * scale

    const shape = new THREE.Shape()
    shape.moveTo(-outerR, 0)
    shape.lineTo(-outerR, straight)
    shape.absarc(0, straight, outerR, Math.PI, 0, true)
    shape.lineTo(outerR, 0)
    shape.lineTo(innerR, 0)
    shape.lineTo(innerR, straight)
    shape.absarc(0, straight, innerR, 0, Math.PI, false)
    shape.lineTo(-innerR, 0)
    shape.closePath()

    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 })
    const mesh = new THREE.Mesh(geo, buildingMat)
    mesh.position.set(x, 0, z + depth / 2)
    mesh.rotation.y = rotY
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  createArch(0, -40, 1.4, 0)
  createArch(4.5, -28, 0.9, Math.PI / 2)
  createArch(-4.5, -18, 0.9, -Math.PI / 2)
}

// Stairs going up to the right side
{
  const stepMat = buildingMat
  const stepCount = 8
  const stepH = 0.25
  const stepD = 0.4
  const stepW = 2.5

  const rightZ = -16

  // Right-side staircase going from center toward the right wall
  for (let i = 0; i < stepCount; i++) {
    const stepGeo = new THREE.BoxGeometry(stepD, stepH * (i + 1), stepW)
    const step = new THREE.Mesh(stepGeo, stepMat)
    step.position.set(2.3 + i * stepD, (stepH * (i + 1)) / 2, rightZ)
    step.castShadow = true
    step.receiveShadow = true
    scene.add(step)
  }

  // Landing platform at the top
  const landingGeo = new THREE.BoxGeometry(3.5, stepH * stepCount, 4.5)
  const landing = new THREE.Mesh(landingGeo, stepMat)
  landing.position.set(7, (stepH * stepCount) / 2, rightZ)
  landing.castShadow = true
  landing.receiveShadow = true
  scene.add(landing)

  const leftZ = -30

  // Left-side staircase going toward the left wall
  for (let i = 0; i < stepCount; i++) {
    const stepGeo = new THREE.BoxGeometry(stepD, stepH * (i + 1), stepW)
    const step = new THREE.Mesh(stepGeo, stepMat)
    step.position.set(-2.3 - i * stepD, (stepH * (i + 1)) / 2, leftZ)
    step.castShadow = true
    step.receiveShadow = true
    scene.add(step)
  }

  // Landing platform at the top (left)
  const landingGeo2 = new THREE.BoxGeometry(3.5, stepH * stepCount, 4.5)
  const landing2 = new THREE.Mesh(landingGeo2, stepMat)
  landing2.position.set(-7, (stepH * stepCount) / 2, leftZ)
  landing2.castShadow = true
  landing2.receiveShadow = true
  scene.add(landing2)
}

// Big sphere half-buried in the ground — centered behind the pool
{
  const bigSphereMat = new THREE.MeshStandardNodeMaterial()
  bigSphereMat.colorNode = buildingColorU
  bigSphereMat.emissiveNode = bigSphereEmissiveColorU.mul(bigSphereEmissiveIntensityU)
  bigSphereMat.roughnessNode = float(1)
  bigSphereMat.metalnessNode = float(0)
  const bigSphereGeo = new THREE.IcosahedronGeometry(2.2, 3)
  const bigSphere = new THREE.Mesh(bigSphereGeo, bigSphereMat)
  bigSphere.position.set(0, 0.2, -9)
  bigSphere.castShadow = false
  bigSphere.receiveShadow = false
  scene.add(bigSphere)
}

// Tall obelisk near the back arch
{
  const obeliskGeo = new THREE.CylinderGeometry(0.15, 0.35, 6, 4)
  const obelisk = new THREE.Mesh(obeliskGeo, buildingMat)
  obelisk.position.set(-4, 3, -38)
  obelisk.castShadow = true
  obelisk.receiveShadow = true
  scene.add(obelisk)
}

// Floating ring on the pool surface
{
  const ringGeo = new THREE.TorusGeometry(1.6, 0.08, 12, 32)
  const ringMat = new THREE.MeshStandardNodeMaterial()
  ringMat.colorNode = bigSphereEmissiveColorU
  ringMat.emissiveNode = bigSphereEmissiveColorU.mul(float(1.5))
  ringMat.roughnessNode = float(0.3)
  ringMat.metalnessNode = float(0.5)
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.name = 'floatingRing'
  ring.position.set(waterPlane.center.x, waterPlane.center.y + 0.3, waterPlane.center.z)
  ring.rotation.x = Math.PI / 2
  ring.castShadow = true
  ring.receiveShadow = false
  scene.add(ring)
}

// ─── Lounge Chairs ──────────────────────────────────────────────────────────
const woodMat = new THREE.MeshStandardNodeMaterial()
woodMat.colorNode = color(0x28756a)
woodMat.roughnessNode = float(0.8)

const cushionMat = new THREE.MeshStandardNodeMaterial()
cushionMat.colorNode = color(0xd8f0e8)
cushionMat.roughnessNode = float(0.6)

function createLoungeChair(x, z, rotY) {
  const group = new THREE.Group()

  // Frame (base)
  const frameGeo = new THREE.BoxGeometry(0.8, 0.08, 1.9)
  const frame = new THREE.Mesh(frameGeo, woodMat)
  frame.position.y = 0.35
  frame.position.z = -0.1
  group.add(frame)

  // Legs
  const legGeo = new THREE.BoxGeometry(0.08, 0.35, 0.08)
  const positions = [
    [-0.35, 0.175, -0.85],
    [0.35, 0.175, -0.85],
    [-0.35, 0.175, 0.85],
    [0.35, 0.175, 0.85],
  ]
  for (const [lx, ly, lz] of positions) {
    const leg = new THREE.Mesh(legGeo, woodMat)
    leg.position.set(lx, ly, lz)
    leg.position.z -= 0.1
    group.add(leg)
  }

  // Cushion (seat)
  const cushionGeo = new THREE.BoxGeometry(0.75, 0.12, 1.4)
  const cushion = new THREE.Mesh(cushionGeo, cushionMat)
  cushion.position.set(0, 0.45, 0.1)
  group.add(cushion)

  // Back rest (angled)
  const backGeo = new THREE.BoxGeometry(0.75, 0.1, 0.7)
  const back = new THREE.Mesh(backGeo, cushionMat)
  back.position.set(0, 0.5, -0.7)
  back.rotation.x = 0.4
  group.add(back)

  group.position.set(x, 0.2, z)
  group.rotation.y = rotY
  scene.add(group)
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
}

createLoungeChair(5, 1.5, (-Math.PI / 2) * 0.85)
createLoungeChair(5.5, 3.2, (-Math.PI / 2) * 0.85)

// ─── Ground plane ────────────────────────────────────────────
const groundMat = new THREE.MeshStandardNodeMaterial()
groundMat.colorNode = groundColorU
groundMat.roughnessNode = float(0.9)
const groundGeo = new THREE.PlaneGeometry(120, 80)
const ground = new THREE.Mesh(groundGeo, groundMat)
ground.rotation.x = -Math.PI / 2
ground.position.set(0, -0.01, -30)
// ground.receiveShadow = true
scene.add(ground)

// ─── Caustics (deformed water mesh projected to floor) ──────────────────────
const waterCaustics = new WaterCaustics(scene, waterPlane, {
  lightDir: lightDirU,
  floorY: waterPlane.mesh.position.y - 0.24,
  causticColor: causticColorU,
  causticStrength: causticStrengthU,
  baseColor: groundColorU,
  heightMultiplier: causticHeightMultiplierU,
  circular: true,
})

// ─── Text/Collider Z offset (declared early so GUI can reference it) ─────
let _sphereRefOffsetZ = -5.5 // colliderSphere.position.z - camera.position.z

// ─── Sphere Collider ────────────────────────────────────────────────────────
let colliderRadius = 1.5
const colliderSphere = new THREE.Mesh(
  new THREE.SphereGeometry(colliderRadius, 12, 12),
  new THREE.MeshStandardNodeMaterial({
    color: '#ff6644',
    roughness: 0.4,
    metalness: 0.2,
    transparent: true,
    opacity: 0.6,
  }),
)
colliderSphere.position.set(0, 4, 2.5)
scene.add(colliderSphere)

// ─── 3D Text ─────────────────────────────────────────────────────────────────
const ttfLoader = new TTFLoader()
const fontData = await new Promise((resolve) =>
  ttfLoader.load(
    'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtY.ttf',
    resolve,
  ),
)
const textFont = new Font(fontData)
const textMat = new THREE.MeshBasicNodeMaterial()
textMat.colorNode = color(0xffffff)

const textGroup = new THREE.Group()
const textBaseSize = 1

function createCenteredText(str, yOffset) {
  const geo = new TextGeometry(str, {
    font: textFont,
    size: textBaseSize,
    depth: 0.01,
    curveSegments: 8,
  })
  geo.computeBoundingBox()
  const width = geo.boundingBox.max.x - geo.boundingBox.min.x
  geo.translate(-width / 2, 0, 0)
  const mesh = new THREE.Mesh(geo, textMat)
  mesh.position.y = yOffset
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const textLineHeight = textBaseSize * 1.15
const line1 = createCenteredText('Still waters', textLineHeight)
const line2 = createCenteredText('run deep', 0)
textGroup.add(line1, line2)
textGroup.position.z = colliderSphere.position.z

// Compute base bounding box for scaling, and vertically center the text children
const textBox = new THREE.Box3().setFromObject(textGroup)
const baseTextWidth = textBox.max.x - textBox.min.x
// Shift children down by ~1 line
line1.position.y -= textBaseSize * 0.9
line2.position.y -= textBaseSize * 1.3

camera.add(textGroup)
scene.add(camera)

const transformControls = new TransformControls(camera, debugOverlay)
transformControls.attach(colliderSphere)
transformControls.addEventListener('dragging-changed', (event) => {
  controls.enabled = !event.value && params.debug
})
const transformHelper = transformControls.getHelper()
scene.add(transformHelper)

// ─── Stats ──────────────────────────────────────────────────────────────────
const stats = new Stats({ trackGPU: true, trackCPT: true })
document.body.appendChild(stats.dom)
stats.init(renderer)

// ─── Custom GUI (removed) ────────────────────────────────────────────────
// GUI removed per request - smooth & clean UI
function updateOutputPipeline() {
  const { giEnabled, aoEnabled } = giPass
  const { enabled: ssrEnabled } = ssrPass
  let node
  if (giEnabled && aoEnabled) {
    node = ssrEnabled ? traaGiAoSsr : traaGiAo
  } else if (giEnabled) {
    node = ssrEnabled ? traaGiOnlySsr : traaGiOnly
  } else if (aoEnabled) {
    node = ssrEnabled ? traaAoOnlySsr : traaAoOnly
  } else {
    node = ssrEnabled ? traaSsrOnly : scenePassColor
  }
  if (params.blur > 0) {
    blurPass.textureNode = convertToTexture(node)
    renderPipeline.outputNode = blurPass
  } else {
    renderPipeline.outputNode = node
  }
  renderPipeline.needsUpdate = true
}
updateOutputPipeline()

// Hide stats permanently for clean look
stats.dom.style.display = 'none'
stats.dom.style.visibility = 'hidden'
stats.dom.style.pointerEvents = 'none'

let debugToggleInput = { checked: false }
function setDebug(enabled) {
  params.debug = enabled
  controls.enabled = enabled
  stats.dom.style.display = 'none'
  transformHelper.visible = enabled
  colliderSphere.visible = enabled
  shadowHelper.visible = enabled
  transformControls.enabled = enabled
  debugOverlay.style.display = enabled ? 'block' : 'none'
  debugToggleInput.checked = enabled
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    setDebug(!params.debug)
  }
})

// ─── Text-to-sphere Y binding ────────────────────────────────────────────────
/** @type {HTMLElement} */
const silenceH2 = document.querySelector('.sections .section:first-child h2')

// Apply initial debug state
setDebug(params.debug)
const _projVec = new THREE.Vector3()
const _unprojVec = new THREE.Vector3()
const _unprojVec2 = new THREE.Vector3()
// Reference point that follows the camera Z so the text depth is always valid
const _sphereRefPoint = new THREE.Vector3(colliderSphere.position.x, 0, colliderSphere.position.z)

// ─── Scroll-driven camera Z animation (flawless, scroll-linked) ───────────────────
const cameraStartZ = camera.position.z
const cameraChapter1Z = 1
const cameraMidZ = -14
const cameraEndZ = -31
const controlsStartZ = controls.target.z

const allSections = document.querySelectorAll('.sections .section')
const section1El = allSections[0] // Chapter I
const section3El = allSections[1] // Chapter II
const section4El = allSections[2] // Chapter III
const finaleEl = document.querySelector('.finale')

let section1Top = 0
let section3Top = 0
let section4Top = 0
let finaleTop = 0
function updateSectionOffsets() {
  const sY = window.scrollY
  section1Top = section1El.getBoundingClientRect().top + sY
  section3Top = section3El.getBoundingClientRect().top + sY
  section4Top = section4El.getBoundingClientRect().top + sY
  finaleTop = finaleEl.getBoundingClientRect().top + sY
}
updateSectionOffsets()

let targetCamZ = cameraStartZ
let targetCtrlZ = controlsStartZ
let targetBlur = 0

function ease(t) {
  return (easings[params.cameraEase] || easings.cubicInOut)(t)
}
function clamp01(v) { return Math.max(0, Math.min(1, v)) }
function lerp(a, b, t) { return a + (b - a) * t }

function computeTargets() {
  const viewportCenter = window.scrollY + innerHeight / 2
  let z
  if (viewportCenter < section1Top) {
    const t = clamp01(viewportCenter / Math.max(1, section1Top))
    z = lerp(cameraStartZ, cameraChapter1Z, ease(t))
  } else if (viewportCenter < section3Top) {
    const t = clamp01((viewportCenter - section1Top) / Math.max(1, section3Top - section1Top))
    z = lerp(cameraChapter1Z, cameraMidZ, ease(t))
  } else if (viewportCenter < section4Top) {
    const t = clamp01((viewportCenter - section3Top) / Math.max(1, section4Top - section3Top))
    z = lerp(cameraMidZ, cameraEndZ, ease(t))
  } else {
    z = cameraEndZ
  }
  targetCamZ = z
  targetCtrlZ = controlsStartZ + (z - cameraStartZ)
  let blurT = 0
  const blurStart = finaleTop - innerHeight * 0.5
  if (viewportCenter >= finaleTop) blurT = 1
  else if (viewportCenter > blurStart) blurT = clamp01((viewportCenter - blurStart) / (innerHeight * 0.5))
  const blurTarget = blurT * 0.12
  targetBlur = blurTarget
}

let scrollTicking = false
function onScroll() {
  if (!scrollTicking) {
    requestAnimationFrame(() => {
      computeTargets()
      scrollTicking = false
    })
    scrollTicking = true
  }
}
window.addEventListener('scroll', onScroll, { passive: true })
computeTargets()

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(innerWidth, innerHeight)
  updateSectionOffsets()
  computeTargets()
})

// ─── Mouse interaction ──────────────────────────────────────────────────────
const mouseNDC = new THREE.Vector2(-Infinity, -Infinity)

window.addEventListener('pointermove', (event) => {
  mouseNDC.set((event.clientX / innerWidth) * 2 - 1, -(event.clientY / innerHeight) * 2 + 1)
})

// ─── Resize ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(pixelRatio)
  renderer.setSize(innerWidth, innerHeight)
  updateSectionOffsets()
  updateCameraProgress()
})

// ─── Animate ────────────────────────────────────────────────────────────────
async function animate() {
  controls.update()

  // Bind collider sphere & 3D text to the "The architecture of silence" h2 element
  {
    // Keep the reference point at a fixed offset in front of the camera
    _sphereRefPoint.z = camera.position.z + _sphereRefOffsetZ
    colliderSphere.position.z = _sphereRefPoint.z

    _projVec.copy(_sphereRefPoint).project(camera)
    const projZ = _projVec.z

    {
      const rect = silenceH2.getBoundingClientRect()
      const centerNdcX = ((rect.left + rect.width / 2) / innerWidth) * 2 - 1
      const centerNdcY = -((rect.top + rect.height / 2) / innerHeight) * 2 + 1

      // Unproject center of the HTML text at the text's depth
      _unprojVec.set(centerNdcX, centerNdcY, projZ).unproject(camera)
      colliderSphere.position.y = _unprojVec.y
      // Position text in camera-local space
      camera.worldToLocal(_unprojVec)
      textGroup.position.copy(_unprojVec)

      // Scale 3D text to match the HTML text's width
      const leftNdcX = (rect.left / innerWidth) * 2 - 1
      const rightNdcX = ((rect.left + rect.width) / innerWidth) * 2 - 1
      _unprojVec.set(leftNdcX, centerNdcY, projZ).unproject(camera)
      _unprojVec2.set(rightNdcX, centerNdcY, projZ).unproject(camera)
      const targetWidth = _unprojVec2.x - _unprojVec.x
      const scale = targetWidth / baseTextWidth
      textGroup.scale.setScalar(scale)
    }
  }

  // Animate floating ring — sample water height at ring position & interact
  {
    const ringMesh = scene.getObjectByName('floatingRing')
    if (ringMesh) {
      const t = performance.now() / 1000

      // Sample water height from the height buffer at the ring's grid position
      const localX = (ringMesh.position.x - waterPlane.center.x) / waterPlane.sizeX + 0.5
      const localZ = (ringMesh.position.z - waterPlane.center.z) / waterPlane.sizeZ + 0.5
      const ix = Math.floor(Math.max(0, Math.min(localX * waterPlane.resX, waterPlane.resX - 1)))
      const iz = Math.floor(Math.max(0, Math.min(localZ * waterPlane.resZ, waterPlane.resZ - 1)))
      const bufferIndex = iz * waterPlane.resX + ix

      // Read from whichever buffer is current
      const heightArr = waterPlane.readFromA.value === 1
        ? waterPlane.heightStorageA.array
        : waterPlane.heightStorageB.array
      const waterHeight = (heightArr && heightArr[bufferIndex]) || 0

      // Float on the water surface with a gentle bob
      const baseY = waterPlane.center.y + 0.28
      ringMesh.position.y = baseY + waterHeight * 3.0 + Math.sin(t * 0.8) * 0.04
      ringMesh.rotation.z = t * 0.12

      // Tilt ring based on water slope (sample neighbors)
      const ixL = Math.max(0, ix - 3)
      const ixR = Math.min(waterPlane.resX - 1, ix + 3)
      const izU = Math.max(0, iz - 3)
      const izD = Math.min(waterPlane.resZ - 1, iz + 3)
      if (heightArr) {
        const hL = heightArr[iz * waterPlane.resX + ixL] || 0
        const hR = heightArr[iz * waterPlane.resX + ixR] || 0
        const hU = heightArr[izU * waterPlane.resX + ix] || 0
        const hD = heightArr[izD * waterPlane.resX + ix] || 0
        // Subtle tilt — ring lies in XZ plane (rotation.x = PI/2), so we adjust x and y rot
        const tiltX = (hD - hU) * 1.5
        const tiltY = (hR - hL) * 1.5
        ringMesh.rotation.x = Math.PI / 2 + tiltX
        ringMesh.rotation.y = tiltY
      }
    }
  }

    // Flawless scroll-driven camera + blur lerp (smooth, frame-rate independent)
  if (!params.debug) {
    const camLerp = 0.075
    camera.position.z += (targetCamZ - camera.position.z) * camLerp
    controls.target.z += (targetCtrlZ - controls.target.z) * camLerp
    if (Math.abs(targetCamZ - camera.position.z) < 0.001) camera.position.z = targetCamZ
    if (Math.abs(targetCtrlZ - controls.target.z) < 0.001) controls.target.z = targetCtrlZ
  }
  // Blur smooth lerp - rebuild pipeline only when crossing 0 threshold
  {
    const prevBlur = params.blur
    const blurLerp = 0.08
    params.blur += (targetBlur - params.blur) * blurLerp
    if (Math.abs(targetBlur - params.blur) < 0.0005) params.blur = targetBlur
    blurDirectionU.value = params.blur * 10
    if ((prevBlur === 0) !== (params.blur === 0)) {
      updateOutputPipeline()
    }
  }

if (waterPlane.mesh.visible) {
    waterPlane.update(mouseNDC, camera, colliderSphere.position, colliderRadius)
  }

  renderPipeline.render()

  stats.update()
  await renderer.resolveTimestampsAsync('render')
  await renderer.resolveTimestampsAsync('compute')
}
renderer.setAnimationLoop(animate)
