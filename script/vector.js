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
//# sourceMappingURL=vector.js.map