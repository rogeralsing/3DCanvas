var Canvas3D;
(function (Canvas3D) {
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
                var material = new Canvas3D.Material(r, g, b, id);
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
                    vertices[j] = new Canvas3D.Vertex(x, y, z);
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
                    faces[k] = new Canvas3D.Face(a, b, c, ab > 0, bc > 0, ca > 0);
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
                    vertexNormals[j] = new Canvas3D.Vertex(x, y, z);
                    this.nextLine();
                    this.find("MESH_VERTEXNORMAL");
                    j = this.readNextInt();
                    x = this.readNextFloat();
                    y = this.readNextFloat();
                    z = this.readNextFloat();
                    vertexNormals[j] = new Canvas3D.Vertex(x, y, z);
                    this.nextLine();
                    this.find("MESH_VERTEXNORMAL");
                    j = this.readNextInt();
                    x = this.readNextFloat();
                    y = this.readNextFloat();
                    z = this.readNextFloat();
                    vertexNormals[j] = new Canvas3D.Vertex(x, y, z);
                }
                this.find("MATERIAL_REF");
                var materialId = this.readNextInt();
                var polygons = new Array(numFaces);
                var outlines = new Array(numFaces);
                for (var m = 0; m < numFaces; m++) {
                    polygons[m] = new Canvas3D.Polygon(faces[m].a, faces[m].b, faces[m].c);
                    outlines[m] = new Canvas3D.Outline(faces[m].ab, faces[m].bc, faces[m].ca);
                }
                var mesh = new Canvas3D.Mesh(meshID, r, g, b, polygons, vertices, vertexNormals, outlines);
                meshes.push(mesh);
            }
            var res = new Canvas3D.Object3D(meshes);
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
    Canvas3D.FileLoader = FileLoader;
})(Canvas3D || (Canvas3D = {}));
//# sourceMappingURL=FileLoader.js.map