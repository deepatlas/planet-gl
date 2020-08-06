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
import glow from './images/glow.png'

var shouldAnimate = false;
const radius = 1 // TODO: changing this doesn't look that well 
const longitude_0 = 0 //Greenwich // TODO: changing this doesn't work correctly

var camera, scene, sunLight, renderer, sphere, atmosphere, latitudes, land, earthObjects, earthGroup
var userLatitude, userLongitude, positionMarker, userPosition, mercatorPosition;
var compass, deviceOrientation_beta_y, deviceOrientation_gamma_x, deviceOrientation_alpha_z;
var winterSummer = 0;

var createSphere = function(){

    var geometry = new THREE.SphereGeometry(radius-0.001, 32, 32);

    var material = new THREE.MeshPhongMaterial( { color: 0xdddddd, morphTargets: true } );

    // see http://planetpixelemporium.com/planets.html and https://github.com/jeromeetienne/threex.planets/ 
    // for earth & planet textures
    material.map    = THREE.ImageUtils.loadTexture(earthmap)
    material.bumpMap    = THREE.ImageUtils.loadTexture(earthbump)
    material.bumpScale = 0.05

    var mercatorProjection = createMercatorProjectionFromVertices(geometry.vertices);
    geometry.morphTargets.push( { name: "mercator projection", vertices: mercatorProjection } );
    geometry = new THREE.BufferGeometry().fromGeometry( geometry ); //the final trick

    return new THREE.Mesh( geometry, material );
}

/**
var createAtmosphere = function(){
    var geometry = new THREE.SphereGeometry(radius + 0.05, 32, 32);
    var material = new THREE.MeshPhongMaterial ({ color: 0x98e0fa, opacity: 0.3, transparent: true });
    var mesh = new THREE.Mesh (geometry, material);
    return mesh;
}
 */

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

    earthObjects.add(land);

    return land;
}

var createSpace = function(){
    //var geometry = new THREE.SphereGeometry(100, 32, 32);
    const boxSize = 1000;
    var geometry = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const spaceTexture = new THREE.TextureLoader().load(space);
    var material = new THREE.MeshBasicMaterial({map : spaceTexture, side: THREE.BackSide});

    var spaceMesh = new THREE.Mesh( geometry, material );

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

var earthDirection = function(vector) {
    var axis = new THREE.Vector3( 1, 0, 0 );
    var angle = - Math.PI / 2;
    vector.applyAxisAngle( axis, angle );
    return vector;
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
    return earthDirection(vector);
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
    //same result would be be
    //radius * Math.atanh(Math.sin(latitude_rad))    
}

var inverse_mercator_y = function(y) {
    //also called Gudermann function
    return 2*(Math.atan(Math.exp(y/radius))-Math.PI/4)
    //same result would be be
    //Math.asin(Math.tanh(y/radius))    
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

    //var timer = 0.001 * Date.now();
    //pointLight.position.x = Math.sin( timer ) * 4;
    //pointLight.position.z = Math.cos( timer ) * 4;
    earthGroup.rotation.y += 0.001;


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
        compass.position.copy(positionMarker.position)

    } );
    folder.open();
    var folderLight = gui.addFolder( 'Light' );
    folderLight.add( {WinterSummer: 0}, 'WinterSummer', 0, 1 ).step( 0.01 ).onChange( function ( value ) {
        winterSummer = value;
        const earthInclinnationAngle = Math.PI / 3;
        const angleWinterSummer = - earthInclinnationAngle + 2 * winterSummer * earthInclinnationAngle;
        const s = Math.sin( angleWinterSummer / 2 );
        sunLight.position.y = s;
    
    } );
    folderLight.open();
}


camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;

scene = new THREE.Scene();

// ### EARTH
earthObjects = new THREE.Object3D();

sphere = createSphere();
sphere.renderOrder = -1;
earthObjects.add( sphere );

//atmosphere = createAtmosphere();
//earthObjects.add( atmosphere );

latitudes = createLatitudes();
earthObjects.add(latitudes);

var spaceMesh = createSpace();
earthObjects.add(spaceMesh);

//async
createLand();

earthGroup = new THREE.Group();
earthGroup.add( earthObjects );
scene.add( earthGroup );

// ### LIGHTS
scene.add( new THREE.AmbientLight( 0x8FBCD4, 0.2 ) );

var sunColor = 0xffcf4a
sunLight = new THREE.PointLight( sunColor, 1.5 );
sunLight.position.x = 8;
sunLight.position.y = 8;
scene.add( sunLight );

//add sun sphere

var sun = new THREE.Mesh( new THREE.SphereBufferGeometry( 0.1, 8, 8 ), new THREE.MeshPhongMaterial( { color: sunColor } ) )
// SUPER SIMPLE GLOW EFFECT, see http://stemkoski.github.io/Three.js/Simple-Glow.html
// use sprite because it appears the same from all angles
var spriteMaterial = new THREE.SpriteMaterial( 
    { 
        map: new THREE.ImageUtils.loadTexture( glow ), 
        color: sunColor, transparent: false, blending: THREE.AdditiveBlending
    });
var sprite = new THREE.Sprite( spriteMaterial );
sprite.scale.set(3, 3, 3);
sun.add(sprite); // this centers the glow at the mesh

sunLight.add( sprite );
    
// ### GUI
initGUI()

// ### RENDERER
renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
shouldAnimate ? animateRotate() : animateStatic();
document.body.appendChild( renderer.domElement );

new OrbitControls( camera, renderer.domElement );

// ### GEOLOCATION
if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
        function(position){
            console.log(position);
            userLatitude = position.coords.latitude;
            userLongitude = position.coords.longitude;
            userPosition = vertex([position.coords.longitude, position.coords.latitude])
            console.log(userPosition)
            mercatorPosition = createMercatorProjectionFromVertices([userPosition])[0];
            console.log(mercatorPosition)
            
            var markerGeometry = new THREE.SphereGeometry( 0.01, 8, 8 );        
            positionMarker = new THREE.Mesh(markerGeometry , new THREE.MeshBasicMaterial( { color: 0xff00ff } ) )
            positionMarker.position.x = userPosition.x;
            positionMarker.position.y = userPosition.y;
            positionMarker.position.z = userPosition.z;
            earthObjects.add(positionMarker);

            camera.position.x = userPosition.x * 2
            camera.position.y = userPosition.y * 2
            camera.position.z = userPosition.z * 2;
            camera.lookAt ( userPosition )
            //interesting also https://stackoverflow.com/questions/14813902/three-js-get-the-direction-in-which-the-camera-is-looking


            createCompass()

        }, 
        function(error) { console.log(error.message) });
} else { 
    console.log("the browser doesn't support geolocation");
}

var createCompass = function(){
    var compassDirection = new THREE.Vector3( 1, 1, 1 );

    //normalize the direction vector (convert to vector of length 1)
    compassDirection.normalize();

    var origin = new THREE.Vector3( userPosition.x, userPosition.y, userPosition.z );
    //var origin = new THREE.Vector3( 0, 0, 0 );
    var length = 1;
    var hex = 0xffff00;

    compass = new THREE.ArrowHelper( compassDirection, origin, length, hex );
    //hide first
    compass.setLength(0, 0, 0)
    scene.add( compass );
}

// ### DEVICE ORIENTATION
if (window.DeviceOrientationEvent) {
		
    window.addEventListener("deviceorientation", function(event) 
    {
        deviceOrientation_beta_y = radians(event.beta);
        deviceOrientation_gamma_x = radians(event.gamma);
        deviceOrientation_alpha_z = radians(event.alpha);

        // ### Compass

        //compute new latitude/longitude from userPosition and orientation and distance
        // see also https://www.movable-type.co.uk/scripts/latlong.html
        var R = 6378.1 // Radius of the Earth in kilometer
        var distance = 15 //in kilometer
        var lat1 = radians(userLatitude)
        var lon1 = radians(userLongitude)
        var bearing = deviceOrientation_alpha_z
        //console.log("lat: " + lat1 + ",lon: " + lon1 + "bearing: " + bearing)
        var lat2 = Math.asin( Math.sin(lat1) * Math.cos(distance/R) + Math.cos(lat1) * Math.sin(distance/R) * Math.cos(bearing))
        var lon2 = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(distance/R) * Math.cos(lon1), Math.cos(distance/R) - Math.sin(lon1)*Math.sin(lat2))
        //console.log(lat2 + "," + lon2)
        var compassHead = vertex([degree(lon2), degree(lat2)])
        var compassDirection = compassHead.clone().sub(userPosition)
        //console.log(compassDirection)
 

        //normalize the direction vector (convert to vector of length 1)
        compassDirection.normalize();
    
        compass.setDirection(compassDirection)
        compass.setLength(0.12, 0.1, 0.05)
        
    }, true);
    
    
    
} else {
  console.log("Sorry, your browser doesn't support Device Orientation");
} 

