module Canvas3D {

    export class RenderEngine {

        private static clamp(value: number, min: number, max: number): number {
            return Math.max(min, Math.min(max, value));
        }

        private computeNormal(v1: Vertex, v2: Vertex, v3: Vertex): Vertex {
            const d = v1.subtract(v2);
            const e = v3.subtract(v2);
            const cross = d.cross(e);
            return cross.normalize();
        }

        draw(obj: Object3D, canvas: ImageData, texture: ImageData) {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const cu = texture.width / 2;
            const cv = texture.height / 2;

            for (const mesh of obj.meshes) {
                const sortedPolygons = [...mesh.polygons];
                sortedPolygons.sort((p1: Polygon, p2: Polygon) => {
                    const z1 = mesh.calcVertices[p1.a].z + mesh.calcVertices[p1.b].z + mesh.calcVertices[p1.c].z;
                    const z2 = mesh.calcVertices[p2.a].z + mesh.calcVertices[p2.b].z + mesh.calcVertices[p2.c].z;
                    return z1 - z2;
                });

                for (const polygon of sortedPolygons) {
                    const a = mesh.calcVertices[polygon.a];
                    const b = mesh.calcVertices[polygon.b];
                    const c = mesh.calcVertices[polygon.c];
                    if (!a || !b || !c) {
                        continue;
                    }
                    const norm = this.computeNormal(a, b, c);

                    if (norm.z < 0) {
                        const xs = [Math.floor(a.x + cx), Math.floor(b.x + cx), Math.floor(c.x + cx)];
                        const ys = [Math.floor(a.y + cy), Math.floor(b.y + cy), Math.floor(c.y + cy)];
                        const na = mesh.calcVertexNormals[polygon.a];
                        const nb = mesh.calcVertexNormals[polygon.b];
                        const nc = mesh.calcVertexNormals[polygon.c];
                        if (!na || !nb || !nc) {
                            continue;
                        }
                        const us = [Math.floor(na.x * cu) + cu, Math.floor(nb.x * cu) + cu, Math.floor(nc.x * cu) + cu];
                        const vs = [Math.floor(na.y * cv) + cv, Math.floor(nb.y * cv) + cv, Math.floor(nc.y * cv) + cv];
                        const face = new TextureFace(xs, ys, us, vs);
                        this.drawFace(face, canvas, texture);
                    }
                }
            }
        }

        private drawFace(face: TextureFace, canvas: ImageData, texture: ImageData) {
            const order = [0, 1, 2].sort((a, b) => face.y[a] - face.y[b]);
            const [top, middle, bottom] = order;

            const drawSection = (
                startY: number,
                endY: number,
                left: { x: number; u: number; v: number },
                right: { x: number; u: number; v: number },
                leftDelta: { x: number; u: number; v: number },
                rightDelta: { x: number; u: number; v: number }
            ) => {
                for (let y = startY; y < endY; y++) {
                    this.drawScanLine(
                        y,
                        Math.floor(left.x),
                        Math.floor(right.x),
                        left.u,
                        right.u,
                        left.v,
                        right.v,
                        canvas,
                        texture
                    );
                    left.x += leftDelta.x;
                    left.u += leftDelta.u;
                    left.v += leftDelta.v;
                    right.x += rightDelta.x;
                    right.u += rightDelta.u;
                    right.v += rightDelta.v;
                }
            };

            const upperLeft = { x: face.x[top], u: face.u[top], v: face.v[top] };
            const upperRight = { ...upperLeft };
            const upperDenominator = Math.max(1, face.y[middle] + 1 - face.y[top]);
            const upperLeftDelta = {
                x: (face.x[middle] - face.x[top]) / upperDenominator,
                u: (face.u[middle] - face.u[top]) / upperDenominator,
                v: (face.v[middle] - face.v[top]) / upperDenominator
            };
            const upperRightDenominator = Math.max(1, face.y[bottom] + 1 - face.y[top]);
            const upperRightDelta = {
                x: (face.x[bottom] - face.x[top]) / upperRightDenominator,
                u: (face.u[bottom] - face.u[top]) / upperRightDenominator,
                v: (face.v[bottom] - face.v[top]) / upperRightDenominator
            };

            drawSection(face.y[top], face.y[middle], upperLeft, upperRight, upperLeftDelta, upperRightDelta);

            const lowerLeft = { x: face.x[middle], u: face.u[middle], v: face.v[middle] };
            const lowerRight = { ...upperRight };
            const lowerDenominator = Math.max(1, face.y[bottom] + 1 - face.y[middle]);
            const lowerLeftDelta = {
                x: (face.x[bottom] - lowerLeft.x) / lowerDenominator,
                u: (face.u[bottom] - lowerLeft.u) / lowerDenominator,
                v: (face.v[bottom] - lowerLeft.v) / lowerDenominator
            };
            const lowerRightDelta = {
                x: (face.x[bottom] - lowerRight.x) / lowerDenominator,
                u: (face.u[bottom] - lowerRight.u) / lowerDenominator,
                v: (face.v[bottom] - lowerRight.v) / lowerDenominator
            };

            drawSection(face.y[middle], face.y[bottom], lowerLeft, lowerRight, lowerLeftDelta, lowerRightDelta);
        }

        private getPixel(data: ImageData, x: number, y: number): number[] {
            const clampedX = RenderEngine.clamp(Math.floor(x), 0, data.width - 1);
            const clampedY = RenderEngine.clamp(Math.floor(y), 0, data.height - 1);
            const index = (clampedX + (data.height - clampedY) * data.width) * 4;
            return [
                data.data[index + 0],
                data.data[index + 1],
                data.data[index + 2]
            ];
        }

        private setPixel(canvas: ImageData, x: number, y: number, rgb: number[]) {
            const clampedX = RenderEngine.clamp(Math.floor(x), 0, canvas.width - 1);
            const clampedY = RenderEngine.clamp(Math.floor(y), 0, canvas.height - 1);
            const index = (clampedX + (canvas.height - clampedY) * canvas.width) * 4;
            canvas.data[index + 0] = rgb[0];
            canvas.data[index + 1] = rgb[1];
            canvas.data[index + 2] = rgb[2];
            canvas.data[index + 3] = 255;
        }

        private drawScanLine(
            y: number,
            x1: number,
            x2: number,
            u1: number,
            u2: number,
            v1: number,
            v2: number,
            canvas: ImageData,
            texture: ImageData
        ) {
            const distance = x2 - x1;
            if (distance === 0) {
                return;
            }

            const step = distance < 0 ? -1 : 1;
            const length = Math.abs(distance);
            const uDelta = (u2 - u1) / length;
            const vDelta = (v2 - v1) / length;
            let currentU = u1;
            let currentV = v1;
            const textureHeight = texture.height;
            const canvasHeight = canvas.height;

            for (let x = x1; x !== x2 + step; x += step) {
                const rgb = this.getPixel(texture, currentU, textureHeight - currentV);
                this.setPixel(canvas, x, canvasHeight - y, rgb);
                currentU += uDelta;
                currentV += vDelta;
            }
        }

        rotate(xRot: number, yRot: number, zRot: number, obj: Object3D) {
            const cXa = Math.cos(xRot);
            const cYa = Math.cos(yRot);
            const cZa = Math.cos(zRot);
            const sXa = Math.sin(xRot);
            const sYa = Math.sin(yRot);
            const sZa = Math.sin(zRot);

            for (const mesh of obj.meshes) {
                const vertexCount = mesh.vertices.length;
                mesh.calcVertices = new Array<Vertex>(vertexCount);
                mesh.calcVertexNormals = new Array<Vertex>(vertexCount);

                for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
                    const vertex = mesh.vertices[vertexIndex];
                    const xpp1 = vertex.x * cXa + vertex.y * sXa;
                    const ypp1 = vertex.y * cXa - vertex.x * sXa;
                    const xpp2 = xpp1 * cYa + vertex.z * sYa;
                    const zpp2 = vertex.z * cYa - xpp1 * sYa;
                    const ypp3 = ypp1 * cZa - zpp2 * sZa;
                    const zpp3 = zpp2 * cZa + ypp1 * sZa;
                    mesh.calcVertices[vertexIndex] = new Vertex(xpp2, ypp3, zpp3);

                    const vertexNormal = mesh.vertexNormals[vertexIndex];
                    const xn1 = vertexNormal.x * cXa + vertexNormal.y * sXa;
                    const yn1 = vertexNormal.y * cXa - vertexNormal.x * sXa;
                    const xn2 = xn1 * cYa + vertexNormal.z * sYa;
                    const zn2 = vertexNormal.z * cYa - xn1 * sYa;
                    const yn3 = yn1 * cZa - zn2 * sZa;
                    const zn3 = zn2 * cZa + yn1 * sZa;
                    mesh.calcVertexNormals[vertexIndex] = new Vertex(xn2, yn3, zn3);
                }
            }
        }
    }
}
