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
var WIDTH = 1000;
var HEIGHT = 600;

//length of the square
var SQURE_LENGTH = 120;

//some boundaries
var boundary_y = (HEIGHT - SQURE_LENGTH) / 2;
var boundary_x1 = (WIDTH / 3) - (SQURE_LENGTH / 2);
var boundary_x2 = (WIDTH / 3) * 2 - (SQURE_LENGTH / 2);

//background image
var bg_image = null;
var BG_IMAGE_PATH = "media/bg_shadowtunes.jpg";

//circle images
var circles_src = ["media/circle1.png", "media/circle2.png", "media/circle3.png", "media/circle4.png", "media/circle5.png", "media/circle6.png", "media/circle7.png", "media/circle8.png"];
var circles = [];

//pattern image
var pattern_image = null;
var PATTERN_PATH = "media/dots1.png";
var patten_colors = [[240, 9, 0], [240, 111, 20], [250, 241, 50], [122, 232, 85], [45, 226, 155], [48, 120, 230], [82, 82, 228], [175, 32, 212]];

var OVERLAY  = 0;   // 0 = foreground, 255 = background
var imageReady = false;

/*
 * Begin shadowboxing code
 */
var mediaStream, video, rawCanvas, rawContext, shadowCanvas, squareCanvas, backgroundCanvas, patternCanvas, shadowContext, squareContext, backgroundContext, patternContext, background = null;
var arrow1, arrow2, arrow3, arrow4 = null;
var kinect, kinectSocket = null;

var started = false;

//current touched square
//0 means no square touched
var touched = 0;
var current_sound = null;

//the color of the shadow
var color = [48, 120, 230];

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

    $("#start").attr('disabled', true);
	if (INPUT == "kinectdepth" || INPUT == "kinectrgb") {
		setUpKinect();
	} else if (INPUT == "webcam") {
		setUpWebCam();
	}

    pattern_image.onload = function() {
        imageReady = true;
    }

    $('#start').click(function() {
        setBackground();
        if (!started) {
            $('#start_screen').hide();
            $('#sidebar').show();
            drawBackground();
            drawSquares();
            renderShadow();
        }
    });

    $('#restart').click(function(){
        setBackground();
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

    backgroundCanvas = document.createElement('canvas');
    backgroundCanvas.setAttribute('id', 'backgroundCanvas');
    backgroundCanvas.setAttribute('width', WIDTH);
    backgroundCanvas.setAttribute('height', HEIGHT);
    backgroundCanvas.style.display = 'block';
    document.getElementById('capture').appendChild(backgroundCanvas);
    backgroundContext = backgroundCanvas.getContext('2d');  

    patternCanvas = document.createElement('canvas');
    patternCanvas.setAttribute('id', 'patternCanvas');
    patternCanvas.setAttribute('width', WIDTH);
    patternCanvas.setAttribute('height', HEIGHT);
    patternCanvas.style.display = 'none';
    document.getElementById('capture').appendChild(patternCanvas);
    patternContext = patternCanvas.getContext('2d');  

    bg_image = new Image();
    bg_image.src = BG_IMAGE_PATH;

    var circle = null;
    
    for(var i = 0; i < 8; i++){
        circle = new Image();
        circle.src = circles_src[i];
        circles.push(circle);
    }

    pattern_image = new Image();
    pattern_image.src = PATTERN_PATH;

    //another layer of canvas containing squares
    squareCanvas = document.createElement('canvas');
    squareCanvas.setAttribute('id', 'squareCanvas');
    squareCanvas.setAttribute('width', WIDTH);
    squareCanvas.setAttribute('height', HEIGHT);
    squareCanvas.style.display = 'block';
    document.getElementById('capture').appendChild(squareCanvas);
    squareContext = squareCanvas.getContext('2d');  

    noteA.load();
    noteB.load();
    noteC.load();
    noteD.load();
    noteE.load();
    noteF.load();
    noteG.load();
    noteDhigh.load();
}

/*
* Draw background before rendering shadows
*/
function drawBackground(){
    backgroundContext.drawImage(bg_image, 0, 0);
}

/*
* Draw squares before rendering shadows
*/
function drawSquares(){
    //square 3
    squareContext.drawImage(circles[2], 0, 0, SQURE_LENGTH, SQURE_LENGTH);

    //square 1
    squareContext.drawImage(circles[0], 0, HEIGHT - SQURE_LENGTH, SQURE_LENGTH, SQURE_LENGTH);

    //square 6
    squareContext.drawImage(circles[5], WIDTH - SQURE_LENGTH, 0, SQURE_LENGTH, SQURE_LENGTH);
    
    //square 8
    squareContext.drawImage(circles[7], WIDTH - SQURE_LENGTH, HEIGHT - SQURE_LENGTH, SQURE_LENGTH, SQURE_LENGTH);
    
    //square 2
    squareContext.drawImage(circles[1], 0, boundary_y, SQURE_LENGTH, SQURE_LENGTH);

    //square 7
    squareContext.drawImage(circles[6], WIDTH - SQURE_LENGTH, boundary_y, SQURE_LENGTH, SQURE_LENGTH);

    //square 4
    squareContext.drawImage(circles[3], boundary_x1, 0, SQURE_LENGTH, SQURE_LENGTH);

    //square 5
    squareContext.drawImage(circles[4], boundary_x2, 0, SQURE_LENGTH, SQURE_LENGTH);
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
        if ($('#start').attr('disabled')) {
            $('#start').attr('disabled', false);
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

  // Drawing from our image onto the canvas
  if (imageReady) {
      // draw the image over the entire canvas
      patternContext.drawImage(pattern_image, 0, 0);    
      var pixels = patternContext.getImageData(0, 0, patternCanvas.width, patternCanvas.height);

      // Now that the shadowContext has our jpeg painted, we can
      // loop pixel by pixel and only show the parts where the shadow lies.
      // 
      // IMPORTANT: make sure that the width and height of your two
      // canvases match. Otherwise, here be dragons!
      for(var i = 0; i < pixelData.data.length; i=i+4) {
          // i = red; i+1 = green; i+2 = blue; i+3 = alpha
          if(pixelData.data[i] == OVERLAY && pixelData.data[i+1] == OVERLAY && pixelData.data[i+2] == OVERLAY) {
              // If the current shadow pixel is to be overlayed, copy it over to
              // our canvas' pixel data

              if(pixels.data[i] > 200){
                    if(touched > 0){
                        pixelData.data[i] = patten_colors[touched - 1][0];
                        pixelData.data[i+1] = patten_colors[touched - 1][1];
                        pixelData.data[i+2] = patten_colors[touched - 1][2];
                    }
                    else{
                        pixelData.data[i] = patten_colors[0][0];
                        pixelData.data[i+1] = patten_colors[0][1];
                        pixelData.data[i+2] = patten_colors[0][2];
                    }
              }
          }
      }

      // And now, paint our pixels array back to the canvas.
      shadowContext.putImageData(pixelData, 0, 0);
  }

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
            pixelData.data[i] = 0;
            pixelData.data[i+1] = 0;
            pixelData.data[i+2] = 0;

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
        touched = temp_touched;
        //$('#touch_debug').text("Touched "+touched+"!");
        if(current_sound!=null){
            current_sound.pause();
        }
        
        switch(temp_touched){
            case 1: current_sound = noteD; console.log("note D!"); break;
            case 2: current_sound = noteE; console.log("note E!"); break;
            case 3: current_sound = noteF; console.log("note F!"); break;
            case 4: current_sound = noteG; console.log("note G!"); break;
            case 5: current_sound = noteA; console.log("note A!"); break;
            case 6: current_sound = noteB; console.log("note B!"); break;
            case 7: current_sound = noteC; console.log("note C!"); break;
            case 8: current_sound = noteDhigh; console.log("note D High!"); break;
            default: break;
        }

        if(current_sound!=null){
            current_sound.play();
        }
        
    }
    
    return pixelData; 
}

function checkTouched(i){
    var x = (i/4)%WIDTH;
    var y = (i/4)/WIDTH;
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