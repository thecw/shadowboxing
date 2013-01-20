/**
 * Shadowboxing: CS 247 P2
 * -----------------------
 * Questions go to Piazza: https://piazza.com/stanford/winter2013/cs247/home
 * Performs background subtraction on a webcam or kinect driver to identify
 * body outlines. Relies on HTML5: <video> <canvas> and getUserMedia().
 * Feel free to configure the constants below to your liking.
 * 
 * Created by Michael Bernstein 2013
 */

// Student-configurable options below...

// show the after-gaussian blur camera input
SHOW_RAW = false;
// show the final shadow
SHOW_SHADOW = true;
// input option: kinectdepth (kinect depth sensor), kinectrgb (kinect camera), 
// or webcam (computer camera)
var INPUT = "webcam"; 
// A difference of >= SHADOW_THRESHOLD across RGB space from the background
// frame is marked as foreground
var SHADOW_THRESHOLD = 10;
// Between 0 and 1: how much memory we retain of previous frames.
// In other words, how much we let the background adapt over time to more recent frames
var BACKGROUND_ALPHA = 0.05;
// We run a gaussian blur over the input image to reduce random noise 
// in the background subtraction. Change this radius to trade off noise for precision 
var STACK_BLUR_RADIUS = 10; 

//properties of the canvas
var WIDTH = 800;
var HEIGHT = 600;

//length of the square
var SQURE_LENGTH = 100;

//some boundaries
var boundary_y = (HEIGHT - SQURE_LENGTH) / 2;
var boundary_x1 = (WIDTH / 3) - (SQURE_LENGTH / 2);
var boundary_x2 = (WIDTH / 3) * 2 - (SQURE_LENGTH / 2);

/*
 * Begin shadowboxing code
 */
var mediaStream, video, rawCanvas, rawContext, shadowCanvas, squareCanvas, shadowContext, squareContext, background = null;
var arrow1, arrow2, arrow3, arrow4 = null;
var kinect, kinectSocket = null;

var started = false;

//current touched square
//0 means no square touched
var touched = 0;

//the color of the shadow
var color = [0, 0, 0];

//sound initiation
var noteA = new Audio("audio/Agood.mp3");
var noteB = new Audio("audio/Bgood.mp3");
var noteC = new Audio("audio/Cgood.mp3");
var noteD = new Audio("audio/Dgood.mp3");
var noteE = new Audio("audio/Egood.mp3");
var noteF = new Audio("audio/FSharpGood.mp3");
var noteG = new Audio("audio/Egood.mp3");
var noteDhigh = new Audio("audio/Dhighgood.mp3");

$(document).ready(function() {
    initializeDOMElements();

    $("#background").attr('disabled', true);
	if (INPUT == "kinectdepth" || INPUT == "kinectrgb") {
		setUpKinect();
	} else if (INPUT == "webcam") {
		setUpWebCam();
	}

    $('#background').click(function() {
        setBackground();
        if (!started) {
            drawSquares();
            renderShadow();
        }
    });
});

/*
 * Creates the video and canvas elements
 */
function initializeDOMElements() {
    video = document.createElement('video');
    video.setAttribute('autoplay', true);
    video.style.display = 'none';
    
    rawCanvas = document.createElement('canvas');
    rawCanvas.setAttribute('id', 'rawCanvas');
    rawCanvas.setAttribute('width', WIDTH);
    rawCanvas.setAttribute('height', HEIGHT);
    
    rawCanvas.style.display = SHOW_RAW ? 'block' : 'none';
    document.getElementById('capture').appendChild(rawCanvas);
    rawContext = rawCanvas.getContext('2d');
    // mirror horizontally, so it acts like a reflection
    rawContext.translate(rawCanvas.width, 0);
    rawContext.scale(-1,1);    
    
    shadowCanvas = document.createElement('canvas');
    shadowCanvas.setAttribute('id', 'shadowCanvas');
    shadowCanvas.setAttribute('width', WIDTH);
    shadowCanvas.setAttribute('height', HEIGHT);
    shadowCanvas.style.display = SHOW_SHADOW ? 'block' : 'none';
    document.getElementById('capture').appendChild(shadowCanvas);
    shadowContext = shadowCanvas.getContext('2d');    


    //another layer of canvas containing squares
    squareCanvas = document.createElement('canvas');
    squareCanvas.setAttribute('id', 'squareCanvas');
    squareCanvas.setAttribute('width', WIDTH);
    squareCanvas.setAttribute('height', HEIGHT);
    squareCanvas.style.display = SHOW_SHADOW ? 'block' : 'none';
    document.getElementById('capture').appendChild(squareCanvas);
    squareContext = squareCanvas.getContext('2d');  
}

/*
* Draw squares before rendering shadows
*/
function drawSquares(){
    //square 3
    squareContext.beginPath();
    squareContext.rect(0, 0, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#FF6B6B';//
    squareContext.fill();

    //square 1
    squareContext.beginPath();
    squareContext.rect(0, HEIGHT - SQURE_LENGTH, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#4ECDC4';//
    squareContext.fill();

    //square 6
    squareContext.beginPath();
    squareContext.rect(WIDTH - SQURE_LENGTH, 0, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#C7F464';//
    squareContext.fill();

    //square 8
    squareContext.beginPath();
    squareContext.rect(WIDTH - SQURE_LENGTH, HEIGHT - SQURE_LENGTH, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#542437';//
    squareContext.fill();

    //square 2
    squareContext.beginPath();
    squareContext.rect(0, boundary_y, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#F56991';//
    squareContext.fill();

    //square 7
    squareContext.beginPath();
    squareContext.rect(WIDTH - SQURE_LENGTH, boundary_y, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#FF9900';//
    squareContext.fill();

    //square 4
    squareContext.beginPath();
    squareContext.rect(boundary_x1, 0, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#EDC951';//
    squareContext.fill();

    //square 5
    squareContext.beginPath();
    squareContext.rect(boundary_x2, 0, SQURE_LENGTH, SQURE_LENGTH);
    squareContext.fillStyle = '#556270';//
    squareContext.fill();
}

/*
 * Starts the connection to the Kinect
 */
function setUpKinect() {
	kinect.sessionPersist()
		  .modal.make('css/knctModal.css')
		  .notif.make();
		  
	kinect.addEventListener('openedSocket', function() {
		startKinect();
	});
}

/*
 * Starts the socket for depth or RGB messages from KinectSocketServer
 */
function startKinect() {
	if (INPUT != "kinectdepth" && INPUT != "kinectrgb") {
		console.log("Asking for incorrect socket from Kinect.");
		return;
	}
	
	if(kinectSocket)
	{
		kinectSocket.send( "KILL" );
		setTimeout(function() {
			kinectSocket.close();
			kinectSocket.onopen = kinectSocket.onmessage = kinectSocket = null;
		}, 300 );
		return false;
	}
	
	// Web sockets
	if (INPUT == "kinectdepth") {
		kinectSocket = kinect.makeDepth(null, true, null);
	} else if (INPUT == "kinectrgb") {
		kinectSocket = kinect.makeRGB(null, true, null);
	}

	kinectSocket.onopen = function() {
	};
	
	kinectSocket.onclose = kinectSocket.onerror = function() {
		kinectSocket.onclose = kinectSocket.onerror = null;
		return false;
	};

	kinectSocket.onmessage = function( e ) {
		if (e.data.indexOf("data:image/jpeg") == 0) {
			var image = new Image();
			image.src = e.data;
			image.onload = function() {
				rawContext.drawImage(image, 0, 0, 640, 480);
			}
			return false;
		}
	};
}

/*
 * Starts webcam capture
 */
function setUpWebCam() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (!navigator.getUserMedia) { 
        console.log("Browser does not support getUserMedia. Try a latest version of Chrome/Firefox");
    }
    window.URL = window.URL || window.webkitURL;
    
    video.addEventListener('canplay', function() {
        if ($('#background').attr('disabled')) {
            $('#background').attr('disabled', false);
        }
    }, false);
    
    var failVideoStream = function(e) {
      console.log('Failed to get video stream', e);
    };
    
    navigator.getUserMedia({video: true, audio:false}, function(stream) {
        mediaStream = stream;
        
        if (navigator.mozGetUserMedia) {
          video.mozSrcObject = stream;
          video.play();
        } else {
          video.src = window.URL.createObjectURL(stream);
        }        
      }, failVideoStream);
}

/*
 * Gets an array of the screen pixels. The array is 4 * numPixels in length,
 * with [red, green, blue, alpha] for each pixel.
 */
function getCameraData() {
    if (mediaStream || kinect) {
        rawContext.drawImage(video, 0, 0, rawCanvas.width, rawCanvas.height);
        stackBlurCanvasRGB('rawCanvas', 0, 0, rawCanvas.width, rawCanvas.height, STACK_BLUR_RADIUS);        
        var pixelData = rawContext.getImageData(0, 0, rawCanvas.width, rawCanvas.height);
        return pixelData;
    }    
}

/*
 * Remembers the current pixels as the background to subtract.
 */
function setBackground() {
    var pixelData = getCameraData();
    background = pixelData;
}

/*
 * In a loop: gets the current frame of video, thresholds it to the background frames,
 * and outputs the difference as a shadow.
 */
function renderShadow() {
  if (!background) {
    return;
  }
  
  pixelData = getShadowData();
  shadowContext.putImageData(pixelData, 0, 0);
  setTimeout(renderShadow, 0);
}

/*
 * Returns an ImageData object that contains black pixels for the shadow
 * and white pixels for the background
 */

function getShadowData() {
    var pixelData = getCameraData();
    var temp_touched = 0;

    // Each pixel gets four array indices: [r, g, b, alpha]
    for (var i=0; i<pixelData.data.length; i=i+4) {
        var rCurrent = pixelData.data[i];
        var gCurrent = pixelData.data[i+1];
        var bCurrent = pixelData.data[i+2];
        
        var rBackground = background.data[i];
        var gBackground = background.data[i+1];
        var bBackground = background.data[i+2];
        		
        var distance = pixelDistance(rCurrent, gCurrent, bCurrent, rBackground, gBackground, bBackground);        
        
        if (distance >= SHADOW_THRESHOLD) {
            // foreground, show shadow
            pixelData.data[i] = color[0];
            pixelData.data[i+1] = color[1];
            pixelData.data[i+2] = color[2];

            if(temp_touched == 0){
                temp_touched = checkTouched(i);
            }
        } else {
            // background
            
            //  update model of background, since we think this is in the background
            updateBackground(i, rCurrent, gCurrent, bCurrent, rBackground, gBackground, bBackground);
            
            // now set the background color
            pixelData.data[i] = 255;
            pixelData.data[i+1] = 255;
            pixelData.data[i+2] = 255;
            pixelData.data[i+3] = 0;
        }        
    }

    if(temp_touched != touched){
        $("#touch_display").text("Touching square "+temp_touched);
        touched = temp_touched;

        switch(temp_touched){
            case 1: noteD.play(); $('#note').text("note D!"); break;
            case 2: noteE.play(); $('#note').text("note E!"); break;
            case 3: noteF.play(); $('#note').text("note F!"); break;
            case 4: noteG.play(); $('#note').text("note G!"); break;
            case 5: noteA.play(); $('#note').text("note A!"); break;
            case 6: noteB.play(); $('#note').text("note B!"); break;
            case 7: noteC.play(); $('#note').text("note C!"); break;
            case 8: noteDhigh.play(); $('#note').text("note D High!"); break;
            default: break;
        }
    }
    
    return pixelData; 
}

function checkTouched(i){
    var x = (i/4)%800;
    var y = (i/4)/800;
    var broundary

    if(x > SQURE_LENGTH && x < WIDTH - SQURE_LENGTH){
        if(y > SQURE_LENGTH){
            return 0;
        }

        else if(x > boundary_x1 && x < (boundary_x1 + SQURE_LENGTH)){
            return 4;
        }

        else if(x > boundary_x2 && x < (boundary_x2 + SQURE_LENGTH)){
            return 5;
        }
    }

    else if(x < SQURE_LENGTH){
        if(y < SQURE_LENGTH){
            return 3;
        }

        else if(y > boundary_y && y < (boundary_y + SQURE_LENGTH)){
            return 2;
        }

        else if(y > (HEIGHT - SQURE_LENGTH)){
            return 1;
        }

    }

    else if(x > WIDTH - SQURE_LENGTH){
        if(y < SQURE_LENGTH){
            return 6;
        }

        else if(y > boundary_y && y < (boundary_y + SQURE_LENGTH)){
            return 7;
        }

        else if(y > (HEIGHT - SQURE_LENGTH)){
            return 8;
        }
    }

    return 0;
}

function updateBackground(i, rCurrent, gCurrent, bCurrent, rBackground, gBackground, bBackground) {
    background.data[i] = Math.round(BACKGROUND_ALPHA * rCurrent + (1-BACKGROUND_ALPHA) * rBackground);
    background.data[i+1] = Math.round(BACKGROUND_ALPHA * gCurrent + (1-BACKGROUND_ALPHA) * gBackground);
    background.data[i+2] = Math.round(BACKGROUND_ALPHA * bCurrent + (1-BACKGROUND_ALPHA) * bBackground);
}

/*
 * Returns the distance between two pixels in grayscale space
 */
function pixelDistance(r1, g1, b1, r2, g2, b2) {
    return Math.abs((r1+g1+b1)/3 - (r2+g2+b2)/3);
}