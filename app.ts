(() => {
    var img = new Image();
    img.onload = () => {
        var loader = new Canvas3D.FileLoader();
        var obj = loader.loadFile(data, 11);

        var element = <HTMLCanvasElement>document.getElementById("canvas1");
        var c = element.getContext("2d");

        // read the width and height of the canvas
        var width = element.width;
        var height = element.height;

        // create a new batch of pixels with the same
        // dimensions as the image:
        var canvas = c.createImageData(width, height);

        var textureCanvas = document.createElement("canvas");
        textureCanvas.width = img.width;
        textureCanvas.height = img.height;
        var textureContext = textureCanvas.getContext("2d");

        textureContext.drawImage(img, 0, 0, img.width, img.height);
        var texture = textureContext.getImageData(0, 0, img.width, img.height);

        var xr = 0;
        var yr = 0;
        var zr = 0;
        var g = new Canvas3D.RenderEngine();
        var frames = new Array<ImageData>(0);
        var s2 = 0;
        var frameCount = 100;
        setInterval(() => {
            canvas = c.createImageData(width, height);
            g.rotate(xr, yr, zr, obj);
            xr += 0.01;
            yr += 0.013;
            zr += 0.02;
            g.draw(obj, canvas, texture);
            frames.push(canvas);
            if (frames.length > frameCount+1) {
                frames.shift();
                var s = s2;
                s2 += 0.06 ;
                for (var i = 0; i < height; i++) {

                    var index = Math.ceil((Math.sin(s) * frameCount + frameCount)/2);

                    if (index > frameCount)
                        index = frameCount;
                    if (index < 0)
                        index = 0;

                    s += 0.02;
                    var frame = frames[index];
                    c.putImageData(frame, 0, 0,0,i,width,1);
                }
            } else {
                c.putImageData(canvas, 0, 0);
            }
        
        }, 1);
    };
    img.src = "/images/phong4.png";
})();