import * as THREE from 'three';
import * as topojson from 'topojson'
import * as d3 from 'd3'
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as dat from 'dat.gui';

var shouldAnimate = true;
const radius = 1 // TODO: changing this doesn't look that well 
const longitude_0 = 0 //Greenwich // TODO: changing this doesn't work correctly

var camera, scene, pointLight, renderer, sphere, latitudes, land;

var createSphere = function(){

    var geometry = new THREE.SphereGeometry(radius-0.01, 32, 32);
    var material = new THREE.MeshPhongMaterial( { color: 0xdddddd, specular: 0x009900, shininess: 30, flatShading: true, morphTargets: true } );

    var mercatorProjection = createMercatorProjection(geometry.vertices)
    geometry.morphTargets.push( { name: "mercator projection", vertices: mercatorProjection } );
    geometry = new THREE.BufferGeometry().fromGeometry( geometry ); //the final trick

    return new THREE.Mesh( geometry, material );
}

var createLatitudes = function(){
    // see https://stackoverflow.com/questions/44286821/three-js-spherebufferedgeometry-without-triangulated-mesh
    var segments = 48;
    var allLatitudesGeom = new THREE.BufferGeometry();
    var allLatitudesPositions = [];
    var vertices = [];
    var circle = new THREE.CircleGeometry(radius, segments, 0, Math.PI * 2);
    circle.vertices.shift(); // remove first segment
    circle.vertices.push(circle.vertices[0].clone()); // add last segment
    var latitudeIntervalDegree = 10.0;
    for (var i=0; i < 180.0/latitudeIntervalDegree; i++) {
        var geometry_i = circle.clone();
        geometry_i.rotateY(radians(latitudeIntervalDegree) * i);
        for ( var v = 0; v < geometry_i.vertices.length; v ++ ) {
            var vertex = geometry_i.vertices[ v ];
            vertices.push(vertex);
            allLatitudesPositions.push(vertex.x, vertex.y, vertex.z)
        }

    }
    //allLatitudesPositions = allLatitudesPositions.slice(0, -3);
    allLatitudesGeom.setAttribute( 'position', new THREE.Float32BufferAttribute( allLatitudesPositions, 3 ) );

    var mercatorProjection = createMercatorProjectionAsPoints(vertices);
    allLatitudesGeom.morphAttributes.position = [];
    allLatitudesGeom.morphAttributes.position.push(new THREE.Float32BufferAttribute( mercatorProjection, 3 ));
 
    var material = new THREE.LineBasicMaterial({color: 0xaaff00, scale: 4, morphTargets: true})
    var latitudes = new THREE.Line(allLatitudesGeom, material);

    latitudes.morphTargetInfluences = [];
    latitudes.morphTargetInfluences[0] = 0;

    return latitudes;
}

var createLand = async function(){
    // see https://bl.ocks.org/brett-miller/e55bee1bfc61af34186eae6856573d04

    var topology_url = "https://unpkg.com/world-atlas@1/world/50m.json"

    var topology = await (await fetch(topology_url)).json();
    console.log(topology.objects.land)

    var geojson_multiline_land = topojson.mesh(topology, topology.objects.land)
    console.log(geojson_multiline_land)
    var geometry = new THREE.BufferGeometry();
    var vertices = []
    var points = []
    geojson_multiline_land.coordinates.forEach(function(line) {
        d3.pairs(line.map(vertex), function(a, b) {
            vertices.push(a, b);
            points.push(a.x, a.y, a.z)
            points.push(b.x, b.y, b.z)
        });
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

    var mercatorProjection = createMercatorProjectionAsPoints(vertices);
    geometry.morphAttributes.position = [];
    geometry.morphAttributes.position.push(new THREE.Float32BufferAttribute( mercatorProjection, 3 ));

    var material = new THREE.LineBasicMaterial({color: 0xff0000, morphTargets: true});
    land = new THREE.LineSegments(geometry, material);
    land.morphTargetInfluences = [];
    land.morphTargetInfluences[0] = 0;
    scene.add(land);
    return land;
}

// Converts a point [longitude, latitude] in degrees to a THREE.Vector3.
function vertex(lonlat) {
    var lon_rad = radians(lonlat[0]),
        lat_rad = radians(lonlat[1]),
        cos_lat_rad = Math.cos(lat_rad);
    return new THREE.Vector3(
      radius * cos_lat_rad * Math.cos(lon_rad),
      radius * cos_lat_rad * Math.sin(lon_rad),
      radius * Math.sin(lat_rad)
    );
  }

var radians = function(degree) {
    return degree*Math.PI/180.0;
}
var degree = function(radians) {
    return radians/Math.PI*180.0;
}
var mercator_x_rad = function(longitude_rad) {
    //expects as input longitude in radians, can be converted before by radians(longitude)
    return radius * (longitude_rad - radians(longitude_0));
}

var mercator_y_rad = function(latitude_rad) {
    //expects as input latitude in radians, can be converted before by radians(latitude)
    return radius * Math.log(Math.tan(Math.PI/4+latitude_rad/2))
}
var createMercatorProjectionAsPoints = function(vertices){
    return createMercatorProjection(vertices, true);
}

var createMercatorProjection = function(vertices, asPoints=false){
    // see https://en.wikipedia.org/wiki/Mercator_projection 
    // and https://en.wikipedia.org/wiki/Polar_coordinate_system 

    var vertices_projected = [];
    for ( var v = 0; v < vertices.length; v ++ ) {
        var vertice = vertices[ v ]

        var mercator_x = mercator_x_rad(vertice.x);
        var mercator_y = mercator_y_rad(vertice.y);

        var z;
        var horizontal_radius = Math.sqrt(Math.pow(vertice.x, 2) + Math.pow(vertice.z, 2));
        if (horizontal_radius > 0.0001) {
            z = vertice.z / horizontal_radius;
            mercator_x = mercator_x / horizontal_radius;
        } else {
            z = 1;
            console.log(horizontal_radius);
        } 
        if (asPoints) {
            vertices_projected.push( mercator_x, mercator_y, z );
        } else {
            vertices_projected.push( new THREE.Vector3( mercator_x, mercator_y, z ) );
        }
    }
    return vertices_projected;
}

var animateRotate = function () {
    
    requestAnimationFrame( shouldAnimate? animateRotate : animateStatic);

    var timer = 0.0001 * Date.now();
    pointLight.position.x = Math.sin( timer * 7 ) * 3;
    pointLight.position.y = Math.cos( timer * 5 );
    pointLight.position.z = Math.cos( timer * 3 ) * 3;

    renderer.render( scene, camera );
};

var animateStatic = function() {

    requestAnimationFrame( shouldAnimate? animateRotate : animateStatic);

    renderer.render( scene, camera );
}

function initGUI() {
    // Set up dat.GUI to control targets
    var params = {
        Mercator: 0
    };
    var gui = new dat.GUI();
    var folder = gui.addFolder( 'Projection' );
    folder.add( params, 'Mercator', 0, 1 ).step( 0.01 ).onChange( function ( value ) {
        shouldAnimate = false;
        sphere.morphTargetInfluences[ 0 ] = value;
        latitudes.morphTargetInfluences[ 0 ] = value;
        land.morphTargetInfluences[ 0 ] = value;
    } );
    folder.open();
}

camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

scene = new THREE.Scene();

sphere = createSphere();
sphere.renderOrder = -1;
scene.add( sphere );


latitudes = createLatitudes();
scene.add(latitudes);

//async
createLand();

scene.add( new THREE.AmbientLight( 0x8FBCD4, 0.4 ) );
//scene.add( new THREE.DirectionalLight( 0xffffff, 0.125 ));

pointLight = new THREE.PointLight( 0xffffff, 1 );
scene.add( pointLight );
pointLight.add( new THREE.Mesh( new THREE.SphereBufferGeometry( 0.1, 8, 8 ), new THREE.MeshBasicMaterial( { color: 0xffffff } ) ) );

initGUI()

renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );

shouldAnimate ? animateRotate() : animateStatic();

document.body.appendChild( renderer.domElement );

new OrbitControls( camera, renderer.domElement );




