/*
Barbara Csarman and Fabian Ehrentraud 2011
*/

//for fire effect
var textBrightness = 50;
var fireCount = 6;
var fireDelta = new Array();
var fire_scale = 0.8;
var step = 0;

/*
animates a text-fire-effect for all elements with attribute data-fire="onfire"
thanks to http://maettig.com/code/css/text-shadow.html
*/
function animate_fire() {
	fireDelta[fireCount - step] = Math.random() * 2 - 1;
	
	var s = "";
	for (var i = 0; i < fireCount; i++) {
		if (s) s += ", ";
		s += Math.round(fireDelta[(i + fireCount - step) % fireCount] * i * fire_scale) + "px " + (-2 * i -1) * fire_scale + "px " + (2 + i) * fire_scale + "px ";
		s += "rgb(255, " + (255 - i * Math.floor(255 / (fireCount - 1))) + ", 0)";
	}
	
	var elements = document.querySelectorAll('*[data-fire~="onfire"]');
	for(var i = 0; i < elements.length; i++) {
		elements[i].style.textShadow = s;
	}
	
	step = (step + 1) % fireCount;
}

/*
initializes the animation for a text-fire-effect for all elements with attribute data-fire="onfire"
*/
function init_fire() {	
	for (var i = 0; i < fireCount; i++) {
		fireDelta[i] = Math.random() * 2 - 1;
	}
	
	window.setInterval(animate_fire, 100);
}
