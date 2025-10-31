const vertexShader = `
precision mediump float;

attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
    v_texCoord = vec2(a_position.x, 1.0 - a_position.y);
    gl_Position = vec4((a_position - vec2(0.5)) * vec2(2.0), 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

varying vec2 v_texCoord;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dpi;
uniform vec3 u_darkSquare;
uniform vec3 u_lightSquare;

float sdBox( in vec2 p, in vec2 rad )
{
    p = abs(p) - rad;
    return max(p.x, p.y);
}

void main() {
    float checker_size = 48.0 * u_dpi;

    const float SPEED = 0.1;
    const float TAU = 6.283185307179586;
    vec2 fragCoord = v_texCoord * u_resolution;

    // Center the checkerboard
    vec2 offset = (u_resolution - (floor((u_resolution / vec2(checker_size)) + 0.5) * vec2(checker_size))) * -0.5;

    vec2 square_coord = mod(fragCoord + offset, vec2(checker_size));

    vec2 square_index = floor((fragCoord + offset) / vec2(checker_size));

    bool checker_fill = mod(square_index.x, 2.0) == mod(square_index.y, 2.0);

    // Diagonal rotation offset
    // float rot_add = (fragCoord.x + fragCoord.y) * 0.0005;

    // Radial rotation offset (from center)
    // float rot_add = distance(fragCoord + offset, u_resolution / 2.0) * -0.00125;
    float rot_add = fragCoord.x * -0.001 / u_dpi;

    float rotation_turns = mod(-u_time * SPEED + rot_add, 0.5);

    bool flip_fill = mod(rotation_turns, 0.5) >= 0.25;

    float rotation_angle = rotation_turns * TAU;
    mat2 rotation_matrix = mat2(cos(rotation_angle), -sin(rotation_angle), sin(rotation_angle), cos(rotation_angle));

    const float CHECKER_SHRINK = 1.0;
    //float CHECKER_SHRINK = sin(fragCoord.y * 0.01 + u_time * 1.0) * 5.0 + 1.0;

    float box_coverage_center = sdBox((square_coord - vec2(checker_size / 2.0)) * rotation_matrix, vec2((checker_size - CHECKER_SHRINK) / 2.0));
    float box_coverage_top = sdBox((square_coord - vec2(checker_size / 2.0, checker_size * 1.5)) * rotation_matrix, vec2((checker_size - CHECKER_SHRINK) / 2.0));
    float box_coverage_right = sdBox((square_coord - vec2(checker_size * 1.5, checker_size / 2.0)) * rotation_matrix, vec2((checker_size - CHECKER_SHRINK) / 2.0));
    float box_coverage_bottom = sdBox((square_coord - vec2(checker_size / 2.0, checker_size * -0.5)) * rotation_matrix, vec2((checker_size - CHECKER_SHRINK) / 2.0));
    float box_coverage_left = sdBox((square_coord - vec2(checker_size * -0.5, checker_size / 2.0)) * rotation_matrix, vec2((checker_size - CHECKER_SHRINK) / 2.0));

    float box_coverage_adjacent = min(min(min(box_coverage_top, box_coverage_right), box_coverage_bottom), box_coverage_left);

    float coverage = checker_fill ^^ flip_fill ? box_coverage_adjacent : box_coverage_center;
    coverage = clamp(flip_fill ? CHECKER_SHRINK - coverage : coverage, 0.0, 1.0);

    vec3 color = mix(u_lightSquare, u_darkSquare, vec3(coverage));
    gl_FragColor = vec4(color, 1.0);
}
`;

const createShader = (gl: WebGLRenderingContext, source: string, type: number): WebGLShader => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not create shader.');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader) ?? '';
        throw new Error('Could not compile WebGL program. \n' + info);
    }

    return shader;
};

class Shader {
    private gl: WebGLRenderingContext;
    public program: WebGLProgram;
    // TODO: strongly type these
    public uniforms: Record<string, WebGLUniformLocation>;
    public attribs: Record<string, number>;

    public constructor(gl: WebGLRenderingContext, vertex: string, fragment: string) {
        const vertexShader = createShader(gl, vertex, gl.VERTEX_SHADER);
        const fragmentShader = createShader(gl, fragment, gl.FRAGMENT_SHADER);
        const program = gl.createProgram();
        if (!program) throw new Error('Could not create program');
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program) ?? '';
            throw new Error('Could not compile WebGL program. \n' + info);
        }
        this.gl = gl;
        this.program = program;
        this.uniforms = {};
        this.attribs = {};

        const numActiveUniforms = gl.getProgramParameter(
            program,
            gl.ACTIVE_UNIFORMS,
        ) as number;
        for (let i = 0; i < numActiveUniforms; i++) {
            const {name} = gl.getActiveUniform(program, i)!;
            this.uniforms[name] = gl.getUniformLocation(program, name)!;
        }

        const numActiveAttributes = gl.getProgramParameter(
            program,
            gl.ACTIVE_ATTRIBUTES,
        ) as number;
        for (let i = 0; i < numActiveAttributes; i++) {
            const {name} = gl.getActiveAttrib(program, i)!;
            this.attribs[name] = gl.getAttribLocation(program, name)!;
        }
    }
}

const attach = (target: HTMLCanvasElement) => {
    const gl = target.getContext('webgl');
    if (!gl) return;

    // Initialize vertex buffer. This will draw one 2D quadrilateral.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    // These are 6 points which make up 2 triangles which make up 1 quad/rectangle.
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([
            0, 0,
            0, 1,
            1, 0,
            1, 1,
            0, 1,
            1, 0,
        ]),
        gl.STATIC_DRAW,
    );

    const shader = new Shader(gl, vertexShader, fragmentShader);
    gl.useProgram(shader.program);

    const attribLocation = shader.attribs.a_position;
    gl.enableVertexAttribArray(attribLocation);
    gl.vertexAttribPointer(
        attribLocation,
        2,
        gl.FLOAT,
        false,
        0,
        0,
    );

    let viewportWidth = -1;
    let viewportHeight = -1;
    const ensureViewport = () => {
        const rect = target.getBoundingClientRect();
        const width = Math.round(rect.width * window.devicePixelRatio);
        const height = Math.round(rect.height * window.devicePixelRatio);
        if (viewportWidth !== width || viewportHeight !== height) {
            viewportWidth = target.width = width;
            viewportHeight = target.height = height;
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        }

        gl.uniform2f(shader.uniforms.u_resolution, width, height);
        gl.uniform1f(shader.uniforms.u_dpi, window.devicePixelRatio);
    };

    const updateColors = (darkMode: boolean) => {
        if (darkMode) {
            gl.uniform3f(shader.uniforms.u_darkSquare, 10 / 255, 11 / 255, 18 / 255);
            gl.uniform3f(shader.uniforms.u_lightSquare, 0.5, 0.05, 0.375);
        } else {
            gl.uniform3f(shader.uniforms.u_darkSquare, 0x32 / 255, 0x2d / 255, 0x45 / 255);
            gl.uniform3f(shader.uniforms.u_lightSquare, 1.0, 0.375, 0.75);
        }
    };

    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    darkMode.addEventListener('change', e => {
        updateColors(e.matches);
    });
    updateColors(darkMode.matches);

    const landingContainer = document.getElementById('landing-container');
    const onFrame = (timestamp: number) => {
        requestAnimationFrame(onFrame);
        ensureViewport();

        if ((landingContainer?.clientWidth ?? 0) >= target.clientWidth) {
            return;
        }

        gl.uniform1f(shader.uniforms.u_time, timestamp * 0.001);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    requestAnimationFrame(onFrame);
};

const attachToCheckerboard = () => {
    const target = document.getElementById('checkerboard');
    if (!target) return;
    attach(target as HTMLCanvasElement);
};

if (document.readyState === 'complete') {
    attachToCheckerboard();
} else {
    document.addEventListener('DOMContentLoaded', () => attachToCheckerboard(), {once: true});
}
