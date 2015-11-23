var Point = (function () {
    function Point(x, y) {
        this.x = x;
        this.y = y;
    }
    return Point;
})();
var Material = (function () {
    function Material(r, g, b, id) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.id = id;
    }
    return Material;
})();
var TextureFace = (function () {
    function TextureFace(x, y, u, v) {
        this.x = x;
        this.y = y;
        this.u = u;
        this.v = v;
    }
    return TextureFace;
})();
var Vertex = (function () {
    function Vertex(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    Vertex.prototype.subtract = function (other) {
        return new Vertex(this.x - other.x, this.y - other.y, this.z - other.z);
    };
    Vertex.prototype.add = function (other) {
        return new Vertex(this.x + other.x, this.y + other.y, this.z + other.z);
    };
    Vertex.prototype.cross = function (other) {
        return new Vertex(this.y * other.z - this.z * other.y, this.z * other.x - this.x * other.z, this.x * other.y - this.y * other.x);
    };
    Vertex.prototype.normalize = function () {
        var h = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (h === 0) {
            return new Vertex(0, 0, 0.01); //hack
        }
        return new Vertex(this.x / h, this.y / h, this.z / h);
    };
    return Vertex;
})();
var Face = (function () {
    function Face(a, b, c, ab, bc, ca) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.ab = ab;
        this.bc = bc;
        this.ca = ca;
    }
    return Face;
})();
var Polygon = (function () {
    function Polygon(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
    }
    return Polygon;
})();
var Outline = (function () {
    function Outline(ab, bc, ca) {
        this.ab = ab;
        this.bc = bc;
        this.ca = ca;
    }
    return Outline;
})();
var Mesh = (function () {
    function Mesh(name, r, g, b, polygons, vertices, vertexNormals, outlines) {
        this.name = name;
        this.r = r;
        this.g = g;
        this.b = b;
        this.polygons = polygons;
        this.vertices = vertices;
        this.vertexNormals = vertexNormals;
        this.outlines = outlines;
    }
    return Mesh;
})();
var Object2D = (function () {
    function Object2D(meshes) {
        this.meshes = meshes;
    }
    return Object2D;
})();
var FileLoader = (function () {
    function FileLoader() {
        this.rowIndex = 0;
        this.charIndex = 0;
    }
    FileLoader.prototype.loadFile = function (content, zoom) {
        var find = "\t";
        var re = new RegExp(find, "g");
        content = content.replace(re, " ");
        this.lines = content.split("\n");
        this.find("MATERIAL_COUNT");
        var numMaterials = this.readNextInt();
        var materials = new Array();
        for (var i = 0; i < numMaterials; i++) {
            this.find("MATERIAL_NAME");
            var id = this.readNext();
            this.find("MATERIAL_DIFFUSE");
            var r = this.readNextFloat() * 255;
            var g = this.readNextFloat() * 255;
            var b = this.readNextFloat() * 255;
            var material = new Material(r, g, b, id);
            materials.push(material);
        }
        var meshes = new Array();
        while (this.find("GEOMOBJECT")) {
            this.find("NODE_NAME");
            var meshID = this.readNext();
            this.find("MESH_NUMVERTEX");
            var numVertex = this.readNextInt();
            this.find("MESH_NUMFACES");
            var numFaces = this.readNextInt();
            this.find("MESH_VERTEX_LIST");
            var vertices = new Array(numVertex);
            var x;
            var y;
            var z;
            for (var j = 0; j < numVertex; j++) {
                this.nextLine();
                this.find("MESH_VERTEX");
                this.readNext();
                x = this.readNextFloat() * zoom;
                y = this.readNextFloat() * zoom;
                z = this.readNextFloat() * zoom;
                vertices[j] = new Vertex(x, y, z);
            }
            this.find("MESH_FACE_LIST");
            var faces = new Array(numFaces);
            for (var k = 0; k < numFaces; k++) {
                this.nextLine();
                this.find("MESH_FACE");
                this.readNext(); //skip
                this.readNext(); //skip
                var a = this.readNextInt();
                this.readNext(); //skip
                var b = this.readNextInt();
                this.readNext(); //skip
                var c = this.readNextInt();
                this.find("AB:");
                var ab = this.readNextInt();
                this.find("BC:");
                var bc = this.readNextInt();
                this.find("CA:");
                var ca = this.readNextInt();
                faces[k] = new Face(a, b, c, ab > 0, bc > 0, ca > 0);
            }
            var vertexNormals = new Array(numVertex);
            this.find("MESH_NORMALS");
            for (var l = 0; l < numFaces; l++) {
                this.find("*MESH_FACENORMAL");
                this.find("*MESH_FACENORMAL");
                this.find("MESH_VERTEXNORMAL");
                j = this.readNextInt();
                x = this.readNextFloat();
                y = this.readNextFloat();
                z = this.readNextFloat();
                vertexNormals[j] = new Vertex(x, y, z);
                this.nextLine();
                this.find("MESH_VERTEXNORMAL");
                j = this.readNextInt();
                x = this.readNextFloat();
                y = this.readNextFloat();
                z = this.readNextFloat();
                vertexNormals[j] = new Vertex(x, y, z);
                this.nextLine();
                this.find("MESH_VERTEXNORMAL");
                j = this.readNextInt();
                x = this.readNextFloat();
                y = this.readNextFloat();
                z = this.readNextFloat();
                vertexNormals[j] = new Vertex(x, y, z);
            }
            this.find("MATERIAL_REF");
            var materialId = this.readNextInt();
            var polygons = new Array(numFaces);
            var outlines = new Array(numFaces);
            for (var m = 0; m < numFaces; m++) {
                polygons[m] = new Polygon(faces[m].a, faces[m].b, faces[m].c);
                outlines[m] = new Outline(faces[m].ab, faces[m].bc, faces[m].ca);
            }
            var mesh = new Mesh(meshID, r, g, b, polygons, vertices, vertexNormals, outlines);
            meshes.push(mesh);
        }
        var res = new Object2D(meshes);
        return res;
    };
    FileLoader.prototype.nextLine = function () {
        this.rowIndex++;
    };
    FileLoader.prototype.find = function (text) {
        this.charIndex = 0;
        while (this.lines[this.rowIndex].indexOf(text) < 0) {
            this.rowIndex++;
            if (this.rowIndex >= this.lines.length)
                return false;
        }
        this.charIndex = this.lines[this.rowIndex].indexOf(text) + text.length;
        return true;
    };
    FileLoader.prototype.readNextFloat = function () {
        return parseFloat(this.readNext());
    };
    FileLoader.prototype.readNextInt = function () {
        return parseInt(this.readNext());
    };
    FileLoader.prototype.readNext = function () {
        while (this.lines[this.rowIndex].substr(this.charIndex, 1) === " ") {
            this.charIndex++;
        }
        var start = this.charIndex;
        while (this.charIndex < this.lines[this.rowIndex].length && this.lines[this.rowIndex].substr(this.charIndex, 1) !== " ") {
            this.charIndex++;
        }
        var length = this.charIndex - start;
        return this.lines[this.rowIndex].substr(start, length);
    };
    return FileLoader;
})();
var Graphics = (function () {
    function Graphics() {
    }
    Graphics.prototype.dot = function (v1, v2, v3) {
        var d = v1.subtract(v2);
        var e = v3.subtract(v2);
        var cross = d.cross(e);
        return cross.normalize();
    };
    Graphics.prototype.draw = function (obj, canvas, texture) {
        var cx = canvas.width / 2;
        var cy = canvas.height / 2;
        var cu = texture.width / 2;
        var cv = texture.height / 2;
        for (var i = 0; i < obj.meshes.length; i++) {
            var mesh = obj.meshes[i];
            var polygons = mesh.polygons;
            polygons.sort(function (p1, p2) {
                var z1 = mesh.calcVertices[p1.a].z + mesh.calcVertices[p1.b].z + mesh.calcVertices[p1.c].z;
                var z2 = mesh.calcVertices[p2.a].z + mesh.calcVertices[p2.b].z + mesh.calcVertices[p2.c].z;
                return z1 - z2;
            });
            for (var j = 0; j < mesh.polygons.length; j++) {
                var polygon = mesh.polygons[j];
                var a = mesh.calcVertices[polygon.a];
                var b = mesh.calcVertices[polygon.b];
                var c = mesh.calcVertices[polygon.c];
                var norm = this.dot(a, b, c);
                if (norm.z < 0) {
                    var xs = [Math.floor(a.x + cx), Math.floor(b.x + cx), Math.floor(c.x + cx)];
                    var ys = [Math.floor(a.y + cy), Math.floor(b.y + cy), Math.floor(c.y + cy)];
                    var na = mesh.calcVertexNormals[polygon.a];
                    var nb = mesh.calcVertexNormals[polygon.b];
                    var nc = mesh.calcVertexNormals[polygon.c];
                    var us = [Math.floor(na.x * 100) + cu, Math.floor(nb.x * 100) + cu, Math.floor(nc.x * 100) + cu];
                    var vs = [Math.floor(na.y * 100) + cv, Math.floor(nb.y * 100) + cv, Math.floor(nc.y * 100) + cv];
                    var face = new TextureFace(xs, ys, us, vs);
                    this.drawFace(face, canvas, texture);
                }
            }
        }
    };
    Graphics.prototype.drawFace = function (f, canvas, texture) {
        var top = 0;
        var middle = 1;
        var bottom = 2;
        var tmp;
        if (f.y[middle] < f.y[top]) {
            tmp = top;
            top = middle;
            middle = tmp;
        }
        if (f.y[middle] > f.y[bottom]) {
            tmp = middle;
            middle = bottom;
            bottom = tmp;
        }
        if (f.y[middle] < f.y[top]) {
            tmp = top;
            top = middle;
            middle = tmp;
        }
        //'draw upper-------------------------------------------------------------------------
        var x1 = f.x[top];
        var x2 = f.x[top];
        var xd1 = (f.x[middle] - f.x[top]) / (f.y[middle] + 1 - f.y[top]);
        var xd2 = (f.x[bottom] - f.x[top]) / (f.y[bottom] + 1 - f.y[top]);
        var u1 = f.u[top];
        var u2 = f.u[top];
        var ud1 = (f.u[middle] - f.u[top]) / (f.y[middle] + 1 - f.y[top]);
        var ud2 = (f.u[bottom] - f.u[top]) / (f.y[bottom] + 1 - f.y[top]);
        var v1 = f.v[top];
        var v2 = f.v[top];
        var vd1 = (f.v[middle] - f.v[top]) / (f.y[middle] + 1 - f.y[top]);
        var vd2 = (f.v[bottom] - f.v[top]) / (f.y[bottom] + 1 - f.y[top]);
        var i;
        for (i = f.y[top]; i < f.y[middle]; i++) {
            this.drawScanLine(i, Math.floor(x1), Math.floor(x2), u1, u2, v1, v2, canvas, texture);
            x1 += xd1;
            x2 += xd2;
            u1 += ud1;
            u2 += ud2;
            v1 += vd1;
            v2 += vd2;
        }
        //'draw lower-------------------------------------------------------------------------
        x1 = f.x[middle];
        u1 = f.u[middle];
        v1 = f.v[middle];
        xd1 = (f.x[bottom] - x1) / (f.y[bottom] + 1 - f.y[middle]);
        xd2 = (f.x[bottom] - x2) / (f.y[bottom] + 1 - f.y[middle]);
        ud1 = (f.u[bottom] - u1) / (f.y[bottom] + 1 - f.y[middle]);
        ud2 = (f.u[bottom] - u2) / (f.y[bottom] + 1 - f.y[middle]);
        vd1 = (f.v[bottom] - v1) / (f.y[bottom] + 1 - f.y[middle]);
        vd2 = (f.v[bottom] - v2) / (f.y[bottom] + 1 - f.y[middle]);
        for (i = f.y[middle]; i < f.y[bottom]; i++) {
            this.drawScanLine(i, Math.floor(x1), Math.floor(x2), u1, u2, v1, v2, canvas, texture);
            x1 += xd1;
            x2 += xd2;
            u1 += ud1;
            u2 += ud2;
            v1 += vd1;
            v2 += vd2;
        }
    };
    Graphics.prototype.getPixel = function (data, x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        var index = (x + (data.height - y) * data.width) * 4;
        var res = [data.data[index + 0], data.data[index + 1], data.data[index + 2]];
        return res;
    };
    Graphics.prototype.setPixel = function (canvas, x, y, rgb) {
        var index = (x + (canvas.height - y) * canvas.width) * 4;
        canvas.data[index + 0] = rgb[0];
        canvas.data[index + 1] = rgb[1];
        canvas.data[index + 2] = rgb[2];
        canvas.data[index + 3] = 255;
    };
    Graphics.prototype.drawScanLine = function (y, x1, x2, u1, u2, v1, v2, canvas, texture) {
        if (x2 - x1 === 0)
            return;
        var h1 = texture.height;
        var h2 = canvas.height;
        var ud = (u2 - u1) / Math.abs(x2 - x1);
        var vd = (v2 - v1) / Math.abs(x2 - x1);
        var step = x2 - x1 < 0 ? -1 : 1;
        for (var x = x1; x !== x2 + step; x += step) {
            var rgb = this.getPixel(texture, u1, h1 - v1);
            this.setPixel(canvas, x, h2 - y, rgb);
            u1 += ud;
            v1 += vd;
        }
    };
    Graphics.prototype.rotate = function (xRot, yRot, zRot, obj) {
        var cXa = Math.cos(xRot);
        var cYa = Math.cos(yRot);
        var cZa = Math.cos(zRot);
        var sXa = Math.sin(xRot);
        var sYa = Math.sin(yRot);
        var sZa = Math.sin(zRot);
        for (var meshIndex = 0; meshIndex < obj.meshes.length; meshIndex++) {
            var mesh = obj.meshes[meshIndex];
            var xpp2;
            var xpp1;
            var zpp3;
            var ypp3;
            var zpp2;
            var ypp1;
            var vertexIndex;
            //clear calculated vertices
            mesh.calcVertices = new Array(mesh.vertices.length);
            mesh.calcVertexNormals = new Array(mesh.vertices.length);
            for (vertexIndex = 0; vertexIndex < mesh.vertices.length; vertexIndex++) {
                //rotate vertices
                var vertex = mesh.vertices[vertexIndex];
                xpp1 = vertex.x * cXa + vertex.y * sXa;
                ypp1 = vertex.y * cXa - vertex.x * sXa;
                xpp2 = xpp1 * cYa + vertex.z * sYa;
                zpp2 = vertex.z * cYa - xpp1 * sYa;
                ypp3 = ypp1 * cZa - zpp2 * sZa;
                zpp3 = zpp2 * cZa + ypp1 * sZa;
                mesh.calcVertices[vertexIndex] = new Vertex(xpp2, ypp3, zpp3);
                //rotate vertex normals (used for environment mapping)
                var vertexNormal = mesh.vertexNormals[vertexIndex];
                xpp1 = vertexNormal.x * cXa + vertexNormal.y * sXa;
                ypp1 = vertexNormal.y * cXa - vertexNormal.x * sXa;
                xpp2 = xpp1 * cYa + vertexNormal.z * sYa;
                zpp2 = vertexNormal.z * cYa - xpp1 * sYa;
                ypp3 = ypp1 * cZa - zpp2 * sZa;
                zpp3 = zpp2 * cZa + ypp1 * sZa;
                mesh.calcVertexNormals[vertexIndex] = new Vertex(xpp2, ypp3, zpp3);
            }
        }
    };
    return Graphics;
})();
(function () {
    var img = new Image();
    img.onload = function () {
        var loader = new FileLoader();
        var obj = loader.loadFile(data, 11);
        var element = document.getElementById("canvas1");
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
        var g = new Graphics();
        var xr = 0;
        var yr = 0;
        var zr = 0;
        setInterval(function () {
            c.clearRect(0, 0, canvas.width, canvas.height);
            canvas = c.createImageData(width, height);
            g.rotate(xr, yr, zr, obj);
            xr += 0.01;
            yr += 0.013;
            zr += 0.02;
            g.draw(obj, canvas, texture);
            c.putImageData(canvas, 0, 0);
        }, 10);
    };
    img.src = "/images/phong4.png";
})();
