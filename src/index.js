import * as THREE from 'three';

var createSphere = function(){

    var geometry = new THREE.SphereGeometry(2, 32, 32);
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: 0xdd00dd } );
    var sphere = new THREE.Mesh( geometry, material );
    return sphere;
}

var createCylinder = function(){

    var geometry = new THREE.CylinderGeometry(2, 2, 5, 32, 8);
    var material = new THREE.MeshBasicMaterial( { wireframe: true, color: 0x00ff00 } );
    var cylinder = new THREE.Mesh( geometry, material );
    return cylinder;
}


var animate = function () {
    requestAnimationFrame( animate );

    sphere.rotation.x += 0.01;
    sphere.rotation.y += 0.01;

    cylinder.rotation.x += 0.001;
    cylinder.rotation.y += 0.01;
    cylinder.rotation.z += 0.001;

    renderer.render( scene, camera );
};


var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 10;

const scene = new THREE.Scene();

var sphere = createSphere()
scene.add( sphere );

var cylinder = createCylinder()
scene.add( cylinder );


animate();


