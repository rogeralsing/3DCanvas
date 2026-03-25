(() => {
    const canvas = document.getElementById("canvas1") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2")!;
    const W = canvas.width;
    const H = canvas.height;

    // ─── Helpers ────────────────────────────────────────────────────────
    function compile(type: number, src: string): WebGLShader {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
            throw new Error(gl.getShaderInfoLog(s)!);
        return s;
    }

    function link(vs: string, fs: string): WebGLProgram {
        const p = gl.createProgram()!;
        gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(p)!);
        return p;
    }

    function createFBO(): { fbo: WebGLFramebuffer; tex: WebGLTexture } {
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, W, H);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const fbo = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return { fbo, tex };
    }

    // ─── Flat-color program (for the circle) ───────────────────────────
    const flatVS = `#version 300 es
        uniform vec2 uRes;
        in vec2 aPos;
        void main() {
            vec2 clip = (aPos / uRes) * 2.0 - 1.0;
            clip.y = -clip.y;
            gl_Position = vec4(clip, 0.0, 1.0);
        }`;

    const flatFS = `#version 300 es
        precision highp float;
        uniform vec4 uColor;
        out vec4 outColor;
        void main() {
            outColor = uColor;
        }`;

    const flatProg = link(flatVS, flatFS);
    const flat_aPos = gl.getAttribLocation(flatProg, "aPos");
    const flat_uRes = gl.getUniformLocation(flatProg, "uRes");
    const flat_uColor = gl.getUniformLocation(flatProg, "uColor");

    // ─── Textured program (for the letter A) ───────────────────────────
    const texVS = `#version 300 es
        uniform vec2 uRes;
        in vec2 aPos;
        in vec2 aUV;
        out vec2 vUV;
        void main() {
            vec2 clip = (aPos / uRes) * 2.0 - 1.0;
            clip.y = -clip.y;
            gl_Position = vec4(clip, 0.0, 1.0);
            vUV = aUV;
        }`;

    const texFS = `#version 300 es
        precision highp float;
        uniform sampler2D uTex;
        in vec2 vUV;
        out vec4 outColor;
        void main() {
            outColor = texture(uTex, vUV);
        }`;

    const texProg = link(texVS, texFS);
    const tex_aPos = gl.getAttribLocation(texProg, "aPos");
    const tex_aUV = gl.getAttribLocation(texProg, "aUV");
    const tex_uRes = gl.getUniformLocation(texProg, "uRes");
    const tex_uTex = gl.getUniformLocation(texProg, "uTex");

    // ─── Gaussian blur program (separable two-pass) ────────────────────
    const blurVS = `#version 300 es
        in vec2 aQuad;
        out vec2 vUV;
        void main() {
            gl_Position = vec4(aQuad, 0.0, 1.0);
            vUV = aQuad * 0.5 + 0.5;
        }`;

    const blurFS = `#version 300 es
        precision highp float;
        uniform sampler2D uTex;
        uniform vec2 uDir;
        uniform vec2 uBlurCenter; // blur center in UV space
        uniform float uBlurRadius; // blur radius in UV space
        in vec2 vUV;
        out vec4 outColor;
        void main() {
            float dist = distance(vUV, uBlurCenter);
            float strength = 1.0 - smoothstep(0.0, uBlurRadius, dist);

            float weights[13] = float[](
                0.0797, 0.0782, 0.0739, 0.0672, 0.0589,
                0.0496, 0.0402, 0.0314, 0.0236, 0.0170,
                0.0118, 0.0079, 0.0051
            );
            float offsets[13] = float[](
                0.0, 1.0, 2.0, 3.0, 4.0,
                5.0, 6.0, 7.0, 8.0, 9.0,
                10.0, 11.0, 12.0
            );

            vec4 color = texture(uTex, vUV) * weights[0];
            for (int i = 1; i < 13; i++) {
                vec2 off = uDir * offsets[i] * strength;
                color += texture(uTex, vUV + off) * weights[i];
                color += texture(uTex, vUV - off) * weights[i];
            }
            outColor = color;
        }`;

    const blurProg = link(blurVS, blurFS);
    const blur_aQuad = gl.getAttribLocation(blurProg, "aQuad");
    const blur_uTex = gl.getUniformLocation(blurProg, "uTex");
    const blur_uDir = gl.getUniformLocation(blurProg, "uDir");
    const blur_uBlurCenter = gl.getUniformLocation(blurProg, "uBlurCenter");
    const blur_uBlurRadius = gl.getUniformLocation(blurProg, "uBlurRadius");

    // ─── Threshold shader (metaball effect) ────────────────────────────
    const threshFS = `#version 300 es
        precision highp float;
        uniform sampler2D uTex;
        in vec2 vUV;
        out vec4 outColor;
        void main() {
            float r = texture(uTex, vUV).r;
            float v = r > (128.0 / 255.0) ? 1.0 : 0.0;
            outColor = vec4(v, v, v, 1.0);
        }`;

    const threshProg = link(blurVS, threshFS);
    const thresh_uTex = gl.getUniformLocation(threshProg, "uTex");

    // ─── Circle geometry — built into a DYNAMIC buffer ─────────────────
    const radius = 150;
    const segments = 128;
    const circleData = new Float32Array((segments + 2) * 2);

    const circleVAO = gl.createVertexArray()!;
    gl.bindVertexArray(circleVAO);
    const circleBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
    gl.bufferData(gl.ARRAY_BUFFER, circleData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(flat_aPos);
    gl.vertexAttribPointer(flat_aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    function updateCircle(cx: number, cy: number) {
        circleData[0] = cx;
        circleData[1] = cy;
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            circleData[(i + 1) * 2] = cx + Math.cos(a) * radius;
            circleData[(i + 1) * 2 + 1] = cy + Math.sin(a) * radius;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, circleData);
    }

    // ─── Letter "A" texture ────────────────────────────────────────────
    const letterSize = 256;
    const offscreen = document.createElement("canvas");
    offscreen.width = letterSize;
    offscreen.height = letterSize;
    const ctx = offscreen.getContext("2d")!;
    ctx.clearRect(0, 0, letterSize, letterSize);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 220px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("A", letterSize / 2, letterSize / 2);

    const letterTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, letterTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // ─── Letter quad — DYNAMIC buffer ──────────────────────────────────
    const qw = 250, qh = 250;
    const quadArr = new Float32Array(4 * 4); // 4 verts × (x, y, u, v)

    const quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(quadVAO);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, quadArr.byteLength, gl.DYNAMIC_DRAW);
    const stride = 4 * 4;
    gl.enableVertexAttribArray(tex_aPos);
    gl.vertexAttribPointer(tex_aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(tex_aUV);
    gl.vertexAttribPointer(tex_aUV, 2, gl.FLOAT, false, stride, 8);
    gl.bindVertexArray(null);

    function updateQuad(qx: number, qy: number) {
        quadArr.set([
            qx,      qy,      0, 0,
            qx + qw, qy,      1, 0,
            qx,      qy + qh, 0, 1,
            qx + qw, qy + qh, 1, 1,
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, quadArr);
    }

    // ─── Fullscreen quad VAO (for blur passes) ─────────────────────────
    const fsQuadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(fsQuadVAO);
    const fsQuadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, fsQuadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(blur_aQuad);
    gl.vertexAttribPointer(blur_aQuad, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // ─── FBOs ──────────────────────────────────────────────────────────
    const sceneFBO = createFBO();
    const blurFBO = createFBO();

    // ─── Animation loop ────────────────────────────────────────────────
    let t = 0;

    const render = () => {
        // Lissajous-ish paths for circle and letter
        const circleCX = W / 2 + Math.sin(t * 0.7 + 1.0) * 200 + Math.sin(t * 0.3) * 80;
        const circleCY = H / 2 + Math.cos(t * 0.5 + 2.0) * 120 + Math.cos(t * 0.8) * 60;

        const letterX = W / 2 + Math.sin(t * 0.4 + 3.5) * 180 + Math.sin(t * 0.9) * 70 - qw / 2;
        const letterY = H / 2 + Math.cos(t * 0.6 + 0.5) * 140 + Math.cos(t * 0.35) * 50 - qh / 2;

        updateCircle(circleCX, circleCY);
        updateQuad(letterX, letterY);

        // Midpoint between circle center and letter center
        const midX = (circleCX + (letterX + qw / 2)) / 2;
        const midY = (circleCY + (letterY + qh / 2)) / 2;

        // Pass 1: Render scene to sceneFBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO.fbo);
        gl.viewport(0, 0, W, H);
        gl.clearColor(0.07, 0.07, 0.07, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Circle (white)
        gl.useProgram(flatProg);
        gl.uniform2f(flat_uRes, W, H);
        gl.uniform4f(flat_uColor, 1.0, 1.0, 1.0, 1.0);
        gl.bindVertexArray(circleVAO);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, segments + 2);

        // Letter A
        gl.useProgram(texProg);
        gl.uniform2f(tex_uRes, W, H);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, letterTex);
        gl.uniform1i(tex_uTex, 0);
        gl.bindVertexArray(quadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.disable(gl.BLEND);

        // Multi-pass blur: ping-pong between sceneFBO and blurFBO
        const BLUR_PASSES = 30;
        gl.useProgram(blurProg);
        gl.uniform1i(blur_uTex, 0);
        // Pass blur center in UV space (0-1) and radius in UV space
        gl.uniform2f(blur_uBlurCenter, midX / W, 1.0 - midY / H);
        gl.uniform1f(blur_uBlurRadius, radius / Math.min(W, H));
        gl.bindVertexArray(fsQuadVAO);
        gl.activeTexture(gl.TEXTURE0);

        let readFBO = sceneFBO;
        let writeFBO = blurFBO;

        for (let i = 0; i < BLUR_PASSES; i++) {
            // Horizontal
            gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.fbo);
            gl.viewport(0, 0, W, H);
            gl.bindTexture(gl.TEXTURE_2D, readFBO.tex);
            gl.uniform2f(blur_uDir, 1.0 / W, 0.0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            [readFBO, writeFBO] = [writeFBO, readFBO];

            // Vertical
            gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.fbo);
            gl.viewport(0, 0, W, H);
            gl.bindTexture(gl.TEXTURE_2D, readFBO.tex);
            gl.uniform2f(blur_uDir, 0.0, 1.0 / H);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            [readFBO, writeFBO] = [writeFBO, readFBO];
        }

        // Final pass: threshold to screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, W, H);
        gl.useProgram(threshProg);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, readFBO.tex);
        gl.uniform1i(thresh_uTex, 0);
        gl.bindVertexArray(fsQuadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        t += 0.016;
        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
})();
