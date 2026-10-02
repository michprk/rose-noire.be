// ==========================================================================
// Rose Noire — scène 3D : une rose en verre optique (Three.js r160)
// Adapté du moteur « Premium 3D Glass » : la silhouette se décompose en quatre
// fragments au défilement puis se recompose à l’identique ; une dalle de verre
// liquide se cale derrière le formulaire de contact.
// Ce module est facultatif : s’il ne peut pas tourner (pas de WebGL 2, animations
// réduites, erreur), la page affiche la version statique des chapitres.
// ==========================================================================
// Three.js n’est téléchargé que si la scène peut réellement tourner (voir start()).
const root = document.documentElement;
const releaseLoader = () => { if (window.__rnLoader) window.__rnLoader.done(); };
function fallback(reason) {
    if (reason) console.info('[rose] scène 3D désactivée :', reason);
    root.classList.add('no-webgl');
    root.classList.remove('webgl', 'stage-covered', 'in-contact');
    document.body.classList.remove('has-glass-card');
    releaseLoader();
}

function webglAvailable() {
    try {
        const probe = document.createElement('canvas');
        return !!(window.WebGL2RenderingContext && probe.getContext('webgl2'));
    } catch (error) { return false; }
}

const canvas = document.querySelector('#webgl');
const stageElement = document.querySelector('#stage');
if (!canvas || !stageElement) {
    // Pages sans scène (mentions légales, 404…)
} else if (root.classList.contains('reduced')) {
    fallback('animations réduites');
} else if (!webglAvailable()) {
    fallback('WebGL 2 indisponible');
} else {
    try {
        await start();
    } catch (error) {
        console.warn('[rose]', error);
        fallback('erreur');
    }
}

async function start() {
const [THREE, { SVGLoader }] = await Promise.all([
    import('../vendor/three.module.min.js'),
    import('../vendor/svg-loader.min.js')
]);
// ---- Configuration ------------------------------------------------------------
// Une seule silhouette : la rose. Elle éclate en quatre fragments puis revient à
// l’identique. La palette colore les cinq chapitres du fond, du héros au contact.
const SITE = {
    shapes: [new URL('../shapes/rose.svg', import.meta.url).href],
    palette: ['#ff4f8b', '#b13cff', '#ff7a59', '#ff2d6f', '#8a1238'],
    fragments: 4
};
const SINGLE_SHAPE = SITE.shapes.length === 1;
const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;

const shapeSources = await Promise.all(SITE.shapes.map(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load ${path}`);
    return response.text();
}));
const openingSource = shapeSources[0];
const finalSource = SINGLE_SHAPE ? shapeSources[0] : shapeSources[1];

// ---- Réglages -------------------------------------------------------------------
const LOGO_HEIGHT = 2.55;                             // hauteur de la rose, unités monde
const LOGO_DEPTH = 0.44;
const LOGO_BEVEL = { size: 0.04, thickness: 0.05 };
const ICON_SIZE = SINGLE_SHAPE ? LOGO_HEIGHT : 2.9;
const ICON_DEPTH = SINGLE_SHAPE ? LOGO_DEPTH : 0.50;
const ICON_BEVEL = SINGLE_SHAPE ? LOGO_BEVEL : { size: 0.028, thickness: 0.038 };
const SEAM_BEVEL = 0.006;

let scene, camera, renderer;
let modelPivot;
const logoPieces = [];
let wholeBody;
let glassIcon;
let iconOutline = [];
let iconHoles = [];
const clock = new THREE.Clock();
let currentScroll = 0;
let currentContact = 0, targetContact = 0;
const contactSection = document.querySelector('#contact');
const contactCardElement = document.querySelector('.contact-card');
let glassCard;
let cardGlass;
const CARD_DISTANCE = 6.0;
const CARD_RIM_PX = 16, CARD_RADIUS_PX = 30, CARD_DEPTH = 0.08, CARD_RIM_DEPTH = 0.06;

let mouseX = 0, mouseY = 0, targetMouseX = 0, targetMouseY = 0;
let bgMaterial, bgMesh;
const paletteUniforms = Object.fromEntries(SITE.palette.map((hex, index) =>
    [`uC${index}`, { value: new THREE.Color(hex) }]));
const shaderUniforms = {
    ...paletteUniforms,
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uScroll: { value: 0 },
    uVelocity: { value: 0 }
};

let sparkParticles;
const sparkCount = isSmall ? 220 : 420;
const sparkData = [];
const sizes = { width: window.innerWidth, height: window.innerHeight };

const V2 = (x = 0, y = 0) => new THREE.Vector2(x, y);
const cross2 = (a, b) => a.x * b.y - a.y * b.x;
const lerp = THREE.MathUtils.lerp;

// Pollen : points doux, rose et blanc, qui montent lentement autour de la rose.
function createSparkTexture() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 240, 246, 0.85)');
    gradient.addColorStop(0.65, 'rgba(255, 200, 222, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
}

function createSparks() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(sparkCount * 3);
    const colors = new Float32Array(sparkCount * 3);
    for (let i = 0; i < sparkCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 6.5;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 5.0 - 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 6.5;
        if (Math.random() < 0.55) {
            colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.93 + Math.random() * 0.07; colors[i * 3 + 2] = 0.96;
        } else {
            colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.45 + Math.random() * 0.2; colors[i * 3 + 2] = 0.62 + Math.random() * 0.2;
        }
        sparkData.push({
            speedX: (Math.random() - 0.5) * 0.4,
            speedY: 0.12 + Math.random() * 0.26,
            speedZ: (Math.random() - 0.5) * 0.4,
            swaySpeed: 0.5 + Math.random() * 1.5,
            swayRadius: 0.05 + Math.random() * 0.15,
            phase: Math.random() * Math.PI * 2
        });
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        size: 0.03, vertexColors: true, transparent: true, opacity: 0.42,
        blending: THREE.AdditiveBlending, depthWrite: false, map: createSparkTexture()
    });
    sparkParticles = new THREE.Points(geometry, material);
    scene.add(sparkParticles);
}

// Studio procédural : longues boîtes à lumière, quelques-unes rosées, pour des reflets
// nets et spectraux dans le verre.
function createGlassEnvironment() {
    const studio = new THREE.Scene();
    studio.background = new THREE.Color('#0a0709');
    const panels = [
        [2.8, 8, -4, 2, 3, '#ffffff', 2.6],
        [0.65, 7, 3, 1, 2, '#ffe3ee', 4.0],
        [5, 0.7, 0, 5, -1, '#ffffff', 3.5],
        [0.5, 6, -2, 0, -4, '#c99bff', 3.0],
        [1.0, 5, 3, -1, -3, '#ff9cc2', 2.6],
        [4, 0.35, 0, -3, 3, '#ffb8cf', 3.0],
        [0.16, 5, -3, 0, 2, '#ffffff', 5.0],
        [0.35, 4, 4, 0, -2, '#ffb36b', 2.0]
    ];
    for (const [w, h, x, y, z, color, intensity] of panels) {
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
        );
        panel.position.set(x, y, z);
        panel.lookAt(0, 0, 0);
        studio.add(panel);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studio, 0.025, 0.1, 100);
    scene.environment = environment.texture;
    studio.traverse(object => {
        if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); }
    });
    pmrem.dispose();
}

function createGlassMaterial() {
    const glass = new THREE.MeshPhysicalMaterial({
        color: '#fff8fb',
        metalness: 0.0,
        roughness: 0.025,
        transmission: 1.0,
        thickness: 0.48,
        ior: 1.46,
        attenuationColor: new THREE.Color('#ffe6ef'),
        attenuationDistance: 6.0,
        clearcoat: 0.65,
        clearcoatRoughness: 0.018,
        iridescence: 0.62,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [100, 420],
        envMapIntensity: 1.12,
        side: THREE.DoubleSide
    });
    // r160 n’a pas de paramètre de dispersion : on échantillonne trois réfractions
    // (indice du rouge diminué, du bleu augmenté), l’écart grandissant aux angles rasants.
    glass.onBeforeCompile = shader => {
        shader.uniforms.uChromaticSpread = { value: 0.018 };
        shader.fragmentShader = 'uniform float uChromaticSpread;\n' + shader.fragmentShader;
        const transmission = THREE.ShaderChunk.transmission_fragment.replace(
            /vec4 transmitted = getIBLVolumeRefraction\([\s\S]*?\);/,
            `float chromaticSpread = uChromaticSpread * mix(0.35, 1.0,
                smoothstep(0.15, 0.85, 1.0 - abs(dot(n, v))));
            vec4 transmitted = getIBLVolumeRefraction(
                n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
                pos, modelMatrix, viewMatrix, projectionMatrix, material.ior, material.thickness,
                material.attenuationColor, material.attenuationDistance );
            vec4 transmittedRed = getIBLVolumeRefraction(
                n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
                pos, modelMatrix, viewMatrix, projectionMatrix, material.ior - chromaticSpread, material.thickness,
                material.attenuationColor, material.attenuationDistance );
            vec4 transmittedBlue = getIBLVolumeRefraction(
                n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
                pos, modelMatrix, viewMatrix, projectionMatrix, material.ior + chromaticSpread, material.thickness,
                material.attenuationColor, material.attenuationDistance );
            transmitted = vec4(transmittedRed.r, transmitted.g, transmittedBlue.b,
                (transmittedRed.a + transmitted.a + transmittedBlue.a) / 3.0);`
        );
        shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', transmission);
    };
    glass.customProgramCacheKey = () => 'rose-glass-edge-dispersion-v1';
    return glass;
}

// ---- Contours 2D -----------------------------------------------------------------
function cleanContour(points, epsilon = 1e-4) {
    const contour = [];
    for (const p of points) {
        if (!contour.length || contour[contour.length - 1].distanceTo(p) > epsilon) contour.push(p.clone());
    }
    while (contour.length > 1 && contour[0].distanceTo(contour[contour.length - 1]) <= epsilon) contour.pop();
    const result = contour.filter((p, i) => {
        const prev = contour[(i - 1 + contour.length) % contour.length];
        const next = contour[(i + 1) % contour.length];
        return Math.abs(cross2(p.clone().sub(prev), next.clone().sub(p))) > 1e-7;
    });
    if (THREE.ShapeUtils.isClockWise(result)) result.reverse();
    return result;
}

function clipContour(points, halfPlanes) {
    let polygon = points.map(p => p.clone());
    for (const { origin, normal } of halfPlanes) {
        const clipped = [];
        for (let i = 0; i < polygon.length; i++) {
            const p = polygon[i], q = polygon[(i + 1) % polygon.length];
            const dp = p.clone().sub(origin).dot(normal), dq = q.clone().sub(origin).dot(normal);
            if (dp >= 0) clipped.push(p);
            if ((dp >= 0) !== (dq >= 0)) clipped.push(p.clone().lerp(q, dp / (dp - dq)));
        }
        polygon = clipped;
        if (!polygon.length) break;
    }
    return cleanContour(polygon);
}

function wedgeHalfPlanes(center, startDeg, endDeg) {
    const dir = deg => V2(Math.cos(THREE.MathUtils.degToRad(deg)), Math.sin(THREE.MathUtils.degToRad(deg)));
    const a = dir(startDeg), b = dir(endDeg);
    return [{ origin: center, normal: V2(-a.y, a.x) }, { origin: center, normal: V2(b.y, -b.x) }];
}

function recentre(points) {
    const centre = new THREE.Box2().setFromPoints(points).getCenter(V2());
    return { contour: points.map(p => p.clone().sub(centre)), home: new THREE.Vector3(centre.x, centre.y, 0) };
}

function makeIconPrism(bevelSize, bevelThickness, holeScale) {
    const shape = new THREE.Shape(iconOutline);
    if (holeScale > 0.02) {
        for (const hole of iconHoles) {
            const centre = new THREE.Box2().setFromPoints(hole).getCenter(V2());
            shape.holes.push(new THREE.Path(hole.map(p => p.clone().sub(centre).multiplyScalar(holeScale).add(centre))));
        }
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: ICON_DEPTH, steps: 1, bevelEnabled: true, bevelSize, bevelThickness, bevelSegments: 6, curveSegments: 24
    });
    geometry.translate(0, 0, -ICON_DEPTH / 2);
    return geometry;
}

function makePrism(points, depth, bevelSize, bevelThickness) {
    const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
        depth, steps: 1, bevelEnabled: true, bevelSize, bevelThickness, bevelSegments: 6, curveSegments: 24
    });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
}

// ---- Correspondance du morphing ------------------------------------------------
function matchRadially(source, target) {
    const prepare = points => {
        const contour = points.filter((p, i) => i === 0 || p.distanceToSquared(points[i - 1]) > 1e-12);
        if (contour[0].distanceToSquared(contour[contour.length - 1]) < 1e-12) contour.pop();
        if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
        let kernel = [V2(-10, -10), V2(10, -10), V2(10, 10), V2(-10, 10)];
        for (let i = 0; i < contour.length; i++) {
            const a = contour[i], edge = contour[(i + 1) % contour.length].clone().sub(a);
            const clipped = [];
            for (let j = 0; j < kernel.length; j++) {
                const p = kernel[j], q = kernel[(j + 1) % kernel.length];
                const dp = cross2(edge, p.clone().sub(a)), dq = cross2(edge, q.clone().sub(a));
                if (dp >= -1e-10) clipped.push(p);
                if ((dp >= 0) !== (dq >= 0)) clipped.push(p.clone().lerp(q, dp / (dp - dq)));
            }
            kernel = clipped;
        }
        if (!kernel.length) throw new Error('Contour has no visibility kernel.');
        const center = kernel.reduce((sum, p) => sum.add(p), V2()).multiplyScalar(1 / kernel.length);
        return { contour, center };
    };
    const a = prepare(source), b = prepare(target);
    const angle = (p, center) => (Math.atan2(p.y - center.y, p.x - center.x) + Math.PI * 2) % (Math.PI * 2);
    const angles = [...a.contour.map(p => angle(p, a.center)), ...b.contour.map(p => angle(p, b.center)),
        ...Array.from({ length: 32 }, (_, i) => i / 32 * Math.PI * 2)].sort((x, y) => x - y)
        .filter((value, i, values) => i === 0 || value - values[i - 1] > 1e-8);
    const sample = ({ contour, center }, theta) => {
        const direction = V2(Math.cos(theta), Math.sin(theta));
        let distance = Infinity;
        for (let i = 0; i < contour.length; i++) {
            const p = contour[i], edge = contour[(i + 1) % contour.length].clone().sub(p);
            const denominator = cross2(direction, edge);
            if (Math.abs(denominator) < 1e-12) continue;
            const relative = p.clone().sub(center);
            const t = cross2(relative, edge) / denominator;
            const u = cross2(relative, direction) / denominator;
            if (t >= 0 && u >= -1e-8 && u <= 1 + 1e-8) distance = Math.min(distance, t);
        }
        if (!isFinite(distance)) throw new Error('Ray missed the contour.');
        return center.clone().addScaledVector(direction, distance);
    };
    return angles.map(theta => ({ source: sample(a, theta), target: sample(b, theta) }));
}

function matchByArcLength(source, target, samples = 160) {
    const resample = points => {
        const lengths = [0];
        for (let i = 0; i < points.length; i++) lengths.push(lengths[i] + points[i].distanceTo(points[(i + 1) % points.length]));
        const total = lengths[points.length];
        const out = [];
        let segment = 0;
        for (let i = 0; i < samples; i++) {
            const d = i / samples * total;
            while (segment < points.length - 1 && lengths[segment + 1] < d) segment++;
            const p = points[segment], q = points[(segment + 1) % points.length];
            const span = lengths[segment + 1] - lengths[segment];
            out.push(p.clone().lerp(q, span > 0 ? (d - lengths[segment]) / span : 0));
        }
        return out;
    };
    const a = resample(source), b = resample(target);
    let best = 0, bestCost = Infinity;
    for (let k = 0; k < samples; k++) {
        let cost = 0;
        for (let i = 0; i < samples; i++) cost += a[i].distanceToSquared(b[(i + k) % samples]);
        if (cost < bestCost) { bestCost = cost; best = k; }
    }
    return a.map((p, i) => ({ source: p, target: b[(i + best) % samples] }));
}

function matchMorphContours(source, target) {
    // Une seule forme : chaque fragment revient exactement d’où il est parti, sommet
    // pour sommet (source et cible sont le même contour, découpé de la même façon).
    if (SINGLE_SHAPE && source.length === target.length) return source.map((p, i) => ({ source: p, target: target[i] }));
    try { return matchRadially(source, target); } catch (error) { return matchByArcLength(source, target); }
}

// ---- Lecture de la forme -----------------------------------------------------------
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}

function parseShape(svgText) {
    const svg = new SVGLoader().parse(svgText);
    const contours = svg.paths
        .flatMap(path => path.subPaths.map(sub => cleanContour(sub.getPoints(6).map(p => V2(p.x, -p.y)))))
        .filter(contour => contour.length >= 3 && Math.abs(THREE.ShapeUtils.area(contour)) > 1e-9)
        .sort((a, b) => Math.abs(THREE.ShapeUtils.area(b)) - Math.abs(THREE.ShapeUtils.area(a)));
    if (!contours.length) throw new Error('This SVG has no closed contour.');
    const [outline, ...rest] = contours;
    const holes = [], extras = [];
    for (const contour of rest) {
        const centre = new THREE.Box2().setFromPoints(contour).getCenter(V2());
        (pointInPolygon(centre, outline) ? holes : extras).push(contour);
    }
    return { outline, holes, extras };
}

function fitShape(shape, height) {
    const bounds = new THREE.Box2().setFromPoints([shape.outline, ...shape.holes, ...shape.extras].flat());
    const centre = bounds.getCenter(V2());
    const size = bounds.getSize(V2());
    const scale = height / Math.max(size.x, size.y);
    const fit = contour => contour.map(p => p.clone().sub(centre).multiplyScalar(scale));
    return { outline: fit(shape.outline), holes: shape.holes.map(fit), extras: shape.extras.map(fit) };
}

function visibilityKernel(points) {
    const contour = points.slice();
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    const span = new THREE.Box2().setFromPoints(contour).getSize(V2()).length() * 2 + 1;
    let kernel = [V2(-span, -span), V2(span, -span), V2(span, span), V2(-span, span)];
    for (let i = 0; i < contour.length; i++) {
        const a = contour[i];
        const edge = contour[(i + 1) % contour.length].clone().sub(a);
        const clipped = [];
        for (let j = 0; j < kernel.length; j++) {
            const p = kernel[j], q = kernel[(j + 1) % kernel.length];
            const dp = cross2(edge, p.clone().sub(a)), dq = cross2(edge, q.clone().sub(a));
            if (dp >= -1e-10) clipped.push(p);
            if ((dp >= 0) !== (dq >= 0)) clipped.push(p.clone().lerp(q, dp / (dp - dq)));
        }
        kernel = clipped;
        if (!kernel.length) return [];
    }
    return kernel;
}

// Découpe radiale en `count` fragments ; l’angle de départ maximise le pire noyau.
function partitionContour(outline, count) {
    if (count <= 1) return [outline];
    const centre = new THREE.Box2().setFromPoints(outline).getCenter(V2());
    const step = 360 / count;
    let best = null;
    for (let offset = 0; offset < step - 0.001; offset += 5) {
        const pieces = [];
        let worst = Infinity;
        for (let i = 0; i < count; i++) {
            const piece = clipContour(outline, wedgeHalfPlanes(centre, offset + i * step, offset + (i + 1) * step));
            if (piece.length < 3) { worst = -1; break; }
            const kernel = visibilityKernel(piece);
            const ratio = kernel.length ? Math.abs(THREE.ShapeUtils.area(kernel)) / Math.abs(THREE.ShapeUtils.area(piece)) : 0;
            worst = Math.min(worst, ratio);
            pieces.push(piece);
        }
        if (worst >= 0 && (!best || worst > best.worst)) best = { worst, pieces };
    }
    if (!best) throw new Error(`Could not split this shape into ${count} fragments.`);
    return best.pieces;
}

function shapeFragments(fit, count) {
    const wedges = Math.max(1, count - fit.extras.length);
    const extras = fit.extras.map(contour => Object.assign(contour.slice(), { isExtra: true }));
    const pieces = [...partitionContour(fit.outline, wedges), ...extras].slice(0, Math.max(1, count));
    const angle = contour => {
        const c = new THREE.Box2().setFromPoints(contour).getCenter(V2());
        return (Math.atan2(c.y, c.x) + Math.PI * 2) % (Math.PI * 2);
    };
    return pieces.sort((a, b) => angle(a) - angle(b));
}

// ---- La rose en verre -------------------------------------------------------------
function createGlassLogo() {
    createGlassEnvironment();
    modelPivot = new THREE.Group();
    modelPivot.position.y = -0.3;
    scene.add(modelPivot);

    const glass = createGlassMaterial();
    const logo = new THREE.Group();
    logo.rotation.set(-0.08, 0.28, -0.08);
    modelPivot.add(logo);

    const opening = fitShape(parseShape(openingSource), LOGO_HEIGHT);
    const final = fitShape(parseShape(finalSource), ICON_SIZE);
    iconOutline = final.outline;
    iconHoles = final.holes;

    const whole = recentre(opening.outline);
    const wholeShape = new THREE.Shape(whole.contour);
    const wholeOffset = V2(whole.home.x, whole.home.y);
    for (const hole of opening.holes) wholeShape.holes.push(new THREE.Path(hole.map(p => p.clone().sub(wholeOffset))));
    const wholeGeometry = new THREE.ExtrudeGeometry(wholeShape, {
        depth: LOGO_DEPTH, steps: 1, bevelEnabled: true,
        bevelSize: LOGO_BEVEL.size, bevelThickness: LOGO_BEVEL.thickness, bevelSegments: 6, curveSegments: 24
    });
    wholeGeometry.translate(0, 0, -LOGO_DEPTH / 2);
    wholeBody = new THREE.Mesh(wholeGeometry, glass);
    wholeBody.position.copy(whole.home);
    logo.add(wholeBody);

    glassIcon = new THREE.Mesh(makeIconPrism(SEAM_BEVEL, SEAM_BEVEL, 0), glass);
    glassIcon.userData.progress = -1;
    glassIcon.visible = false;
    logo.add(glassIcon);

    const sources = shapeFragments(opening, SITE.fragments);
    const targets = shapeFragments(final, sources.length);
    sources.forEach((sourceContour, index) => {
        const isExtra = !!sourceContour.isExtra;
        const source = recentre(sourceContour);
        const target = recentre(targets[Math.min(index, targets.length - 1)]);
        const geometry = makePrism(source.contour, LOGO_DEPTH, LOGO_BEVEL.size, LOGO_BEVEL.thickness);
        const mesh = new THREE.Mesh(geometry, glass);
        mesh.position.copy(source.home);
        logo.add(mesh);
        const radial = V2(source.home.x, source.home.y);
        if (radial.lengthSq() < 1e-6) radial.set(Math.cos(index), Math.sin(index));
        const offset = new THREE.Vector3(radial.x, radial.y, 0).normalize().multiplyScalar(1.15);
        offset.z = (index % 2 === 0 ? 1 : -1) * 0.55;
        const side = Math.sign(offset.x) || 1, vertical = Math.sign(offset.y) || 1;
        logoPieces.push({
            name: `fragment-${index}`, mesh, home: source.home, offset,
            twist: new THREE.Vector3(vertical * 0.12, side * 0.18, -side * vertical * 0.09),
            targetHome: target.home,
            correspondence: matchMorphContours(source.contour, target.contour),
            originalGeometry: geometry, morphGeometry: null, isBody: !isExtra,
            finalGeometry: isExtra ? makePrism(target.contour, ICON_DEPTH, ICON_BEVEL.size, ICON_BEVEL.thickness) : null,
            targetContour: isExtra ? target.contour : null, extraBevel: -1
        });
    });
}

// ---- Dalle de verre liquide derrière le formulaire ----------------------------------
function roundedRectShape(w, h, r) {
    const shape = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - r, y);
    shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(x + w, y + h - r);
    shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    shape.lineTo(x + r, y + h);
    shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(x, y + r);
    shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return shape;
}

function cardUnitsPerPixel() {
    return 2 * CARD_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / sizes.height;
}

function buildGlassCardGeometry(w, h, unitsPerPixel) {
    const rim = CARD_RIM_PX * unitsPerPixel;
    const radius = Math.max(rim + 0.002, CARD_RADIUS_PX * unitsPerPixel);
    const shape = roundedRectShape(Math.max(0.01, w - 2 * rim), Math.max(0.01, h - 2 * rim), Math.max(0.001, radius - rim));
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: CARD_DEPTH, steps: 1, bevelEnabled: true, bevelSize: rim, bevelThickness: CARD_RIM_DEPTH,
        bevelSegments: 10, curveSegments: 18
    });
    geometry.translate(0, 0, -(CARD_DEPTH + CARD_RIM_DEPTH));
    return geometry;
}

function createGlassCard() {
    if (!contactCardElement) return;
    cardGlass = createGlassMaterial();
    cardGlass.side = THREE.FrontSide;
    cardGlass.color.set('#a99ca6');
    cardGlass.roughness = 0.34;
    cardGlass.thickness = 0.35;
    cardGlass.attenuationColor.set('#2e1420');
    cardGlass.attenuationDistance = 1.8;
    cardGlass.clearcoat = 1.0;
    cardGlass.clearcoatRoughness = 0.14;
    cardGlass.iridescence = 0.18;
    cardGlass.envMapIntensity = 0.55;
    glassCard = new THREE.Mesh(buildGlassCardGeometry(1, 1, 1), cardGlass);
    glassCard.userData = { w: 0, h: 0 };
    glassCard.visible = false;
    camera.add(glassCard);
    document.body.classList.add('has-glass-card');
}

function updateGlassCard() {
    if (!glassCard || !contactCardElement) return;
    // Sur petit écran, le formulaire est très haut : le verre CSS (sombre) reste plus lisible.
    const wide = sizes.width >= 1000 && sizes.width / sizes.height > 1.05;
    if (wide !== document.body.classList.contains('has-glass-card')) document.body.classList.toggle('has-glass-card', wide);
    glassCard.visible = wide && targetContact > 0.001;
    if (!glassCard.visible) return;
    const rect = contactCardElement.getBoundingClientRect();
    const upp = cardUnitsPerPixel();
    const w = rect.width * upp, h = rect.height * upp;
    if (Math.abs(glassCard.userData.w - w) > 0.003 || Math.abs(glassCard.userData.h - h) > 0.003) {
        glassCard.geometry.dispose();
        glassCard.geometry = buildGlassCardGeometry(w, h, upp);
        glassCard.userData = { w, h };
    }
    const cx = rect.left + rect.width / 2 - sizes.width / 2;
    const cy = sizes.height / 2 - (rect.top + rect.height / 2);
    glassCard.position.set(cx * upp, cy * upp, -CARD_DISTANCE);
    glassCard.rotation.set(-mouseY * 0.02, mouseX * 0.025, 0);
}

// La cinématique se joue sur la scène (#stage) ; le contact a sa propre progression.
function stageMaxScroll() {
    return Math.max(1, stageElement.offsetHeight - window.innerHeight);
}
function contactProgress(scrollTop) {
    if (!contactSection) return 0;
    const top = contactSection.getBoundingClientRect().top + scrollTop;
    return THREE.MathUtils.clamp((scrollTop + window.innerHeight - top) / window.innerHeight, 0, 1);
}

function smoothScrollRange(scroll, start, end) {
    const t = THREE.MathUtils.clamp((scroll - start) / (end - start), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

// Cadrage : en paysage, la rose est poussée sur le côté libre de chaque chapitre ;
// en portrait, la caméra recule et la rose alterne moitié basse / moitié haute.
function cameraFrame(scroll) {
    const aspect = sizes.width / sizes.height;
    const portrait = THREE.MathUtils.clamp((1.0 - aspect) / 0.2, 0, 1);
    const separation = getLogoSeparation(scroll);
    const morph = smoothScrollRange(scroll, 0.40, 0.54);
    const landscapeRadius = 4.7 - Math.sin(scroll * Math.PI) * 0.6 + separation * 2.6 + morph * 0.9;
    const portraitRadius = 8.9 - Math.sin(scroll * Math.PI) * 0.4 + separation * 2.0 + morph * 0.4;
    const radius = lerp(landscapeRadius, portraitRadius, portrait);
    const ch1 = 1 - smoothScrollRange(scroll, 0.12, 0.24);
    const ch2 = smoothScrollRange(scroll, 0.12, 0.24) - smoothScrollRange(scroll, 0.40, 0.50);
    const ch3 = smoothScrollRange(scroll, 0.52, 0.62) - smoothScrollRange(scroll, 0.74, 0.86);
    const ch4 = smoothScrollRange(scroll, 0.74, 0.86);
    const x = (-1.55 * ch1 + 1.5 * ch2 - 1.8 * ch3 - 1.45 * ch4) * (1 - portrait);
    const stack = 1 - 2 * smoothScrollRange(scroll, 0.16, 0.26)
        + 2 * smoothScrollRange(scroll, 0.44, 0.54)
        - 2 * smoothScrollRange(scroll, 0.72, 0.82);
    const visibleHeight = 2 * radius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const y = -0.15 + portrait * stack * (stack > 0 ? 0.20 : 0.19) * visibleHeight;
    const phi = scroll * Math.PI * 2.0;
    const right = new THREE.Vector3(Math.cos(phi), 0, -Math.sin(phi));
    const lookAt = new THREE.Vector3(0, y, 0).addScaledVector(right, x);
    return { radius, lookAt, portrait };
}

function getLogoSeparation(scroll) {
    return smoothScrollRange(scroll, 0.12, 0.28) * (1 - smoothScrollRange(scroll, 0.40, 0.54));
}

function cachedGeometry(owner, key, build) {
    const cache = owner.geometryCache || (owner.geometryCache = new Map());
    let geometry = cache.get(key);
    if (geometry) cache.delete(key);
    else geometry = build();
    cache.set(key, geometry);
    if (cache.size > 24) {
        const oldest = cache.keys().next().value;
        cache.get(oldest).dispose();
        cache.delete(oldest);
    }
    return geometry;
}
const geometryStep = value => Math.round(value * 96) / 96;

function updateLogoPieces(scroll) {
    const separation = getLogoSeparation(scroll);
    const morph = smoothScrollRange(scroll, 0.40, 0.54);
    const geometryMorph = geometryStep(morph);
    const complete = morph >= 1;
    const assembled = separation <= 0 && morph <= 0;
    if (wholeBody) wholeBody.visible = assembled;
    if (glassIcon) {
        glassIcon.visible = complete;
        if (complete) {
            const bevel = geometryStep(smoothScrollRange(scroll, 0.54, 0.56));
            const hole = geometryStep(smoothScrollRange(scroll, 0.54, 0.60));
            const key = `${bevel}:${hole}`;
            if (key !== glassIcon.userData.progress) {
                if (!glassIcon.geometryCache) glassIcon.geometry.dispose();
                glassIcon.geometry = cachedGeometry(glassIcon, key, () => makeIconPrism(
                    lerp(SEAM_BEVEL, ICON_BEVEL.size, bevel), lerp(SEAM_BEVEL, ICON_BEVEL.thickness, bevel), hole));
                glassIcon.userData.progress = key;
            }
        }
    }
    for (const piece of logoPieces) {
        const { mesh, home, targetHome, offset, twist, correspondence } = piece;
        mesh.visible = piece.isBody ? !complete && !assembled : true;
        mesh.position.copy(home).lerp(targetHome, morph).addScaledVector(offset, separation);
        mesh.rotation.set(twist.x * separation, twist.y * separation, twist.z * separation);
        if (!mesh.visible) continue;
        if (!piece.isBody && complete) {
            const bevel = geometryStep(smoothScrollRange(scroll, 0.54, 0.56));
            mesh.geometry = bevel >= 1 ? piece.finalGeometry : cachedGeometry(piece, `extra:${bevel}`,
                () => makePrism(piece.targetContour, ICON_DEPTH, lerp(SEAM_BEVEL, ICON_BEVEL.size, bevel), lerp(SEAM_BEVEL, ICON_BEVEL.thickness, bevel)));
        } else if (morph <= 0) {
            mesh.geometry = piece.originalGeometry;
        } else {
            mesh.geometry = cachedGeometry(piece, `morph:${geometryMorph}`, () => {
                const contour = correspondence.map(({ source, target }) => source.clone().lerp(target, geometryMorph));
                return makePrism(contour, lerp(LOGO_DEPTH, ICON_DEPTH, geometryMorph),
                    lerp(LOGO_BEVEL.size, SEAM_BEVEL, geometryMorph), lerp(LOGO_BEVEL.thickness, SEAM_BEVEL, geometryMorph));
            });
        }
    }
}

// ---- Fond : volumes et plis lumineux aux couleurs des chapitres ----------------------
function createBackgroundShader() {
    const vertexShader = `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `;
    const fragmentShader = `
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uMouse;
        uniform float uScroll;
        uniform float uVelocity;
        mat2 rotate2d(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
        float fineLine(float d, float width) { return 1.0 - smoothstep(width, width + 1.5 / uResolution.y, abs(d)); }
        uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
        vec3 chapterColor(float progress) {
            if (progress < 0.34) return mix(uC0, uC1, smoothstep(0.02, 0.32, progress));
            if (progress < 0.62) return mix(uC1, uC2, smoothstep(0.36, 0.60, progress));
            if (progress < 1.0) return mix(uC2, uC3, smoothstep(0.66, 0.94, progress));
            return mix(uC3, uC4, smoothstep(1.0, 1.2, progress));
        }
        void main() {
            vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
            float s = uScroll;
            float time = uTime * 0.065;
            vec3 primary = chapterColor(s);
            vec3 secondary = chapterColor(min(1.22, s + 0.18));
            vec3 color = vec3(0.006, 0.003, 0.006);
            vec2 haloUv = (uv - vec2(0.16 + 0.16 * sin(s * 4.0), 0.14)) * vec2(1.20, 1.8);
            float halo = exp(-dot(haloUv, haloUv) * 2.8);
            vec2 lowerUv = (uv + vec2(0.40, 0.30)) * vec2(1.6, 2.6);
            color += primary * halo * 0.15;
            color += secondary * exp(-dot(lowerUv, lowerUv) * 2.0) * 0.045;
            vec2 p = rotate2d(-0.24 + s * 0.65) * (uv - vec2(0.06, -0.08));
            p += uMouse * 0.018;
            p.x += 0.15 * sin(p.y * 2.8 + s * 4.8 + time * 0.3);
            p.y += 0.09 * cos(p.x * 3.1 - s * 3.8 - time * 0.2);
            for (int i = 0; i < 3; i++) {
                float k = float(i);
                vec2 q = p + vec2(0.0, 0.012 * sin(time + k));
                float radius = length(q * vec2(0.90, 1.22));
                float angle = atan(q.y, q.x);
                float contour = 0.34 + k * 0.145 + 0.075 * sin(angle * 2.0 + s * 5.0 + k * 0.28) + 0.022 * cos(angle * 3.0 - time);
                float d = radius - contour;
                float arc = smoothstep(-0.65, 0.65, sin(angle + k * 0.55 + s * 3.5));
                vec3 tint = mix(primary, secondary, k * 0.38);
                float body = exp(-pow(d * 25.0, 2.0));
                float shoulder = exp(-pow((d + 0.018) * 13.0, 2.0));
                color += tint * (body * 0.11 + shoulder * 0.028) * arc;
                color += mix(tint, vec3(0.96, 0.82, 0.88), 0.20) * fineLine(d, 0.0008) * arc * (0.16 + uVelocity * 0.06);
            }
            vec2 gridUv = rotate2d(-0.20 + s * 0.18) * uv + vec2(s * 0.08, s * 0.16);
            vec2 cell = abs(fract(gridUv * 10.0) - 0.5);
            float grid = max(fineLine((0.5 - cell.x) / 10.0, 0.0002), fineLine((0.5 - cell.y) / 10.0, 0.0002));
            float periphery = smoothstep(0.28, 0.80, length(uv));
            color += primary * grid * periphery * 0.025;
            float vignette = 1.0 - smoothstep(0.36, 1.20, length(uv * vec2(0.8, 1.0)));
            color *= mix(0.25, 1.0, vignette);
            float textShade = (1.0 - smoothstep(-0.5, 0.1, uv.y)) * (1.0 - smoothstep(-0.25, 0.3, uv.x));
            color *= 1.0 - textShade * 0.38;
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    bgMaterial = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: shaderUniforms, depthWrite: false, depthTest: false });
    bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), bgMaterial);
    bgMesh.position.set(0.0, 0.0, -8.0);
    bgMesh.renderOrder = -10;
    camera.add(bgMesh);
}

function onWindowResize() {
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.25 : 1.5));
    renderer.getDrawingBufferSize(shaderUniforms.uResolution.value);
}

window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    targetMouseX = (event.clientX / window.innerWidth) * 2 - 1;
    targetMouseY = (event.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });
window.addEventListener('resize', () => { onWindowResize(); headerState.chapter = -1; fitTitles(); });

// Titres des chapitres : chaque ligne monte de son propre masque, la seconde en gris.
function splitTitlesIntoLines() {
    document.querySelectorAll('.slide-title').forEach(title => {
        if (title.querySelector('.line')) return;
        const parts = title.innerHTML.split(/(<br\s*\/?>)/i);
        let html = '', line = 0;
        parts.forEach(part => {
            if (part.toLowerCase().startsWith('<br')) { line++; return; }
            html += `<span class="line${line > 0 ? ' muted' : ''}"><span class="line-inner">${part.trim()}</span></span>`;
        });
        title.innerHTML = html;
    });
}
// Deux lignes, jamais trois : un titre trop large rétrécit jusqu’à tenir.
function fitTitles() {
    document.querySelectorAll('.slide-title').forEach(title => {
        title.style.fontSize = '';
        const lines = [...title.querySelectorAll('.line-inner')];
        if (!lines.length) return;
        const widest = Math.max(...lines.map(line => {
            const range = document.createRange();
            range.selectNodeContents(line);
            return range.getBoundingClientRect().width;
        }));
        const available = title.clientWidth;
        if (widest > available && available > 0) {
            const size = parseFloat(getComputedStyle(title).fontSize);
            title.style.fontSize = `${Math.floor(size * available / widest * 0.985)}px`;
        }
    });
}

let animationRequest = 0;
let lastFrameAt = 0;
let lastInputAt = performance.now();
let stageShown = true;
for (const event of ['scroll', 'pointermove', 'pointerdown', 'keydown', 'resize']) {
    window.addEventListener(event, () => { lastInputAt = performance.now(); }, { passive: true });
}
document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(animationRequest);
    animationRequest = 0;
    if (!document.hidden) {
        clock.getDelta();
        lastFrameAt = 0;
        lastInputAt = performance.now();
        animationRequest = requestAnimationFrame(animate);
    }
});

function animate(now = performance.now()) {
    if (document.hidden) return;
    animationRequest = requestAnimationFrame(animate);
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const maxScroll = stageMaxScroll();
    const targetScroll = THREE.MathUtils.clamp(scrollTop / maxScroll, 0, 1);
    targetContact = contactProgress(scrollTop);

    // La scène n’est visible que sur la cinématique et dans le contact : ailleurs,
    // des sections opaques la recouvrent, on arrête donc de dessiner.
    const visible = scrollTop < stageElement.offsetHeight + 40 || targetContact > 0;
    if (visible !== stageShown) {
        stageShown = visible;
        root.classList.toggle('stage-covered', !visible);
    }
    const inContact = targetContact > 0.02;
    if (inContact !== root.classList.contains('in-contact')) root.classList.toggle('in-contact', inContact);
    const unsettled = Math.abs(targetScroll - currentScroll) > 0.0001 || Math.abs(targetContact - currentContact) > 0.0001;
    const fps = !visible ? 4 : unsettled || now - lastInputAt < 1500 ? 60 : 30;
    if (lastFrameAt && now - lastFrameAt < 1000 / fps - 1) return;
    lastFrameAt = now;
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    const damping = factor => 1 - Math.pow(1 - factor, deltaTime * 60);

    currentScroll += (targetScroll - currentScroll) * damping(0.025);
    currentContact += (targetContact - currentContact) * damping(0.06);
    if (Math.abs(targetContact - currentContact) < 0.0015) currentContact = targetContact;
    if (!visible) { currentScroll = targetScroll; updateSlides(currentScroll); return; }

    mouseX += (targetMouseX - mouseX) * damping(0.05);
    mouseY += (targetMouseY - mouseY) * damping(0.05);

    if (modelPivot) {
        // Contact : la rose dérive vers le haut et la gauche, loin du formulaire
        // (plus loin encore en portrait, où le formulaire occupe toute la largeur).
        const exit = smoothScrollRange(currentContact, 0, 0.85);
        const tall = THREE.MathUtils.clamp((1.0 - sizes.width / sizes.height) / 0.2, 0, 1);
        modelPivot.rotation.y = mouseX * 0.25 + exit * 1.35;
        modelPivot.rotation.x = mouseY * 0.15 - exit * 0.35;
        modelPivot.rotation.z = exit * 0.55;
        modelPivot.position.set(-exit * (3.4 + tall * 2.2), -0.3 + exit * (4.8 + tall * 4.5), -exit * 1.2);
        modelPivot.scale.setScalar(1 - exit * 0.5);
    }

    if (sparkParticles) {
        const positions = sparkParticles.geometry.attributes.position.array;
        const time = clock.getElapsedTime();
        const scrollVelocity = Math.abs(targetScroll - currentScroll);
        const speedMultiplier = 1.0 + scrollVelocity * 9.0;
        const turbulence = scrollVelocity * 0.8;
        for (let i = 0; i < sparkCount; i++) {
            const idx = i * 3;
            const data = sparkData[i];
            positions[idx] += data.speedX * deltaTime * speedMultiplier;
            positions[idx + 1] += data.speedY * deltaTime * speedMultiplier;
            positions[idx + 2] += data.speedZ * deltaTime * speedMultiplier;
            const currentSway = data.swayRadius * (1.0 + turbulence * 4.0);
            positions[idx] += Math.sin(time * data.swaySpeed + data.phase) * currentSway * deltaTime;
            positions[idx + 2] += Math.cos(time * data.swaySpeed + data.phase) * currentSway * deltaTime;
            if (positions[idx + 1] > 3.0 || Math.abs(positions[idx]) > 3.5 || Math.abs(positions[idx + 2]) > 3.5) {
                positions[idx + 1] = -2.5;
                positions[idx] = (Math.random() - 0.5) * 3.0;
                positions[idx + 2] = (Math.random() - 0.5) * 3.0;
            }
        }
        sparkParticles.geometry.attributes.position.needsUpdate = true;
    }

    const frame = cameraFrame(currentScroll);
    const phi = currentScroll * Math.PI * 2.0;
    const y = 0.35 + Math.sin(currentScroll * Math.PI) * 0.8;
    const targetPos = new THREE.Vector3(frame.radius * Math.sin(phi), y, frame.radius * Math.cos(phi));
    camera.position.lerp(targetPos, damping(0.025));
    camera.lookAt(frame.lookAt);
    updateGlassCard();

    shaderUniforms.uTime.value = clock.getElapsedTime();
    shaderUniforms.uMouse.value.set(mouseX, -mouseY);
    shaderUniforms.uScroll.value = currentScroll + currentContact * 0.22;
    shaderUniforms.uVelocity.value += (Math.min(1, Math.abs(targetScroll - currentScroll) * 14) - shaderUniforms.uVelocity.value) * damping(0.06);

    updateLogoPieces(currentScroll);
    updateSlides(currentScroll);
    updateHeader(currentScroll);
    renderer.render(scene, camera);
}

// En-tête : compteur de chapitre et trait de progression de la cinématique.
const headerState = { chapter: -1, progress: '' };
function updateHeader(scroll) {
    const chapter = targetContact > 0.02 ? 4 : scroll < 0.20 ? 0 : scroll < 0.48 ? 1 : scroll < 0.76 ? 2 : 3;
    if (chapter !== headerState.chapter) {
        headerState.chapter = chapter;
        const counter = document.getElementById('brand-chapter');
        if (counter) counter.textContent = String(chapter + 1).padStart(2, '0');
    }
    const fill = document.getElementById('header-progress-fill');
    if (fill) {
        const progress = `${(Math.min(1, scroll) * 100).toFixed(2)}%`;
        if (progress !== headerState.progress) { fill.style.width = progress; headerState.progress = progress; }
    }
}

// Fenêtres des chapitres (défilement lissé) et temps de maintien : un texte reste au
// moins SLIDE_MIN_SHOW ms et s’attarde SLIDE_LEAVE_HOLD ms après la sortie de sa fenêtre.
const SLIDE_WINDOWS = [[-0.10, 0.15], [0.26, 0.43], [0.54, 0.71], [0.82, 1.05]];
const SLIDE_MIN_SHOW = 1500, SLIDE_LEAVE_HOLD = 400;
const slideState = SLIDE_WINDOWS.map(() => ({ active: false, since: 0, left: 0 }));
const slides = [1, 2, 3, 4].map(i => document.getElementById(`slide-${i}`));
const dashes = [1, 2, 3, 4].map(i => document.getElementById(`dash-fill-${i}`));
function updateSlides(scroll) {
    dashes.forEach((fill, index) => {
        if (!fill) return;
        const progress = Math.max(0, Math.min(1, (scroll - index * 0.25) / 0.25));
        fill.style.height = `${progress * 100}%`;
    });
    const now = performance.now();
    const loading = root.classList.contains('is-loading');
    const contactOpen = targetContact > 0.02;
    const inside = SLIDE_WINDOWS.map(([start, end]) => !loading && !contactOpen && scroll >= start && scroll <= end);
    const current = inside.indexOf(true);
    const actives = slideState.map((state, index) => {
        if (current === index) {
            if (!state.active) state.since = now;
            state.active = true;
            state.left = 0;
            return true;
        }
        if (state.active && current === -1 && !contactOpen && !loading) {
            if (!state.left) state.left = now;
            if (now - state.since < SLIDE_MIN_SHOW || now - state.left < SLIDE_LEAVE_HOLD) return true;
        }
        state.active = false;
        state.left = 0;
        return false;
    });
    slides.forEach((slide, index) => {
        if (slide && slide.classList.contains('active') !== actives[index]) {
            slide.classList.toggle('active', actives[index]);
            slide.toggleAttribute('inert', !actives[index]);
        }
    });
    playFigures(actives[3]);
}

// Chapitre 4 : les chiffres comptent à chaque apparition.
let figuresPlaying = false, figuresShown = false;
function playFigures(show) {
    const values = document.querySelectorAll('.figure-value');
    if (!values.length || show === figuresShown) return;
    figuresShown = show;
    if (!show) { values.forEach(el => { el.textContent = (0).toFixed(Number(el.dataset.decimals || 0)); }); return; }
    const begin = performance.now(), duration = 1400;
    const token = Symbol('figures');
    figuresPlaying = token;
    const frame = t0 => {
        if (figuresPlaying !== token) return;
        const t = Math.min(1, (t0 - begin) / duration);
        const eased = 1 - Math.pow(1 - t, 4);
        values.forEach(el => {
            const target = Number(el.dataset.count || 0), decimals = Number(el.dataset.decimals || 0);
            el.textContent = (target * eased).toFixed(decimals);
        });
        if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

// Crochets de contrôle (captures automatisées) : place le défilement lissé.
window.__glassSite = {
    snap(value) {
        window.scrollTo(0, stageMaxScroll() * value);
        currentScroll = value;
        currentContact = targetContact = 0;
        const phi = value * Math.PI * 2.0;
        const { radius } = cameraFrame(value);
        if (camera) camera.position.set(radius * Math.sin(phi), 0.35 + Math.sin(value * Math.PI) * 0.8, radius * Math.cos(phi));
    },
    get scroll() { return currentScroll; },
    get contact() { return currentContact; },
    get pieces() { return logoPieces.map(p => ({ name: p.name, points: p.correspondence.length })); }
};
window.__rnStage = { get progress() { return currentScroll; }, get contact() { return currentContact; } };

function init() {
    splitTitlesIntoLines();
    fitTitles();
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.FogExp2('#000000', 0.01);
    camera = new THREE.PerspectiveCamera(50, sizes.width / sizes.height, 0.1, 100);
    camera.position.set(0, 0.2, 3.0);
    scene.add(camera);
    createBackgroundShader();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.25 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.2;
    scene.add(new THREE.AmbientLight('#ffffff', 0.1));
    const keyLight = new THREE.SpotLight('#ffffff', 18.0);
    keyLight.position.set(4, 6, 3);
    keyLight.angle = Math.PI / 4;
    keyLight.penumbra = 0.9;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight('#ffe6f0', 10.0);
    rimLight.position.set(-5, 3, -4);
    scene.add(rimLight);
    const fillLight = new THREE.DirectionalLight('#fff3e6', 0.8);
    fillLight.position.set(-2, -4, 2);
    scene.add(fillLight);

    createSparks();
    createGlassLogo();
    createGlassCard();
    onWindowResize();
    if (glassCard) {
        glassCard.visible = true;
        renderer.compile(scene, camera);
        glassCard.visible = false;
    }
    canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); fallback('contexte WebGL perdu'); });
    root.classList.add('webgl');
    document.querySelector('.slide-title')?.getBoundingClientRect();
    animate();
    const release = () => { fitTitles(); releaseLoader(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(release, release); else release();
}
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init, { once: true });
else init();
}
