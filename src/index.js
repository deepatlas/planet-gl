import * as THREE from 'three';
import * as topojson from 'topojson'
import * as d3 from 'd3'
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import * as dat from 'dat.gui';
//import space from './hubble_extreme_deep_field.jpg'
import space from './images/esa_gaia_milkyway_300_contrast.png'
//import earthspec from './earthspec1k.jpg'
import earthbump from './images/earthbump1k.jpg'
import earthmap from './images/earthmap1k.jpg'

var shouldAnimate = true;
const radius = 1 // TODO: changing this doesn't look that well 
const longitude_0 = 0 //Greenwich // TODO: changing this doesn't work correctly

var camera, scene, pointLight, renderer, sphere, latitudes, land
var positionMarker, userPosition, mercatorPosition;
var winterSummer = 0;

var createSphere = function(){

    var geometry = new THREE.SphereGeometry(radius-0.001, 32, 32);

    var material = new THREE.MeshPhongMaterial( { color: 0xdddddd, morphTargets: true } );

    //see http://planetpixelemporium.com/planets.html and https://github.com/jeromeetienne/threex.planets/ 
    // for earth & planet textures
    material.map    = THREE.ImageUtils.loadTexture(earthmap)
    material.bumpMap    = THREE.ImageUtils.loadTexture(earthbump)
    material.bumpScale = 0.05

    var mercatorProjection = createMercatorProjectionFromVertices(geometry.vertices);
    geometry.morphTargets.push( { name: "mercator projection", vertices: mercatorProjection } );
    geometry = new THREE.BufferGeometry().fromGeometry( geometry ); //the final trick

    return new THREE.Mesh( geometry, material );
}

var createLatitudes = function(){
    // see https://stackoverflow.com/questions/44286821/three-js-spherebufferedgeometry-without-triangulated-mesh
    var segments = 48;
    var allLatitudesGeom = new THREE.BufferGeometry();
    var allLatitudesPositions = [];
    var circle = new THREE.CircleGeometry(radius, segments, 0, Math.PI * 2);
    circle.vertices.shift(); // remove first segment
    circle.vertices.push(circle.vertices[0].clone()); // add last segment
    var latitudeIntervalDegree = 10.0;
    for (var i=0; i < 180.0/latitudeIntervalDegree; i++) {
        var geometry_i = circle.clone();
        geometry_i.rotateY(radians(latitudeIntervalDegree) * i);
        for ( var v = 0; v < geometry_i.vertices.length; v ++ ) {
            var vertex = geometry_i.vertices[ v ];
            allLatitudesPositions.push(vertex.x, vertex.y, vertex.z)
        }

    }
    //allLatitudesPositions = allLatitudesPositions.slice(0, -3);
    allLatitudesGeom.setAttribute( 'position', new THREE.Float32BufferAttribute( allLatitudesPositions, 3 ) );
 
    var material = new THREE.LineBasicMaterial({color: 0x20708b, scale: 4, morphTargets: true})
    var latitudes = new THREE.Line(allLatitudesGeom, material);
    addMercatorProjection(latitudes);

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
    var points = []
    geojson_multiline_land.coordinates.forEach(function(line) {
        d3.pairs(line.map(vertex), function(a, b) {
            points.push(a.x, a.y, a.z)
            points.push(b.x, b.y, b.z)
        });
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

    var material = new THREE.LineBasicMaterial({color: 0x666666, morphTargets: true});
    land = new THREE.LineSegments(geometry, material);
    addMercatorProjection(land);

    scene.add(land);

    return land;
}

var createSpace = function(){
    //var geometry = new THREE.SphereGeometry(100, 32, 32);
    const boxSize = 1000;
    var geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const spaceTexture = new THREE.TextureLoader().load(space);
    var material = new THREE.MeshBasicMaterial({map : spaceTexture, side: THREE.BackSide});

    var spaceMesh = new THREE.Mesh( geometry, material );
    scene.add(spaceMesh)
    return spaceMesh;

}


var addMercatorProjection = function(mesh){
    var positions = mesh.geometry.getAttribute ('position').array;
    var mercatorProjection = createMercatorProjectionAsPoints(positions);
    mesh.geometry.morphAttributes.position = [];
    mesh.geometry.morphAttributes.position.push(new THREE.Float32BufferAttribute( mercatorProjection, 3 ));
    mesh.updateMorphTargets();
    mesh.morphTargetInfluences[0] = 0;
}

// Converts a point [longitude, latitude] in degrees to a THREE.Vector3.
function vertex(lonlat) {
    var lon_rad = radians(lonlat[0]),
        lat_rad = radians(lonlat[1]),
        cos_lat_rad = Math.cos(lat_rad);
    var vector = new THREE.Vector3(
      radius * cos_lat_rad * Math.cos(lon_rad),
      radius * cos_lat_rad * Math.sin(lon_rad),
      radius * Math.sin(lat_rad)
    );
    var axis = new THREE.Vector3( 1, 0, 0 );
    var angle = - Math.PI / 2;
    vector.applyAxisAngle( axis, angle );
    return vector;
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
var createMercatorProjectionAsPoints = function(points){
    return createMercatorProjection(points, true);
}

var createMercatorProjectionFromVertices = function(vertices){
    var points = [];
    for ( var v = 0; v < vertices.length; v ++ ) {
        var vertex = vertices[v];
        points.push(vertex.x, vertex.y, vertex.z);
    }
    return createMercatorProjection(points);
}

var createMercatorProjection = function(points, asPoints=false){
    // see https://en.wikipedia.org/wiki/Mercator_projection 
    // and https://en.wikipedia.org/wiki/Polar_coordinate_system 
    var vertices_projected = [];
    for (var i = 0; i < points.length; i+=3) {
        var x = points[i];
        var y = points[i+1];
        var z = points[i+2];

        var mercator_x = mercator_x_rad(x);
        var mercator_y = mercator_y_rad(y);

        var mercator_z;
        var horizontal_radius = Math.sqrt(Math.pow(x, 2) + Math.pow(z, 2));
        if (horizontal_radius > 0.0001) {
            mercator_z = z / horizontal_radius;
            mercator_x = mercator_x / horizontal_radius;
        } else {
            mercator_z = 1;
            //console.log(horizontal_radius);
        } 
        if (asPoints) {
            vertices_projected.push( mercator_x, mercator_y, mercator_z );
        } else {
            vertices_projected.push( new THREE.Vector3( mercator_x, mercator_y, mercator_z ) );
        }
    }
    return vertices_projected;
}


var animateRotate = function () {
    
    requestAnimationFrame( shouldAnimate? animateRotate : animateStatic);

    var timer = 0.001 * Date.now();
    pointLight.position.x = Math.sin( timer ) * 4;
    pointLight.position.z = Math.cos( timer ) * 4;


    renderer.render( scene, camera );
};

var animateStatic = function() {

    requestAnimationFrame( shouldAnimate? animateRotate : animateStatic);

    renderer.render( scene, camera );
}

function initGUI() {
    // Set up dat.GUI to control targets
    var params = {
        Mercator: 0,
        WinterSummer: false
    };
    var gui = new dat.GUI();
    var folder = gui.addFolder( 'Projection' );
    folder.add( params, 'Mercator', 0, 1 ).step( 0.01 ).onChange( function ( value ) {
        //shouldAnimate = false;
        sphere.morphTargetInfluences[ 0 ] = value;
        latitudes.morphTargetInfluences[ 0 ] = value;
        land.morphTargetInfluences[ 0 ] = value;
        console.log(positionMarker.position.x)
        positionMarker.position.x = userPosition.x + value * (mercatorPosition.x - userPosition.x);
        positionMarker.position.y = userPosition.y + value * (mercatorPosition.y - userPosition.y);
        positionMarker.position.z = userPosition.z + value * (mercatorPosition.z - userPosition.z);

    } );
    folder.open();
    var folderLight = gui.addFolder( 'Light' );
    folderLight.add( {WinterSummer: 0}, 'WinterSummer', 0, 1 ).step( 0.01 ).onChange( function ( value ) {
        winterSummer = value;
        const earthInclinnationAngle = Math.PI / 3;
        const angleWinterSummer = - earthInclinnationAngle + 2 * winterSummer * earthInclinnationAngle;
        const s = Math.sin( angleWinterSummer / 2 );
        pointLight.position.y = s;
    
    } );
    folderLight.open();
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

createSpace();

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

if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
        function(position){
            console.log(position);
            userPosition = vertex([position.coords.longitude, position.coords.latitude])
            console.log(userPosition)
            mercatorPosition = createMercatorProjectionFromVertices([userPosition])[0];
            console.log(mercatorPosition)
            
            var markerGeometry = new THREE.SphereGeometry( 0.01, 8, 8 );        
            positionMarker = new THREE.Mesh(markerGeometry , new THREE.MeshBasicMaterial( { color: 0xff00ff } ) )
            positionMarker.position.x = userPosition.x;
            positionMarker.position.y = userPosition.y;
            positionMarker.position.z = userPosition.z;
            scene.add(positionMarker);

            camera.position.x = userPosition.x * 2
            camera.position.y = userPosition.y * 2
            camera.position.z = userPosition.z * 2;
            camera.lookAt ( userPosition )
            //interesting also https://stackoverflow.com/questions/14813902/three-js-get-the-direction-in-which-the-camera-is-looking

        }, 
        function(error) { console.log(error.message) });
} else { 
    console.log("the browser doesn't support geolocation");
}


