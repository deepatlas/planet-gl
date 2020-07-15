import * as THREE from 'three';

var createSphere = function(){

    var geometry = new THREE.SphereGeometry(2, 32, 32);
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: 0xdd00dd } );
    var sphere = new THREE.Mesh( geometry, material );
    return sphere;
}

var animate = function () {
    requestAnimationFrame( animate );

    sphere.rotation.x += 0.01;
    sphere.rotation.y += 0.01;

    renderer.render( scene, camera );
};


var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

var sphere = createSphere()

const scene = new THREE.Scene();
scene.add( sphere );

animate();


