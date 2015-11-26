module Canvas3D {

    export class RenderEngine {

        dot(v1: Vertex, v2: Vertex, v3: Vertex): Vertex {
            var d = v1.subtract(v2);
            var e = v3.subtract(v2);
            var cross = d.cross(e);
            return cross.normalize();
        }

        draw(obj: Object3D, canvas: ImageData, texture: ImageData) {
            var cx = canvas.width / 2;
            var cy = canvas.height / 2;
            var cu = texture.width / 2;
            var cv = texture.height / 2;

            for (var i = 0; i < obj.meshes.length; i++) {
                var mesh = obj.meshes[i];
                var polygons = mesh.polygons;
                polygons.sort((p1: Polygon, p2: Polygon) => {

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
                    //remove polygons based on culling
                    if (norm.z < 0) {
                        var xs = [Math.floor(a.x + cx), Math.floor(b.x + cx), Math.floor(c.x + cx)];
                        var ys = [Math.floor(a.y + cy), Math.floor(b.y + cy), Math.floor(c.y + cy)];
                        var na = mesh.calcVertexNormals[polygon.a];
                        var nb = mesh.calcVertexNormals[polygon.b];
                        var nc = mesh.calcVertexNormals[polygon.c];
                        var us = [Math.floor(na.x * cu) + cu, Math.floor(nb.x * cu) + cu, Math.floor(nc.x * cu) + cu];
                        var vs = [Math.floor(na.y * cv) + cv, Math.floor(nb.y * cv) + cv, Math.floor(nc.y * cv) + cv];
                        var face = new TextureFace(xs, ys, us, vs);
                        this.drawFace(face, canvas, texture);
                    }
                }
            }
        }

        drawFace(f: TextureFace, canvas: ImageData, texture: ImageData) {

            var top = 0;
            var middle = 1;
            var bottom = 2;
            var tmp: number;
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
            var u1 = f.u[top];
            var u2 = f.u[top];
            var v1 = f.v[top];
            var v2 = f.v[top];

            var xd1 = (f.x[middle] - f.x[top]) / (f.y[middle] + 1 - f.y[top]);
            var xd2 = (f.x[bottom] - f.x[top]) / (f.y[bottom] + 1 - f.y[top]);
            var ud1 = (f.u[middle] - f.u[top]) / (f.y[middle] + 1 - f.y[top]);
            var ud2 = (f.u[bottom] - f.u[top]) / (f.y[bottom] + 1 - f.y[top]);
            var vd1 = (f.v[middle] - f.v[top]) / (f.y[middle] + 1 - f.y[top]);
            var vd2 = (f.v[bottom] - f.v[top]) / (f.y[bottom] + 1 - f.y[top]);
            var i: number;
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
        }

        getPixel(data: ImageData, x: number, y): number[] {
            x = Math.floor(x);
            y = Math.floor(y);

            var index = (x + (data.height - y) * data.width) * 4;
            var res = [data.data[index + 0], data.data[index + 1], data.data[index + 2]];
            return res;
        }

        setPixel(canvas: ImageData, x: number, y: number, rgb: number[]) {
            var index = (x + (canvas.height - y) * canvas.width) * 4;
            canvas.data[index + 0] = rgb[0];
            canvas.data[index + 1] = rgb[1];
            canvas.data[index + 2] = rgb[2];
            canvas.data[index + 3] = 255;
        }

        drawScanLine(y: number, x1: number, x2: number, u1: number, u2: number, v1: number, v2: number, canvas: ImageData, texture: ImageData) {

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
        }

        rotate(xRot: number, yRot: number, zRot: number, obj: Object3D) {

            var cXa = Math.cos(xRot);
            var cYa = Math.cos(yRot);
            var cZa = Math.cos(zRot);
            var sXa = Math.sin(xRot);
            var sYa = Math.sin(yRot);
            var sZa = Math.sin(zRot);

            for (var meshIndex = 0; meshIndex < obj.meshes.length; meshIndex++) {
                var mesh = obj.meshes[meshIndex];
                var xpp2: number;
                var xpp1: number;

                var zpp3: number;
                var ypp3: number;
                var zpp2: number;
                var ypp1: number;
                var vertexIndex: number;

                //clear calculated vertices
                mesh.calcVertices = new Array<Vertex>(mesh.vertices.length);
                mesh.calcVertexNormals = new Array<Vertex>(mesh.vertices.length);

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
        }
    }
}