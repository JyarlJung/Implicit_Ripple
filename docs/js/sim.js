
'use strict';

var gl = null;
var params = null;
var shaders = null;
var fields = null;

var sim = {
    canvas: null,
    quad: null,
    currentTime: 0,
    delta_t: 0,
    paused: false,
    fpsDisplay: null
}

var env = {
    isMobile: false,
    isFirefox: false,
    textureType: null,
    supportsLinearSampling: false,
    filtering: null
}

var impulse = {
    inkActive: false,
    currentPos: null,
    delta: null
}

window.onload = init;
window.addEventListener('error', (e) => { alert("Error: " + e.message) });

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class FBO {
    constructor(width, height) {
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, env.filtering);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, env.filtering);
        // HACK: find a better way to handle firefox
        let format = env.isFirefox ? gl.RGBA : gl.RGB;
        gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, env.textureType, null);

        this.buffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.buffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

        let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status != gl.FRAMEBUFFER_COMPLETE) {
            throw `Could not create FBO, status: ${status}`;
        }

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    clear() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.buffer);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}

class SwapFBO {
    constructor(width, height) {
        this.front = new FBO(width, height);
        this.back = new FBO(width, height);
    }

    swap() {
        let temp = this.front;
        this.front = this.back;
        this.back = temp;
    }

    clear() {
        this.front.clear();
        this.back.clear();
    }
}

class VertexList {
    constructor(vertices, indices) {
        this.vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        this.ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    bind() {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
    }
}

class ShaderProgram {
    constructor(vert, frag) {
        this.vert = vert;
        this.frag = frag;
        this.program = gl.createProgram();
        gl.attachShader(this.program, this.vert.shader);
        gl.attachShader(this.program, this.frag.shader);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            let err = gl.getProgramInfoLog(this.program);
            throw `An error occured while linking a shader program: ${err}`;
        }
    }

    use() {
        gl.useProgram(this.program);
    }

    getUniformLocation(name) {
        let loc = gl.getUniformLocation(this.program, name);
        if (loc == null) {
            //let count = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
            //for (let i = 0; i < count; i++) {
            //    let uname = gl.getActiveUniform(this.program, i).name;
            //    console.log('Uniform: ' + uname);
            //}

            //throw `Uniform not found: ${name}`;
        }
        return loc;
    }

    setFloat(name, value) {
        gl.uniform1f(this.getUniformLocation(name), value);
    }

    setInt(name, value) {
        gl.uniform1i(this.getUniformLocation(name), value);
    }

    setTexture(name, texture, unit) {
        this.setInt(name, unit);
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    setVec2(name, x, y) {
        gl.uniform2f(this.getUniformLocation(name), x, y);
    }

    setVec2(name, vec) {
        gl.uniform2f(this.getUniformLocation(name), vec.x, vec.y);
    }

    setVec3(name, x, y, z) {
        gl.uniform3f(this.getUniformLocation(name), x, y, z);
    }

    setVec3(name, vec) {
        gl.uniform3f(this.getUniformLocation(name), vec.x, vec.y, vec.z);
    }

    setVec4(name, x, y, z, w) {
        gl.uniform4f(this.getUniformLocation(name), x, y, z, w);
    }
}

class Shader {
    constructor(type, source) {
        this.shader = gl.createShader(type);
        gl.shaderSource(this.shader, source);
        gl.compileShader(this.shader);

        if (!gl.getShaderParameter(this.shader, gl.COMPILE_STATUS)) {
            let error = gl.getShaderInfoLog(this.shader);
            gl.deleteShader(this.shader);
            throw `An error occurred compiling a shader: ${error}`;
        }
    }
}

class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    subtract(other) {
        return new Vec2(this.x - other.x, this.y - other.y);
    }

    mul(vec) {
        return new Vec2(this.x * vec.x, this.y * vec.y);
    }

    mulf(scale) {
        return new Vec2(this.x * scale, this.y * scale);
    }
}

class Vec3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    subtract(other) {
        return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
    }
}

function init() {
    env.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    env.isFirefox = /Firefox/i.test(navigator.userAgent);

    sim.canvas = document.getElementById('mainCanvas');
    
    if (env.isMobile) {
        let w = (window.innerWidth > 0) ? window.innerWidth : screen.width;
        if (w <= 400) {
            sim.canvas.width = w;
            sim.canvas.height = w;
        }
    }

    gl = sim.canvas.getContext('webgl');

    if (gl == null) {
        alert('Your browser or device does not support webgl :(');
        return;
    }

    // On my iphone this extension is supported but trying to render to it doesn't work
    if (!env.isMobile) {
        let fullFloatExt = gl.getExtension('OES_texture_float');
        if (fullFloatExt != null) {
            env.textureType = gl.FLOAT;

            let linearFilteringExt = gl.getExtension('OES_texture_float_linear');
            if (linearFilteringExt != null) {
                env.supportsLinearSampling = true;
            }
        }
    }

    if (env.textureType == null) {
        let halfFloatExt = gl.getExtension('OES_texture_half_float');
        if (halfFloatExt != null) {
            env.textureType = halfFloatExt.HALF_FLOAT_OES;

            let linearFilteringExt = gl.getExtension('OES_texture_half_float_linear');
            if (linearFilteringExt != null) {
                env.supportsLinearSampling = true;
            }
        }
    }

    if (env.textureType == null) {
        alert('Your browser or device does not support floating point textures :(');
        return;
    }

    env.filtering = env.supportsLinearSampling ? gl.LINEAR : gl.NEAREST;

    sim.fpsDisplay = document.getElementById('fpsText');

    let w = gl.canvas.width;
    let h = gl.canvas.height;

    let c = new Vec2(1 - 1.5/w, 1 - 1.5/h);
    let quadVerts = [c.x, -c.y,
                     c.x,  c.y,
                    -c.x,  c.y,
                    -c.x, -c.y]

    sim.quad = new VertexList(quadVerts, [0, 1, 3, 1, 2, 3]);

    c = new Vec2(1 - 0.5/w, 1 - 0.5/h);

    let vshader = new Shader(gl.VERTEX_SHADER, glsl.vert);

    shaders = {
        impulse: new ShaderProgram(vshader, new Shader(gl.FRAGMENT_SHADER, glsl.impulse)),
        jacobi: new ShaderProgram(vshader, new Shader(gl.FRAGMENT_SHADER, glsl.jacobi)),
        damping: new ShaderProgram(vshader, new Shader(gl.FRAGMENT_SHADER, glsl.damping)),
        scalarVis: new ShaderProgram(vshader, new Shader(gl.FRAGMENT_SHADER, glsl.scalar_vis)),

        copy: new ShaderProgram(vshader, new Shader(gl.FRAGMENT_SHADER, glsl.copy))
    }

    let rdv = new Vec2(1 / w, 1 / h);
    for (const prop in shaders) {
        shaders[prop].use();
        shaders[prop].setVec2('stride', rdv);
    }

    fields = {
        ink: new SwapFBO(w, h),
        temp: new FBO(w, h)
    }

    params = {
        dtScale: 0.5,
        damping: 0.995,
        iteration: 20,

        rdv: rdv,
        inkVolume: 0.0001,
        inkColour: new Vec3(1.0, 0.0, 0.0),
    }

    setupParamsForm(params);

    sim.canvas.addEventListener('mousedown', e => mouseEvent('down', e, false, e.button == 2));
    sim.canvas.addEventListener('mouseup', e => mouseEvent('up', e, false, e.button == 2));
    sim.canvas.addEventListener('mousemove', e => mouseEvent('move', e, false, e.button == 2));

    sim.canvas.addEventListener('touchstart', e => mouseEvent('down', e, true, false));
    sim.canvas.addEventListener('touchend', e => mouseEvent('up', e, true, false));
    sim.canvas.addEventListener('touchmove', e => mouseEvent('move', e, true, false));
    sim.canvas.addEventListener('contextmenu', e => { e.preventDefault(); return false; });

    document.getElementById('btnUpdate').addEventListener('click', updateFromParamVars);
    document.getElementById('btnClear').addEventListener('click', clearFields);
    document.getElementById('btnPause').addEventListener('click', toggleSimulation);
    document.addEventListener('keydown', e => { if (e.key == 'p') { toggleSimulation(); } });


    window.requestAnimationFrame(tick);
}

function getRelativeMousePos(mouse) {
    let rect = sim.canvas.getBoundingClientRect();
    let scx = sim.canvas.width / rect.width;
    let scy = sim.canvas.height / rect.height;
    let x = (mouse.clientX - rect.left) * scx;
    let y = (mouse.clientY - rect.top) * scy;
    return new Vec2(x, y);
}

function mouseEvent(type, event, isTouch, isRightButton) {
    let pos;

    if (isTouch) {
        event.preventDefault();
        let idx = event.changedTouches.length - 1;
        pos = getRelativeMousePos(event.changedTouches[idx]);
    }
    else {
        pos = getRelativeMousePos(event);
    }

    if (type == 'down') {
        if (!impulse.inkActive) {
            impulse.inkActive = !isRightButton;
            impulse.currentPos = new Vec2(pos.x, sim.canvas.height - pos.y);
            impulse.lastPos = impulse.currentPos;
            impulse.delta = new Vec2(0, 0);
        }
    }
    else if (type == 'up') {
        impulse.currentPos = null;
        impulse.lastPos = null;
        impulse.inkActive = false;
    }
    else if (type == 'move') {
        if (impulse.inkActive) {
            let temp = impulse.currentPos;
            impulse.currentPos = new Vec2(pos.x, sim.canvas.height - pos.y);
            impulse.lastPos = temp;
            impulse.delta = impulse.currentPos.subtract(impulse.lastPos);
        }
    }
}

function setupParamsForm(params) {

    document.getElementById('txtDeltaTimeScale').value = params.dtScale;
    document.getElementById('txtDamping').value = params.damping;
    document.getElementById('txtIteration').value = params.iteration;
}


function updateFromParamVars() {
    params.dtScale = parseFloat(document.getElementById('txtDeltaTimeScale').value);
    params.damping = parseFloat(document.getElementById('txtDamping').value);
    params.iteration = parseInt(document.getElementById('txtIteration').value);
}


function toggleSimulation() {
    let btn = document.getElementById('btnPause');
    sim.paused = !sim.paused;
    if (sim.paused) {
        btn.innerText = 'Play';
    }
    else {
        btn.innerText = 'Pause';
    }
}

function clearFields() {
    for (const field in fields) {
        fields[field].clear();
    }
}

function tick(timestamp) {
    timestamp /= 1000;
    sim.delta_t = sim.currentTime == 0 ? 0.016667 : timestamp - sim.currentTime;
    sim.currentTime = timestamp;

    if (!sim.paused) {
        let fps = (1 / sim.delta_t).toFixed(2);
        sim.fpsDisplay.innerText = `FPS: ${fps} Hz`;

        computeFields();
    }

    let outputTexture = null;

    outputTexture = fields.ink.front.texture;

    shaders.scalarVis.use();
    shaders.scalarVis.setTexture('field', outputTexture, 0);
    drawQuad(null);

    window.requestAnimationFrame(tick);
}

function computeFields() {
   
    if (impulse.inkActive) {
        let colour;

        colour = params.inkColour;

        shaders.impulse.use();
        shaders.impulse.setFloat('radius', params.inkVolume);
        shaders.impulse.setVec2('position', impulse.currentPos.mul(params.rdv));
        shaders.impulse.setVec3('force', colour);
        shaders.impulse.setInt('radial', 0);
        shaders.impulse.setTexture('velocity', fields.ink.front.texture, 0);
        drawQuad(fields.ink.back.buffer);
        fields.ink.swap();
    }

    solvePoissonSystem(fields.ink, fields.ink.front, sim.delta_t * params.dtScale);

    shaders.damping.use();
    shaders.damping.setFloat('damp', params.damping);
    shaders.damping.setTexture('field', fields.ink.front.texture, 0);
    drawQuad(fields.ink.back.buffer);
    fields.ink.swap();
    
}

function solvePoissonSystem(swapFBO, initialValue, dt) {
    copyFBO(fields.temp, initialValue);
    shaders.jacobi.use();
    shaders.jacobi.setFloat('dt', dt);
    shaders.jacobi.setTexture('b', fields.temp.texture, 1);

    for (let i = 0; i < params.iteration; i++) {
        shaders.jacobi.setTexture('x', swapFBO.front.texture, 0);
        drawQuad(swapFBO.back.buffer);
        swapFBO.swap();
    }
}

function copyFBO(dest, src) {
    shaders.copy.use();
    shaders.copy.setTexture('field', src.texture, 0);
    drawQuad(dest.buffer);
}

function drawQuad(buffer) {
    sim.quad.bind();
    gl.enableVertexAttribArray(0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

var glsl = {
    vert: `
precision highp float;

attribute vec3 vertex;

uniform vec2 stride;

varying vec2 coord;
varying vec2 pxL;
varying vec2 pxR;
varying vec2 pxT;
varying vec2 pxB;

vec2 centerhalf(vec2 v)
{
    return v * 0.5 + 0.5;
}

void main()
{
    gl_Position = vec4(vertex.xy, 0.0, 1.0);

    coord = centerhalf(vertex.xy);
    pxL = coord - vec2(stride.x, 0);
    pxR = coord + vec2(stride.x, 0);
    pxB = coord - vec2(0, stride.y);
    pxT = coord + vec2(0, stride.y);
}`,
    impulse: `
precision highp float;

uniform vec2 position;		// Cursor position
uniform vec3 force;			// The force
uniform float radius;		// Radius of gaussian splat
uniform sampler2D velocity;	// Velocity field
uniform bool radial;

varying vec2 coord;

void main()
{
	vec2 diff = position - coord;
	float x = -dot(diff,diff) / radius;
    vec3 impulse = radial ? vec3(normalize(diff), 0.0) : force;
	vec3 effect = impulse * exp(x);
	vec3 u0 = texture2D(velocity, coord).xyz;
    u0 += effect;

	gl_FragColor = vec4(u0, 1.0);
}`,
    jacobi: `precision highp float;

uniform float dt;
uniform sampler2D x;
uniform sampler2D b;

varying vec2 coord;
varying vec2 pxT;
varying vec2 pxB;
varying vec2 pxL;
varying vec2 pxR;

void main()
{
    float xL = texture2D(x, pxL).x;
    float xR = texture2D(x, pxR).x;
    float xB = texture2D(x, pxB).x;
    float xT = texture2D(x, pxT).x;
    float bC = texture2D(b, coord).x;
    float bP = texture2D(b, coord).y;

    float c = 44.194;

    float dtt = (dt * c) * (dt * c);
    float avg = (xL + xR + xB + xT);

    float result = ((bC * 2.0) - bP + (dtt * avg)) / (1.0 + 4.0 * dtt);

    gl_FragColor = vec4(result, bC, 0.0, 1.0);
}`,
    scalar_vis: `
precision highp float;

uniform sampler2D field;
varying vec2 coord;

void main()
{
    vec4 vis = texture2D(field, coord).xyzw;
    gl_FragColor = vec4(vis.r, -vis.r, 0.0, 1.0);
}`,
    copy: `
precision highp float;

uniform sampler2D field;

varying vec2 coord;

void main()
{
    vec4 tx = texture2D(field, coord);
    gl_FragColor = tx;
}`,
    damping: `
precision highp float;

uniform float damp;
uniform sampler2D field;

varying vec2 coord;

void main()
{
	vec3 u0 = texture2D(field, coord).xyz;
    u0.x *= damp;
	gl_FragColor = vec4(u0, 1.0);
}`
};
