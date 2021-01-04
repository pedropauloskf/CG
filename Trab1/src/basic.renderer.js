(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.BasicRenderer = {}));
}(this, (function (exports) { 'use strict';


        /* ------------------------------------------------------------ */


    function boundingBox(primitive) {
        var X = {i: 0, f: 0};
        var Y = {i: 0, f: 0};

        primitive.vertices.map((v, index) => {
            if (index == 0){
                X = {i: v[0], f: v[0]};
                Y = {i: v[1], f: v[1]};
            }
            else {
                X = {
                    i: X.i > v[0] ? v[0] : X.i, 
                    f: X.f < v[0] ? v[0] : X.f
                };
                Y = {
                    i: Y.i > v[1] ? v[1] : Y.i, 
                    f: Y.f < v[1] ? v[1] : Y.f
                };
            }
        })

        return {X, Y};
    }

    function inside(  x, y, primitive  ) {
        function normVect(A, B){
            var N = [-1*(B[1]-A[1]), (B[0] - A[0])]        
            return N;
        }
        if (primitive.shape == 'triangle'){
            var vert = primitive.vertices;
        
            //Coordenadas dos vértices
            var P0 = [vert[0][0], vert[0][1]];
            var P1 = [vert[1][0], vert[1][1]];
            var P2 = [vert[2][0], vert[2][1]];
    
            //Normais
            var n0 = normVect(P0, P1);
            var n1 = normVect(P1, P2);
            var n2 = normVect(P2, P0);
    
            //Vetores até o ponto genérico (x,y)
            var d0 = [x - P0[0], y - P0[1] ];
            var d1 = [x - P1[0], y - P1[1] ];
            var d2 = [x - P2[0], y - P2[1] ];
    
            //Produto interno entre vetores e suas normais 
            var L0 = (d0[0] * n0[0]) + (d0[1] * n0[1]);
            var L1 = (d1[0] * n1[0]) + (d1[1] * n1[1]);
            var L2 = (d2[0] * n2[0]) + (d2[1] * n2[1]);
            
            if (L0>0 && L1>0 && L2>0 || L0<0 && L1<0 && L2<0){
                return true;
            }
        }
        else {      
            return false
        }
    }

    function transform(primitive){
        var {vertices, xform, color, shape} = primitive

        var matrix = nj.array(xform)
        var vectMatrix = nj.array(vertices.map(v => [...v, 1]));

        var new_vertices = nj.dot(matrix, vectMatrix).tolist();
        
        var transf_primitive = {
            shape,
            vertices: new_vertices.map(v => [Math.floor(v[0]), Math.floor(v[1])]),
            color,
            xform
        }

        return transf_primitive;
    }

    function pushScene(preprop_scene, primitive) {
        var prim = primitive.xform ? transform(primitive) : primitive;
        var bBox = boundingBox(prim);    

        preprop_scene.push({primitive: prim, boundingBox: bBox});
        return preprop_scene;
    }

    function polygonToTriangles(preprop_scene, primitive) {
        const { vertices, color, xform } = primitive;

        for (var i = 1; i < vertices.length - 1; i++){
            var triangulo = {
                shape: 'triangle',
                vertices: [
                    vertices[0],
                    vertices[i],
                    vertices[i+1]
                ],
                color,
                xform
            }

            preprop_scene = pushScene(preprop_scene, triangulo)  
        }
        
        return preprop_scene;
    }

    function circleToTriangles (preprop_scene, primitive, n) {
        function getRadians(n){ //Criação de lista de variação da angulação do círculo
            var radList = [];
            const degree = (2 * Math.PI)/(n+2);
            for (var i = 0; i < n+2; i++){
                radList.push(i*degree);
            }
            return radList;
        }

        const list = getRadians(n);
        const { radius: r, center, color, xform } = primitive;
        const [centerX, centerY] = center;
        // Criação de pontos através da equação paramétrica do círculo
        const P = list.map((degree) => {
            return [Math.floor(r * Math.sin(degree) + centerX), Math.floor(r * Math.cos(degree) + centerY)];
        })

        return polygonToTriangles(preprop_scene, {vertices: P, color, xform});
    }        
    
    function Screen( width, height, scene ) {
        this.width = width;
        this.height = height;
        this.scene = this.preprocess(scene);   
        this.createImage(); 
    }

    Object.assign( Screen.prototype, {

            preprocess: function(scene) {
                // Possible preprocessing with scene primitives, for now we don't change anything
                // You may define bounding boxes, convert shapes, etc
                
                var preprop_scene = [];

                for( var primitive of scene ) {  

                    if (primitive.shape == 'triangle'){
                        preprop_scene = pushScene(preprop_scene, primitive);
                    }

                    if (primitive.shape == 'polygon'){
                        preprop_scene = polygonToTriangles(preprop_scene, primitive);
                    }

                    if (primitive.shape == 'circle'){
                        preprop_scene = circleToTriangles(preprop_scene, primitive, 30)
                    }
                }
                
                return preprop_scene;
            },

            createImage: function() {
                this.image = nj.ones([this.height, this.width, 3]).multiply(255);
            },

            rasterize: function() {
                var color;
         
                // In this loop, the image attribute must be updated after the rasterization procedure.
                for( var group of this.scene ) {
                    const {primitive, boundingBox} = group;

                    // Loop through all pixels
                    for (var i = boundingBox.X.i; i < boundingBox.X.f; i++) {
                        var x = i + 0.5;

                        for( var j = boundingBox.Y.i; j < boundingBox.Y.f; j++) {
                            var y = j + 0.5;

                            if ( inside( x, y, primitive ) ) {
                                color = nj.array(primitive.color);
                                this.set_pixel( i, this.height - (j + 1), color );
                            }
                        }
                    }
                }
            },

            set_pixel: function( i, j, colorarr ) {
                // We assume that every shape has solid color
         
                this.image.set(j, i, 0,    colorarr.get(0));
                this.image.set(j, i, 1,    colorarr.get(1));
                this.image.set(j, i, 2,    colorarr.get(2));
            },

            update: function () {
                // Loading HTML element
                var $image = document.getElementById('raster_image');
                $image.width = this.width; $image.height = this.height;

                // Saving the image
                nj.images.save( this.image, $image );
            }
        }
    );

    exports.Screen = Screen;
    
})));

