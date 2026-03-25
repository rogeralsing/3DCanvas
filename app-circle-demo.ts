(() => {
    const canvas = document.getElementById("canvas1") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2")!;
    const W = canvas.width;
    const H = canvas.height;
    const MAX_BLUR_CENTERS = 32;

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

    // ─── Flat-color program (circle) ───────────────────────────────────
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
        void main() { outColor = uColor; }`;

    const flatProg = link(flatVS, flatFS);
    const flat_aPos = gl.getAttribLocation(flatProg, "aPos");
    const flat_uRes = gl.getUniformLocation(flatProg, "uRes");
    const flat_uColor = gl.getUniformLocation(flatProg, "uColor");

    // ─── Textured program (letters) ────────────────────────────────────
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
        void main() { outColor = texture(uTex, vUV); }`;

    const texProg = link(texVS, texFS);
    const tex_aPos = gl.getAttribLocation(texProg, "aPos");
    const tex_aUV = gl.getAttribLocation(texProg, "aUV");
    const tex_uRes = gl.getUniformLocation(texProg, "uRes");
    const tex_uTex = gl.getUniformLocation(texProg, "uTex");

    // ─── Fullscreen quad vertex shader (shared) ────────────────────────
    const fsQuadVS = `#version 300 es
        in vec2 aQuad;
        out vec2 vUV;
        void main() {
            gl_Position = vec4(aQuad, 0.0, 1.0);
            vUV = aQuad * 0.5 + 0.5;
        }`;

    // ─── Gaussian blur with multiple blur centers ──────────────────────
    const blurFS = `#version 300 es
        precision highp float;
        uniform sampler2D uTex;
        uniform vec2 uDir;
        uniform vec2 uBlurCenters[${MAX_BLUR_CENTERS}];
        uniform int uNumCenters;
        uniform float uBlurRadius;
        uniform float uBlurDecays[${MAX_BLUR_CENTERS}];
        in vec2 vUV;
        out vec4 outColor;
        void main() {
            // Max strength across all blur centers, each with its own decay
            float strength = 0.0;
            for (int c = 0; c < ${MAX_BLUR_CENTERS}; c++) {
                if (c >= uNumCenters) break;
                float dist = distance(vUV, uBlurCenters[c]);
                float linear = 1.0 - clamp(dist / uBlurRadius, 0.0, 1.0);
                float s = pow(linear, uBlurDecays[c]);
                strength = max(strength, s);
            }

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

    const blurProg = link(fsQuadVS, blurFS);
    const blur_aQuad = gl.getAttribLocation(blurProg, "aQuad");
    const blur_uTex = gl.getUniformLocation(blurProg, "uTex");
    const blur_uDir = gl.getUniformLocation(blurProg, "uDir");
    const blur_uNumCenters = gl.getUniformLocation(blurProg, "uNumCenters");
    const blur_uBlurRadius = gl.getUniformLocation(blurProg, "uBlurRadius");
    const blur_uBlurDecays: WebGLUniformLocation[] = [];
    for (let i = 0; i < MAX_BLUR_CENTERS; i++) {
        blur_uBlurDecays.push(gl.getUniformLocation(blurProg, `uBlurDecays[${i}]`)!);
    }
    const blur_uBlurCenters: WebGLUniformLocation[] = [];
    for (let i = 0; i < MAX_BLUR_CENTERS; i++) {
        blur_uBlurCenters.push(gl.getUniformLocation(blurProg, `uBlurCenters[${i}]`)!);
    }

    // ─── Threshold shader ──────────────────────────────────────────────
    const threshFS = `#version 300 es
        precision highp float;
        uniform sampler2D uTex;
        uniform float uCutoff;
        uniform vec2 uBlurCenters[${MAX_BLUR_CENTERS}];
        uniform int uNumCenters;
        uniform float uBlurRadius;
        uniform vec2 uRes;
        uniform float uBlurDecays[${MAX_BLUR_CENTERS}];
        uniform bool uShowBlur;
        in vec2 vUV;
        out vec4 outColor;
        void main() {
            float r = texture(uTex, vUV).r;
            float v = r > uCutoff ? 1.0 : 0.0;

            outColor = vec4(v, v, v, 1.0);

            if (uShowBlur) {
                vec2 pixelPos = vUV * uRes;
                float maxStrength = 0.0;
                bool onRing = false;
                for (int c = 0; c < ${MAX_BLUR_CENTERS}; c++) {
                    if (c >= uNumCenters) break;
                    vec2 center = uBlurCenters[c] * uRes;
                    float dist = distance(pixelPos, center);
                    float linear = 1.0 - clamp(dist / uBlurRadius, 0.0, 1.0);
                    float s = pow(linear, uBlurDecays[c]);
                    maxStrength = max(maxStrength, s);
                    if (abs(dist - uBlurRadius) < 2.0) onRing = true;
                }
                if (onRing) {
                    outColor = vec4(1.0, 0.0, 0.0, 1.0);
                } else if (maxStrength > 0.0) {
                    // Overlay: red tint proportional to blur strength
                    outColor = mix(outColor, vec4(1.0, 0.0, 0.0, 1.0), maxStrength * 0.4);
                }
            }
        }`;

    const threshProg = link(fsQuadVS, threshFS);
    const thresh_uTex = gl.getUniformLocation(threshProg, "uTex");
    const thresh_uCutoff = gl.getUniformLocation(threshProg, "uCutoff");
    const thresh_uNumCenters = gl.getUniformLocation(threshProg, "uNumCenters");
    const thresh_uBlurRadius = gl.getUniformLocation(threshProg, "uBlurRadius");
    const thresh_uRes = gl.getUniformLocation(threshProg, "uRes");
    const thresh_uBlurDecays: WebGLUniformLocation[] = [];
    for (let i = 0; i < MAX_BLUR_CENTERS; i++) {
        thresh_uBlurDecays.push(gl.getUniformLocation(threshProg, `uBlurDecays[${i}]`)!);
    }
    const thresh_uShowBlur = gl.getUniformLocation(threshProg, "uShowBlur");
    const thresh_uBlurCenters: WebGLUniformLocation[] = [];
    for (let i = 0; i < MAX_BLUR_CENTERS; i++) {
        thresh_uBlurCenters.push(gl.getUniformLocation(threshProg, `uBlurCenters[${i}]`)!);
    }

    // ─── Controls ──────────────────────────────────────────────────────
    let cutoff = 200;
    let decay = 1.0;
    let showBlur = false;
    const slider = document.getElementById("cutoff") as HTMLInputElement;
    const sliderLabel = document.getElementById("cutoffValue")!;
    slider.addEventListener("input", () => {
        cutoff = parseInt(slider.value, 10);
        sliderLabel.textContent = String(cutoff);
    });
    const decaySlider = document.getElementById("decay") as HTMLInputElement;
    const decayLabel = document.getElementById("decayValue")!;
    decaySlider.addEventListener("input", () => {
        decay = parseFloat(decaySlider.value);
        decayLabel.textContent = decay.toFixed(1);
    });
    const showBlurCb = document.getElementById("showBlur") as HTMLInputElement;
    showBlurCb.addEventListener("change", () => {
        showBlur = showBlurCb.checked;
    });

    // ─── Fullscreen quad VAO ───────────────────────────────────────────
    const fsQuadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(fsQuadVAO);
    const fsQuadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, fsQuadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(blur_aQuad);
    gl.vertexAttribPointer(blur_aQuad, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // ─── SVG icon texture factory (Lucide-style paths) ────────────────
    function createIconTexture(svgInner: string): WebGLTexture {
        const size = 256;
        const pad = 2; // small padding so edges aren't clipped
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${-pad} ${-pad} ${24 + pad * 2} ${24 + pad * 2}" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgInner}</svg>`;

        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;

        // Create texture immediately (blank), update once loaded
        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = size;
            c.height = size;
            const cx = c.getContext("2d")!;
            cx.drawImage(img, 0, 0, size, size);
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        };

        return tex;
    }

    // Lucide icon SVG paths (24x24 viewBox, filled white)
    const ICON_STAR = `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`;
    const ICON_HEART = `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`;
    const ICON_ZAP = `<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>`;

    // ─── Generic letter quad (shared dynamic buffer) ───────────────────
    const quadSize = 200;
    const quadArr = new Float32Array(4 * 4);

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

    function drawQuad(cx: number, cy: number, tex: WebGLTexture) {
        const x = cx - quadSize / 2;
        const y = cy - quadSize / 2;
        quadArr.set([
            x,             y,             0, 0,
            x + quadSize,  y,             1, 0,
            x,             y + quadSize,  0, 1,
            x + quadSize,  y + quadSize,  1, 1,
        ]);
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, quadArr);

        gl.useProgram(texProg);
        gl.uniform2f(tex_uRes, W, H);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(tex_uTex, 0);
        gl.bindVertexArray(quadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // ─── Generic circle (shared dynamic buffer) ────────────────────────
    const circleRadius = 110;
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

    function drawCircle(cx: number, cy: number) {
        circleData[0] = cx;
        circleData[1] = cy;
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            circleData[(i + 1) * 2] = cx + Math.cos(a) * circleRadius;
            circleData[(i + 1) * 2 + 1] = cy + Math.sin(a) * circleRadius;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, circleBuf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, circleData);

        gl.useProgram(flatProg);
        gl.uniform2f(flat_uRes, W, H);
        gl.uniform4f(flat_uColor, 1.0, 1.0, 1.0, 1.0);
        gl.bindVertexArray(circleVAO);
        gl.drawArrays(gl.TRIANGLE_FAN, 0, segments + 2);
    }

    // ─── Scene objects ─────────────────────────────────────────────────
    // Each object: a motion function returning [cx, cy] and a draw function
    interface SceneObject {
        pos: (t: number) => [number, number];
        draw: (cx: number, cy: number) => void;
    }

    const texStar = createIconTexture(ICON_STAR);
    const texHeart = createIconTexture(ICON_HEART);
    const texZap = createIconTexture(ICON_ZAP);

    const objects: SceneObject[] = [
        {
            pos: (t) => [
                W / 2 + Math.sin(t * 0.7 + 1.0) * 200 + Math.sin(t * 0.3) * 80,
                H / 2 + Math.cos(t * 0.5 + 2.0) * 120 + Math.cos(t * 0.8) * 60,
            ],
            draw: drawCircle,
        },
        {
            pos: (t) => [
                W / 2 + Math.sin(t * 0.4 + 3.5) * 180 + Math.sin(t * 0.9) * 70,
                H / 2 + Math.cos(t * 0.6 + 0.5) * 140 + Math.cos(t * 0.35) * 50,
            ],
            draw: (cx, cy) => drawQuad(cx, cy, texStar),
        },
        {
            pos: (t) => [
                W / 2 + Math.sin(t * 0.5 + 5.0) * 220 + Math.sin(t * 0.25) * 60,
                H / 2 + Math.cos(t * 0.45 + 1.2) * 150 + Math.cos(t * 0.7) * 40,
            ],
            draw: (cx, cy) => drawQuad(cx, cy, texHeart),
        },
        {
            pos: (t) => [
                W / 2 + Math.sin(t * 0.6 + 0.3) * 190 + Math.sin(t * 0.8 + 2.0) * 50,
                H / 2 + Math.cos(t * 0.55 + 4.0) * 130 + Math.cos(t * 0.4) * 70,
            ],
            draw: (cx, cy) => drawQuad(cx, cy, texZap),
        },
    ];

    // ─── FBOs ──────────────────────────────────────────────────────────
    const sceneFBO = createFBO();
    const blurFBO = createFBO();

    // ─── Animation loop ────────────────────────────────────────────────
    let t = 0;

    const render = () => {
        // Compute positions
        const positions = objects.map(o => o.pos(t));

        // Compute all pair midpoints (in UV space for the blur shader)
        // and per-pair decay based on object distance
        const centers: [number, number][] = [];
        const decays: number[] = [];
        const maxDist = Math.sqrt(W * W + H * H); // canvas diagonal
        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const mx = (positions[i][0] + positions[j][0]) / 2;
                const my = (positions[i][1] + positions[j][1]) / 2;
                // Convert to UV space (y-flipped)
                centers.push([mx / W, 1.0 - my / H]);

                // Distance between the two objects in this pair
                const dx = positions[i][0] - positions[j][0];
                const dy = positions[i][1] - positions[j][1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                const normDist = dist / maxDist;

                // Close → low decay (spread blur, strong merge)
                // Far  → high decay (sharp falloff, weak merge)
                const pairDecay = 0.2 + normDist * decay * 5.0;
                decays.push(pairDecay);
            }
        }

        // Pass 1: Render all objects to sceneFBO
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFBO.fbo);
        gl.viewport(0, 0, W, H);
        gl.clearColor(0.07, 0.07, 0.07, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        for (let i = 0; i < objects.length; i++) {
            objects[i].draw(positions[i][0], positions[i][1]);
        }

        gl.disable(gl.BLEND);

        // Multi-pass localized blur
        const BLUR_PASSES = 30;
        gl.useProgram(blurProg);
        gl.uniform1i(blur_uTex, 0);
        gl.uniform1i(blur_uNumCenters, centers.length);
        gl.uniform1f(blur_uBlurRadius, circleRadius / Math.min(W, H));
        for (let i = 0; i < centers.length && i < MAX_BLUR_CENTERS; i++) {
            gl.uniform2f(blur_uBlurCenters[i], centers[i][0], centers[i][1]);
            gl.uniform1f(blur_uBlurDecays[i], decays[i]);
        }
        gl.bindVertexArray(fsQuadVAO);
        gl.activeTexture(gl.TEXTURE0);

        let readFBO = sceneFBO;
        let writeFBO = blurFBO;

        for (let i = 0; i < BLUR_PASSES; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.fbo);
            gl.viewport(0, 0, W, H);
            gl.bindTexture(gl.TEXTURE_2D, readFBO.tex);
            gl.uniform2f(blur_uDir, 1.0 / W, 0.0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            [readFBO, writeFBO] = [writeFBO, readFBO];

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
        gl.uniform1f(thresh_uCutoff, cutoff / 255.0);
        gl.uniform1i(thresh_uNumCenters, centers.length);
        gl.uniform1f(thresh_uBlurRadius, circleRadius);
        gl.uniform2f(thresh_uRes, W, H);
        gl.uniform1i(thresh_uShowBlur, showBlur ? 1 : 0);
        for (let i = 0; i < centers.length && i < MAX_BLUR_CENTERS; i++) {
            gl.uniform2f(thresh_uBlurCenters[i], centers[i][0], centers[i][1]);
            gl.uniform1f(thresh_uBlurDecays[i], decays[i]);
        }
        gl.bindVertexArray(fsQuadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        t += 0.016;
        requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
})();
