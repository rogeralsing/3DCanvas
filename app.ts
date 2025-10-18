(() => {
    const img = new Image();
    img.addEventListener("load", () => {
        const loader = new Canvas3D.FileLoader();
        const obj = loader.loadFile(data, 11);

        const element = document.getElementById("canvas1") as HTMLCanvasElement | null;
        if (!element) {
            console.error("Canvas element with id 'canvas1' is missing.");
            return;
        }

        const context = element.getContext("2d");
        if (!context) {
            console.error("Unable to acquire 2D rendering context.");
            return;
        }

        const { width, height } = element;
        let frameBuffer = context.createImageData(width, height);

        const textureCanvas = document.createElement("canvas");
        textureCanvas.width = img.width;
        textureCanvas.height = img.height;
        const textureContext = textureCanvas.getContext("2d");
        if (!textureContext) {
            console.error("Unable to acquire 2D context for the texture.");
            return;
        }

        textureContext.drawImage(img, 0, 0, img.width, img.height);
        const texture = textureContext.getImageData(0, 0, img.width, img.height);

        let xRotation = 0;
        let yRotation = 0;
        let zRotation = 0;
        const engine = new Canvas3D.RenderEngine();
        const frames: ImageData[] = [];
        let ripplePhase = 0;
        const frameCount = 100;

        const render = () => {
            frameBuffer = context.createImageData(width, height);
            engine.rotate(xRotation, yRotation, zRotation, obj);
            xRotation += 0.01;
            yRotation += 0.013;
            zRotation += 0.02;
            engine.draw(obj, frameBuffer, texture);

            frames.push(frameBuffer);
            if (frames.length > frameCount + 1) {
                frames.shift();
            }

            if (frames.length > frameCount) {
                let phase = ripplePhase;
                ripplePhase += 0.03;
                for (let y = 0; y < height; y++) {
                    const wave = Math.sin(phase) * frameCount;
                    const index = Math.max(0, Math.min(frameCount, Math.ceil((wave + frameCount) / 2)));
                    phase += 0.01;
                    const frame = frames[index] ?? frameBuffer;
                    context.putImageData(frame, 0, 0, 0, y, width, 1);
                }
            } else {
                context.putImageData(frameBuffer, 0, 0);
            }

            requestAnimationFrame(render);
        };

        requestAnimationFrame(render);
    });
    img.src = "./images/phong4.png";
})();
