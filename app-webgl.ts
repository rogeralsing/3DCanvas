(() => {
    const FRAME_COUNT = 100;

    function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error("Shader compile error: " + info);
        }
        return shader;
    }

    function linkProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string): WebGLProgram {
        const program = gl.createProgram()!;
        gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vsSource));
        gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fsSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error("Program link error: " + gl.getProgramInfoLog(program));
        }
        return program;
    }

    function buildModelMatrix(xRot: number, yRot: number, zRot: number): Float32Array {
        // Matches original RenderEngine rotation order exactly:
        // Step 1: rotate in XY plane (around Z) by xRot
        // Step 2: rotate in XZ plane (around Y) by yRot
        // Step 3: rotate in YZ plane (around X) by zRot
        const cA = Math.cos(xRot), sA = Math.sin(xRot);
        const cB = Math.cos(yRot), sB = Math.sin(yRot);
        const cG = Math.cos(zRot), sG = Math.sin(zRot);

        // Column-major order for WebGL
        return new Float32Array([
            cB * cA, -cG * sA + sG * sB * cA, -sG * sA - cG * sB * cA, 0,
            cB * sA,  cG * cA + sG * sB * sA,  sG * cA - cG * sB * sA, 0,
            sB,      -sG * cB,                  cG * cB,                 0,
            0,        0,                         0,                       1
        ]);
    }

    const img = new Image();
    img.addEventListener("load", () => {
        const loader = new Canvas3D.FileLoader();
        const obj = loader.loadFile(data, 11);

        const element = document.getElementById("canvas1") as HTMLCanvasElement | null;
        if (!element) {
            console.error("Canvas element with id 'canvas1' is missing.");
            return;
        }

        const gl = element.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false });
        if (!gl) {
            console.error("WebGL2 is not available.");
            return;
        }

        const { width, height } = element;

        // ─── Build Geometry Buffers ───────────────────────────────────────
        let totalVerts = 0;
        let totalIdx = 0;
        for (const mesh of obj.meshes) {
            totalVerts += mesh.vertices.length;
            totalIdx += mesh.polygons.length * 3;
        }

        const positions = new Float32Array(totalVerts * 3);
        const normals = new Float32Array(totalVerts * 3);
        const indices = new Uint32Array(totalIdx);
        let vBase = 0;
        let iOff = 0;

        for (const mesh of obj.meshes) {
            for (let i = 0; i < mesh.vertices.length; i++) {
                const v = mesh.vertices[i];
                const n = mesh.vertexNormals[i];
                const off = (vBase + i) * 3;
                positions[off] = v.x;
                positions[off + 1] = v.y;
                positions[off + 2] = v.z;
                if (n) {
                    normals[off] = n.x;
                    normals[off + 1] = n.y;
                    normals[off + 2] = n.z;
                }
            }
            for (const p of mesh.polygons) {
                indices[iOff++] = vBase + p.a;
                indices[iOff++] = vBase + p.b;
                indices[iOff++] = vBase + p.c;
            }
            vBase += mesh.vertices.length;
        }

        // ─── Scene Shader (3D rendering) ─────────────────────────────────
        const sceneVS = `#version 300 es
            precision highp float;
            uniform mat4 uModel;
            in vec3 aPos;
            in vec3 aNorm;
            out vec3 vNorm;
            void main() {
                vec4 p = uModel * vec4(aPos, 1.0);
                // Orthographic projection: 1 unit = 1 pixel, canvas center = origin
                gl_Position = vec4(p.x / 200.0, p.y / 200.0, p.z / 200.0, 1.0);
                vNorm = normalize(mat3(uModel) * aNorm);
            }`;

        const sceneFS = `#version 300 es
            precision highp float;
            uniform sampler2D uTex;
            in vec3 vNorm;
            out vec4 outColor;
            void main() {
                // Environment mapping: vertex normal xy → texture coordinates
                // Same technique as the software renderer
                vec2 uv = vNorm.xy * 0.5 + 0.5;
                outColor = texture(uTex, uv);
            }`;

        const sceneProg = linkProgram(gl, sceneVS, sceneFS);
        const aPos = gl.getAttribLocation(sceneProg, "aPos");
        const aNorm = gl.getAttribLocation(sceneProg, "aNorm");
        const uModel = gl.getUniformLocation(sceneProg, "uModel");
        const uTex = gl.getUniformLocation(sceneProg, "uTex");

        // ─── Post-Processing Shader (ripple effect) ──────────────────────
        const postVS = `#version 300 es
            in vec2 aQuad;
            out vec2 vUV;
            void main() {
                gl_Position = vec4(aQuad, 0.0, 1.0);
                vUV = aQuad * 0.5 + 0.5;
            }`;

        const postFS = `#version 300 es
            precision highp float;
            uniform highp sampler2DArray uFrames;
            uniform float uPhase;
            uniform int uCount;
            uniform int uWrite;
            uniform int uReady;
            uniform float uHeight;
            uniform float uWidth;
            in vec2 vUV;
            out vec4 outColor;
            void main() {
                if (uReady == 0) {
                    // Not enough frames yet — just show the current frame
                    outColor = texture(uFrames, vec3(vUV, float(uWrite)));
                    return;
                }
                // Ripple: each pixel samples from a different frame in history
                // based on both its X and Y position
                float y = uHeight - gl_FragCoord.y; // top-to-bottom like original
                float x = gl_FragCoord.x;
                float waveY = sin(uPhase + y * 0.01);
                float waveX = sin(uPhase * 0.7 + x * 0.01);
                float wave = (waveY + waveX) * 0.5 * float(uCount);
                int idx = clamp(int(ceil((wave + float(uCount)) / 2.0)), 0, uCount);
                // Map ring buffer index to texture array layer
                int layer = (uWrite + 1 + idx) % (uCount + 1);
                outColor = texture(uFrames, vec3(vUV, float(layer)));
            }`;

        const postProg = linkProgram(gl, postVS, postFS);
        const aQuad = gl.getAttribLocation(postProg, "aQuad");
        const uFrames = gl.getUniformLocation(postProg, "uFrames");
        const uPhase = gl.getUniformLocation(postProg, "uPhase");
        const uCount = gl.getUniformLocation(postProg, "uCount");
        const uWrite = gl.getUniformLocation(postProg, "uWrite");
        const uReady = gl.getUniformLocation(postProg, "uReady");
        const uHeight = gl.getUniformLocation(postProg, "uHeight");
        const uWidth = gl.getUniformLocation(postProg, "uWidth");

        // ─── Geometry VAO ────────────────────────────────────────────────
        const sceneVAO = gl.createVertexArray()!;
        gl.bindVertexArray(sceneVAO);

        const posBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

        const normBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(aNorm);
        gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 0, 0);

        const idxBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);

        // ─── Fullscreen Quad VAO ─────────────────────────────────────────
        const quadVAO = gl.createVertexArray()!;
        gl.bindVertexArray(quadVAO);
        const quadBuf = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(aQuad);
        gl.vertexAttribPointer(aQuad, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        // ─── Load Texture (environment map) ──────────────────────────────
        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // No UNPACK_FLIP_Y — matches original's texture coordinate convention
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // ─── Frame History (TEXTURE_2D_ARRAY ring buffer) ────────────────
        const frameTex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, frameTex);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, width, height, FRAME_COUNT + 1);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // ─── Offscreen FBO ───────────────────────────────────────────────
        const fbo = gl.createFramebuffer()!;
        const fboColor = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, fboColor);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);

        const fboDepth = gl.createRenderbuffer()!;
        gl.bindRenderbuffer(gl.RENDERBUFFER, fboDepth);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);

        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboColor, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fboDepth);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // ─── Animation State ─────────────────────────────────────────────
        let xRotation = 0;
        let yRotation = 0;
        let zRotation = 0;
        let ripplePhase = 0;
        let writeSlot = 0;
        let written = 0;

        const render = () => {
            // ── Pass 1: Render 3D scene to offscreen FBO ──
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
            gl.viewport(0, 0, width, height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            gl.enable(gl.DEPTH_TEST);
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);
            gl.frontFace(gl.CW);

            gl.useProgram(sceneProg);
            gl.uniformMatrix4fv(uModel, false, buildModelMatrix(xRotation, yRotation, zRotation));
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(uTex, 0);

            gl.bindVertexArray(sceneVAO);
            gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
            gl.bindVertexArray(null);

            // ── Copy rendered frame to history ring buffer ──
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, frameTex);
            gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, writeSlot, 0, 0, width, height);

            // ── Pass 2: Post-processing ripple to screen ──
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, width, height);
            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.CULL_FACE);

            gl.useProgram(postProg);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D_ARRAY, frameTex);
            gl.uniform1i(uFrames, 0);
            gl.uniform1f(uPhase, ripplePhase);
            gl.uniform1i(uCount, FRAME_COUNT);
            gl.uniform1i(uWrite, writeSlot);
            gl.uniform1i(uReady, written > FRAME_COUNT ? 1 : 0);
            gl.uniform1f(uHeight, height);
            gl.uniform1f(uWidth, width);

            gl.bindVertexArray(quadVAO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.bindVertexArray(null);

            // ── Advance state ──
            xRotation += 0.01;
            yRotation += 0.013;
            zRotation += 0.02;
            ripplePhase += 0.03;
            writeSlot = (writeSlot + 1) % (FRAME_COUNT + 1);
            written++;

            requestAnimationFrame(render);
        };

        requestAnimationFrame(render);
    });
    img.src = "./images/phong4.png";
})();
