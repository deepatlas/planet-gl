import * as THREE from 'three';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as dat from 'dat.gui';

var shouldAnimate = true;
const radius = 1 // TODO: changing this doesn't look that well 
const longitude_0 = 0 //Greenwich // TODO: changing this doesn't work correctly

var camera, scene, renderer, sphere;

var createSphere = function(){

    var geometry = new THREE.SphereGeometry(radius, 32, 32);
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: 0xdd00dd, morphTargets: true } );
    //var material = new THREE.MeshPhongMaterial( { color: 0xdd00dd, flatShading: true, morphTargets: true } );

    var mercatorProjection = createMercatorProjection(geometry)
    geometry.morphTargets.push( { name: "mercator projection", vertices: mercatorProjection } );
    geometry = new THREE.BufferGeometry().fromGeometry( geometry ); //the final trick
    return new THREE.Mesh( geometry, material );
}

var createCylinder = function(){

    var geometry = new THREE.CylinderGeometry(radius, radius, radius*2, 32, 8);
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: 0x00ff00 } );
    return new THREE.Mesh( geometry, material );
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

var createMercatorProjection = function(sphereGeometry){
    // see https://en.wikipedia.org/wiki/Mercator_projection 
    // and https://en.wikipedia.org/wiki/Polar_coordinate_system 

    var vertices = [];
    for ( var v = 0; v < sphereGeometry.vertices.length; v ++ ) {
        var vertice = sphereGeometry.vertices[ v ]

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

        vertices.push( new THREE.Vector3( mercator_x, mercator_y, z ) );
    }
    return vertices;
}

var animateRotate = function () {
    
    requestAnimationFrame( shouldAnimate? animateRotate : animateStatic);

    sphere.rotation.x += 0.01;
    sphere.rotation.y += 0.01;

    cylinder.rotation.x += 0.001;
    cylinder.rotation.y += 0.01;
    cylinder.rotation.z += 0.001;

    renderer.render( scene, camera );
};

var animateStatic = function() {

    requestAnimationFrame( shouldAnimate? animateRotate : animateStatic);

    sphere.rotation.x = 0;
    sphere.rotation.y = 0;

    cylinder.rotation.x = 0;
    cylinder.rotation.y = 0;
    cylinder.rotation.z = 0;

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
    } );
    folder.open();
}

camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

scene = new THREE.Scene();

sphere = createSphere()
scene.add( sphere );

var cylinder = createCylinder()
scene.add( cylinder );

scene.add( new THREE.AmbientLight( 0x8FBCD4, 0.4 ) );

initGUI()

renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );

shouldAnimate ? animateRotate() : animateStatic();

document.body.appendChild( renderer.domElement );

new OrbitControls( camera, renderer.domElement );




