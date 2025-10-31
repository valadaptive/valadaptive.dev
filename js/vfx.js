var l=`
precision mediump float;

attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
    v_texCoord = vec2(a_position.x, 1.0 - a_position.y);
    gl_Position = vec4((a_position - vec2(0.5)) * vec2(2.0), 0.0, 1.0);
}
`,g=`
precision highp float;

varying vec2 v_texCoord;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_dpi;

float sdBox( in vec2 p, in vec2 rad )
{
    p = abs(p) - rad;
    return max(p.x, p.y);
}

void main() {
    float checker_size = 48.0 * u_dpi;

    const float SPEED = 0.1;
    const float TAU = 6.283185307179586;
    //const vec3 COLOR_A = vec3(1.0, 0.0, 1.0) * 0.5;
    //const vec3 COLOR_B = vec3(0.0);
    const vec3 COLOR_A = vec3(0.5, 0.05, 0.375);
    const vec3 COLOR_B = vec3(
        10.0 / 255.0,
        11.0 / 255.0,
        18.0 / 255.0
    );

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

    vec3 color = mix(COLOR_A, COLOR_B, vec3(coverage));
    gl_FragColor = vec4(color, 1.0);
}
`,v=(o,e,c)=>{let t=o.createShader(c);if(!t)throw new Error("Could not create shader.");if(o.shaderSource(t,e),o.compileShader(t),!o.getShaderParameter(t,o.COMPILE_STATUS)){let n=o.getShaderInfoLog(t)??"";throw new Error(`Could not compile WebGL program. 
`+n)}return t},u=class{gl;program;uniforms;attribs;constructor(e,c,t){let n=v(e,c,e.VERTEX_SHADER),s=v(e,t,e.FRAGMENT_SHADER),r=e.createProgram();if(!r)throw new Error("Could not create program");if(e.attachShader(r,n),e.attachShader(r,s),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){let i=e.getProgramInfoLog(r)??"";throw new Error(`Could not compile WebGL program. 
`+i)}this.gl=e,this.program=r,this.uniforms={},this.attribs={};let _=e.getProgramParameter(r,e.ACTIVE_UNIFORMS);for(let i=0;i<_;i++){let{name:a}=e.getActiveUniform(r,i);this.uniforms[a]=e.getUniformLocation(r,a)}let d=e.getProgramParameter(r,e.ACTIVE_ATTRIBUTES);for(let i=0;i<d;i++){let{name:a}=e.getActiveAttrib(r,i);this.attribs[a]=e.getAttribLocation(r,a)}}},C=o=>{let e=o.getContext("webgl");if(!e)return;let c=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,c),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,0,1,1,0,1,1,0,1,1,0]),e.STATIC_DRAW);let t=new u(e,l,g);e.useProgram(t.program);let n=t.attribs.a_position;e.enableVertexAttribArray(n),e.vertexAttribPointer(n,2,e.FLOAT,!1,0,0);let s=-1,r=-1,_=()=>{let a=o.getBoundingClientRect(),f=Math.round(a.width*window.devicePixelRatio),m=Math.round(a.height*window.devicePixelRatio);(s!==f||r!==m)&&(s=o.width=f,r=o.height=m,e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight)),e.uniform2f(t.uniforms.u_resolution,f,m),e.uniform1f(t.uniforms.u_dpi,window.devicePixelRatio)},d=document.getElementById("landing-container"),i=a=>{requestAnimationFrame(i),_(),!((d?.clientWidth??0)>=o.clientWidth)&&(e.uniform1f(t.uniforms.u_time,a*.001),e.drawArrays(e.TRIANGLES,0,6))};requestAnimationFrame(i)},h=()=>{let o=document.getElementById("checkerboard");o&&C(o)};document.readyState==="complete"?h():document.addEventListener("DOMContentLoaded",()=>h(),{once:!0});
//# sourceMappingURL=vfx.js.map
