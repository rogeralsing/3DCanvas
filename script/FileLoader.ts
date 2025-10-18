module Canvas3D {

    export class FileLoader {
        private rowIndex = 0;
        private charIndex = 0;
        private lines: string[] = [];

        loadFile(content: string, zoom: number): Object3D {
            this.rowIndex = 0;
            this.charIndex = 0;
            const sanitized = content.replace(/\t/g, " ").replace(/\r/g, "");
            this.lines = sanitized.split("\n");

            if (!this.find("MATERIAL_COUNT")) {
                throw new Error("Unable to locate MATERIAL_COUNT in provided data.");
            }

            const numMaterials = this.readNextInt();
            const materials: Material[] = [];
            for (let i = 0; i < numMaterials; i++) {
                this.find("MATERIAL_NAME");
                const id = this.readNext();
                this.find("MATERIAL_DIFFUSE");
                const r = this.readNextFloat() * 255;
                const g = this.readNextFloat() * 255;
                const b = this.readNextFloat() * 255;
                materials[i] = new Material(r, g, b, id);
            }

            const meshes: Mesh[] = [];
            while (this.find("GEOMOBJECT")) {
                this.find("NODE_NAME");
                const meshID = this.readNext();
                this.find("MESH_NUMVERTEX");
                const numVertex = this.readNextInt();
                this.find("MESH_NUMFACES");
                const numFaces = this.readNextInt();
                this.find("MESH_VERTEX_LIST");

                const vertices: Vertex[] = new Array(numVertex);
                for (let j = 0; j < numVertex; j++) {
                    this.nextLine();
                    this.find("MESH_VERTEX");
                    this.readNext();
                    const x = this.readNextFloat() * zoom;
                    const y = this.readNextFloat() * zoom;
                    const z = this.readNextFloat() * zoom;
                    vertices[j] = new Vertex(x, y, z);
                }

                this.find("MESH_FACE_LIST");
                const faces: Face[] = new Array(numFaces);
                for (let k = 0; k < numFaces; k++) {
                    this.nextLine();
                    this.find("MESH_FACE");
                    this.readNext();
                    this.readNext();

                    const a = this.readNextInt();
                    this.readNext();
                    const b = this.readNextInt();
                    this.readNext();
                    const c = this.readNextInt();

                    this.find("AB:");
                    const ab = this.readNextInt();
                    this.find("BC:");
                    const bc = this.readNextInt();
                    this.find("CA:");
                    const ca = this.readNextInt();

                    faces[k] = new Face(a, b, c, ab > 0, bc > 0, ca > 0);
                }

                const vertexNormals: Vertex[] = new Array(numVertex);
                this.find("MESH_NORMALS");
                for (let faceIndex = 0; faceIndex < numFaces; faceIndex++) {
                    this.find("*MESH_FACENORMAL");
                    this.find("*MESH_FACENORMAL");
                    for (let corner = 0; corner < 3; corner++) {
                        this.find("MESH_VERTEXNORMAL");
                        const vertexIndex = this.readNextInt();
                        const nx = this.readNextFloat();
                        const ny = this.readNextFloat();
                        const nz = this.readNextFloat();
                        vertexNormals[vertexIndex] = new Vertex(nx, ny, nz);
                        if (corner < 2) {
                            this.nextLine();
                        }
                    }
                }

                this.find("MATERIAL_REF");
                const materialId = this.readNextInt();
                const polygons: Polygon[] = new Array(numFaces);
                const outlines: Outline[] = new Array(numFaces);
                for (let m = 0; m < numFaces; m++) {
                    polygons[m] = new Polygon(faces[m].a, faces[m].b, faces[m].c);
                    outlines[m] = new Outline(faces[m].ab, faces[m].bc, faces[m].ca);
                }

                const material = materials[materialId] ?? new Material(255, 255, 255, "default");
                const mesh = new Mesh(meshID, material.r, material.g, material.b, polygons, vertices, vertexNormals, outlines);
                meshes.push(mesh);
            }

            return new Object3D(meshes);
        }

        private nextLine() {
            this.rowIndex++;
            this.charIndex = 0;
        }

        private find(text: string): boolean {
            this.charIndex = 0;
            while (this.rowIndex < this.lines.length && this.lines[this.rowIndex].indexOf(text) < 0) {
                this.rowIndex++;
            }
            if (this.rowIndex >= this.lines.length) {
                return false;
            }
            this.charIndex = this.lines[this.rowIndex].indexOf(text) + text.length;
            return true;
        }

        private readNextFloat(): number {
            return parseFloat(this.readNext());
        }

        private readNextInt(): number {
            return parseInt(this.readNext(), 10);
        }

        private readNext(): string {
            const line = this.lines[this.rowIndex];
            while (this.charIndex < line.length && line.charAt(this.charIndex) === " ") {
                this.charIndex++;
            }
            const start = this.charIndex;
            while (this.charIndex < line.length && line.charAt(this.charIndex) !== " ") {
                this.charIndex++;
            }
            return line.slice(start, this.charIndex);
        }
    }
}
