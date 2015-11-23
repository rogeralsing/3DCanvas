module Canvas3D {
    export class Point {
        constructor(public x: number, public y: number) {
        }
    }

    export class Material {
        constructor(public r: number, public g: number, public b: number, public id: string) {
        }
    }

    export class TextureFace {
        constructor(public x: number[], public y: number[], public u: number[], public v: number[]) {
        }
    }

    export class Vertex {
        constructor(public x: number, public y: number, public z: number) {
        }

        subtract(other: Vertex): Vertex {
            return new Vertex(this.x - other.x, this.y - other.y, this.z - other.z);
        }

        add(other: Vertex): Vertex {
            return new Vertex(this.x + other.x, this.y + other.y, this.z + other.z);
        }

        cross(other: Vertex): Vertex {
            return new Vertex(
                this.y * other.z - this.z * other.y,
                this.z * other.x - this.x * other.z,
                this.x * other.y - this.y * other.x
            );
        }

        normalize(): Vertex {
            var h = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
            if (h === 0) {
                return new Vertex(0, 0, 0.01); //hack
            }
            return new Vertex(this.x / h, this.y / h, this.z / h);
        }
    }

    export class Face {
        constructor(public a: number, public b: number, public c: number, public ab: boolean, public bc: boolean, public ca: boolean) {

        }
    }

    export class Polygon {
        constructor(public a: number, public b: number, public c: number) {
        }
    }

    export class Outline {
        constructor(public ab: boolean, public bc: boolean, public ca: boolean) {
        }
    }

    export class Mesh {
        calcVertices: Vertex[];
        calcVertexNormals: Vertex[];

        constructor(
            public name: string,
            public r: number,
            public g: number,
            public b: number,
            public polygons: Polygon[],
            public vertices: Vertex[],
            public vertexNormals: Vertex[],
            public outlines: Outline[]
        ) {

        }
    }

    export class Object2D {
        constructor(public meshes: Mesh[]) {
        }
    }
}