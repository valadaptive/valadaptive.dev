var C=`
precision mediump float;

attribute vec2 a_position;

varying vec2 v_texCoord;

void main() {
    v_texCoord = vec2(a_position.x, 1.0 - a_position.y);
    gl_Position = vec4((a_position - vec2(0.5)) * vec2(2.0), 0.0, 1.0);
}
`,p=`
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
`,v=(r,e,s)=>{let o=r.createShader(s);if(!o)throw new Error("Could not create shader.");if(r.shaderSource(o,e),r.compileShader(o),!r.getShaderParameter(o,r.COMPILE_STATUS)){let c=r.getShaderInfoLog(o)??"";throw new Error(`Could not compile WebGL program. 
`+c)}return o},h=class{gl;program;uniforms;attribs;constructor(e,s,o){let c=v(e,s,e.VERTEX_SHADER),d=v(e,o,e.FRAGMENT_SHADER),t=e.createProgram();if(!t)throw new Error("Could not create program");if(e.attachShader(t,c),e.attachShader(t,d),e.linkProgram(t),!e.getProgramParameter(t,e.LINK_STATUS)){let a=e.getProgramInfoLog(t)??"";throw new Error(`Could not compile WebGL program. 
`+a)}this.gl=e,this.program=t,this.uniforms={},this.attribs={};let f=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<f;a++){let{name:i}=e.getActiveUniform(t,a);this.uniforms[i]=e.getUniformLocation(t,i)}let _=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let a=0;a<_;a++){let{name:i}=e.getActiveAttrib(t,a);this.attribs[i]=e.getAttribLocation(t,i)}}},E=r=>{let e=r.getContext("webgl");if(!e)return;let s=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,s),e.bufferData(e.ARRAY_BUFFER,new Float32Array([0,0,0,1,1,0,1,1,0,1,1,0]),e.STATIC_DRAW);let o=new h(e,C,p);e.useProgram(o.program);let c=o.attribs.a_position;e.enableVertexAttribArray(c),e.vertexAttribPointer(c,2,e.FLOAT,!1,0,0);let d=-1,t=-1,f=()=>{let n=r.getBoundingClientRect(),u=Math.round(n.width*window.devicePixelRatio),m=Math.round(n.height*window.devicePixelRatio);(d!==u||t!==m)&&(d=r.width=u,t=r.height=m,e.viewport(0,0,e.drawingBufferWidth,e.drawingBufferHeight)),e.uniform2f(o.uniforms.u_resolution,u,m),e.uniform1f(o.uniforms.u_dpi,window.devicePixelRatio)},_=n=>{n?(e.uniform3f(o.uniforms.u_darkSquare,10/255,11/255,18/255),e.uniform3f(o.uniforms.u_lightSquare,.5,.05,.375)):(e.uniform3f(o.uniforms.u_darkSquare,50/255,45/255,69/255),e.uniform3f(o.uniforms.u_lightSquare,1,.375,.75))},a=!1,i=window.matchMedia("(prefers-color-scheme: dark)"),b=window.matchMedia("(prefers-reduced-motion)");i.addEventListener("change",n=>{_(n.matches)}),_(i.matches);let x=document.getElementById("landing-container"),l=n=>{requestAnimationFrame(l),f(),!((x?.clientWidth??0)>=r.clientWidth)&&(b.matches&&a||(e.uniform1f(o.uniforms.u_time,n*.001),e.drawArrays(e.TRIANGLES,0,6),a=!0))};requestAnimationFrame(l)},g=()=>{let r=document.getElementById("checkerboard");r&&E(r)};document.readyState==="complete"?g():document.addEventListener("DOMContentLoaded",()=>g(),{once:!0});
//# sourceMappingURL=vfx.js.map
