// Barbara Csarman and Fabian Ehrentraud, 2011

//TODO
// make the graph data an object
// use JSON intead of XML: http://www.json.org/


/*****************************************************************************************************************************/
/*** GLOBAL INIT - called when page is reloaded or loaded first time, initializes StreamGraph object
/*****************************************************************************************************************************/


var myStreamGraph;


// initializations when window/body has been loaded
window.addEventListener("load", inits, false);


function inits(){
	myStreamGraph = new StreamGraph();
	(document.forms["controls"]||{}).reset();
	init_fire();
	init_controls(myStreamGraph);
	myStreamGraph.init_streamgraph('', true, document.getElementById("streamgraph"), document.getElementById("color"), document.getElementById('info'));
}


// initializes control elements
// not done in html code to separate code and content even more
function init_controls(oStreamGraph) {	
	var random_handler = function(e){oStreamGraph.loadGraph('', document.getElementById('info'), true);}
	var buttons = document.getElementsByName("b_loaddata_random");
	for(var i = buttons.length; i--; ) {
		buttons[i].addEventListener("click", random_handler, false);
	}
	
	var xml_handler = function(e){oStreamGraph.loadGraph(e.target.value, document.getElementById('info'), false);}
	var buttons = document.getElementsByName("b_loaddata_xml");
	for(var i = buttons.length; i--; ) {
		buttons[i].addEventListener("click", xml_handler, false);
	}
	
	var linesmooth = document.getElementById("r_linesmooth");
	if (linesmooth) linesmooth.addEventListener("change", oStreamGraph.smoothingPicker, false);

	var radios = document.getElementsByName("c_baseline");
	for(var i = radios.length; i--; ) {
		radios[i].addEventListener("click", oStreamGraph.baselinePicker, false);
	}
	
	var radios = document.getElementsByName("c_order");
	for(var i = radios.length; i--; ) {
		radios[i].addEventListener("click", oStreamGraph.orderPicker, false);
	}
	
	var radios = document.getElementsByName("c_colormode");
	for(var i = radios.length; i--; ) {
		radios[i].addEventListener("click", oStreamGraph.colorPicker, false);
	}

	var hue_handler = function(e){oStreamGraph.changeHue(e.target.value,false);}
	var hue = document.getElementById("r_hue");
	if (hue) hue.addEventListener("change", hue_handler, false);

	var huebonus_handler = function(e){oStreamGraph.changeHue(e.target.value,true);}
	var bhue = document.getElementById("r_bhue");
	if (bhue) bhue.addEventListener("change", huebonus_handler, false);

	var candy_handler = function(e){oStreamGraph.changeCandy(e.target.value);}
	var candy = document.getElementById("r_candy");
	if (candy) candy.addEventListener("change", candy_handler, false);
}





/*****************************************************************************************************************************/
/*** StreamGraph Object
/*****************************************************************************************************************************/


function StreamGraph() { // StreamGraph constructor

/*****************************************************************************************************************************/
/*** GLOBAL DECLARATIONS
/*****************************************************************************************************************************/

var streamgraph_canvas, col_canvas, streamgraph_context, col_context;
var datasets_orig, dataset_titles_orig, datasets, dataset_titles, stacked, stacked01;
var mousex = -1, mousey = -1, mousexhover = -1; //mousexhover => x_index where the mouse currently hovers, -1 if none
var mouseunzoomedgraphx, mouseunzoomedgraphy, mousegraphx, mousegraphy;
var framerate = 25;
var gscalex = 0.85, gscaley = 0.75, gmovex = 0, gmovey = -0.05; //global graph positioning within canvas
var scale = 1; //for zooming
var originx = originy = 0; //relative to canvas size (not shrunk graph size)
var interactive = true;
var redrawFrame = false; // for only redrawing when mouse or data has changed
var graph_title, graph_x_axis, graph_y_axis, x_labels, datasetCount;
var layerhue = 75; //green in the beginning
var candyCrazinessFactor = 0;
var numCurves = 200, lengthCurves = 20; //for generating random data
var colorModeEnum = {HUE:0,HUEBONUS:1,RANDOM:2,PICTURE:3}, colorMode = colorModeEnum.HUE;
var layerColors; //for each layer, one array with colors is included, the first is the normal layer color, the second the highlight color
var orderModeEnum = {NONE:0,OUTSIDEUP:1,OUTSIDEDOWN:2,OUTSIDESUM:3}, orderMode = orderModeEnum.OUTSIDESUM;
var baselineCalculationEnum = {STACKED:0,MIDDLE:1,WIGGLE:2,WEIGHTEDWIGGLE:3}, baselineCalculation = baselineCalculationEnum.WIGGLE;
var smoothing = 0.35;

//var graph_data = new Object; //in future versions


/*****************************************************************************************************************************/
/*** INIT - called when page is reloaded or loaded first time, initializes all important values, calls drawing first time
/*****************************************************************************************************************************/

// randomdata=true: url is being ignored	
this.init_streamgraph = function(url, randomdata, sg_canvas, c_canvas, statusElement) {
	
	streamgraph_canvas = sg_canvas;
	col_canvas = c_canvas;
	
	if(col_canvas && col_canvas.getContext){ //image
		col_context = col_canvas.getContext('2d');
		var img = new Image(); // show image for colourizing streamgraph
		img.onload = function(){
			col_context.drawImage(img,0,0,col_canvas.width,col_canvas.height); //image width and height
		};
		img.src = 'colour.jpg';
	}

	if (streamgraph_canvas && streamgraph_canvas.getContext){
		streamgraph_context = streamgraph_canvas.getContext('2d');

		this.loadGraph(url, statusElement, randomdata);

		if(interactive) {
			setInterval(draw_streamgraph, 1000/framerate); //call draw function periodically with framerate
			streamgraph_canvas.addEventListener("mousemove", mouseMoved, false);
			streamgraph_canvas.addEventListener("mouseout", mouseLeft, false);
			//workaround for Firefox
			var mousescrollEvent = (navigator.userAgent.indexOf('Firefox') !=-1) ? "DOMMouseScroll" : "mousewheel";
			streamgraph_canvas.addEventListener(mousescrollEvent, mouseWheel, false);
		}
	} else { alert("Your browser does not support the canvas element."); } //browser does not support canvas
}

// loads a new graph
// when randomdata is false, load from given url
this.loadGraph = function(xmlurl, statusElement, randomdata){
	if(randomdata){
		if (statusElement) statusElement.innerHTML = "<p data-fire='onfire'>Datasource: random data</p>";
		datasets = makeRandomData(numCurves, lengthCurves);
	}else{
		if (statusElement) statusElement.innerHTML = "<p data-fire='onfire'>Datasource: " + xmlurl + "</p>";
		datasets = getDatapoints(xmlurl);
	}

	dataset_titles_orig = dataset_titles.concat(); //keep original dataset titles
	datasets_orig = datasets.concat(); //and original dataset

	//reset zoom state
	scale = 1;
	originx = originy = 0;

	if (statusElement) statusElement.innerHTML = "<p data-fire='onfire'>Data loaded, calculating Streamgraph...</p>";

	recalculate();

	if (statusElement) statusElement.innerHTML = "<p data-fire='onfire'>Drawing Streamgraph...</p>";

	draw_streamgraph(); //first call before periodicity kicks in

	if(randomdata){
		if (statusElement) statusElement.innerHTML = "<p>We present to you: Streamgraph with data from random source</p>";
	}else{
		if (statusElement) statusElement.innerHTML = "<p>We present to you: Streamgraph with data from <a href='" + xmlurl + "'>" + xmlurl + "</a></p>";
	}
	var streamgraph_caption = document.getElementById("streamgraph_caption");
	if (streamgraph_caption) streamgraph_caption.innerHTML = graph_title + " - " + datasetCount + " datasets";
	var streamgraph_container = document.getElementById("streamgraph_container");
	if (streamgraph_container) streamgraph_container.setAttribute("class","hidden_show"); //only for first call as it's not hidden anymore
	//TODO do that with a callback
};

// recalculates ordering, baseline and stacked layers according to set global values
function recalculate(){
	dataset_titles = dataset_titles_orig.concat(); //always start calculating from the original data, this will prevent a different reordering with every recalculation
	datasets = datasets_orig.concat();

	var allCurves = datasets.concat(); //copy datasets array and don't touch the original anymore
	var orderedCurves = orderLayers(allCurves); //order curves according to selected order strategy
	var baselineCurves = determineLayout(orderedCurves); //calculates baseline for selected layout

	stacked = stackCurves(baselineCurves); //calculates values for drawing, stacks curves on top of each other
	stacked01 = scaleCurves(stacked); // vertical range [0,1] for curve stack

	calcLayerColors(stacked01);

	redrawFrame = true;
}


/*****************************************************************************************************************************/
/*** MAKE / GET (XML) RAW DATA SOURCE
/*****************************************************************************************************************************/

// gets datapoints
// equal x-spacing is assumed
// reads data from given xml file
function getDatapoints(xmlurl) {
	var xhttp;
	if (window.XMLHttpRequest) { xhttp = new XMLHttpRequest(); }
	else { alert("Your browser does not support XMLHttpRequest()."); }

	xhttp.open("GET", xmlurl, false); //must be located on the same server!
	xhttp.send();
	var xmlDoc = xhttp.responseXML;
	var datasets = xmlDoc.documentElement.childNodes; //datasets is array with dataset nodes
	//var datasets = xmlDoc.getElementsByTagName('dataset'); //datasets is array with dataset nodes
	var datapointsArray = new Array();

	x_labels = new Array();
	var firstDataset = true;
	datasetCount = 0;
	dataset_titles = new Array();

	for(var i = 0; i < datasets.length; i++) {
		if(datasets[i].nodeType == 1) { //Process only element nodes (type 1) - whitespaces and breaks are counted as text nodes!!
			if(datasets[i].nodeName == "title") { graph_title = trimWhitespaces(datasets[i].childNodes[0].nodeValue); }
			else if(datasets[i].nodeName == "x_axis") { graph_x_axis = trimWhitespaces(datasets[i].childNodes[0].nodeValue); }
			else if(datasets[i].nodeName == "y_axis") { graph_y_axis = trimWhitespaces(datasets[i].childNodes[0].nodeValue); }
			else if(datasets[i].nodeName == "dataset") {
				var curve = new Array();
				var dataset_nodes = datasets[i].childNodes;

				for(var j = 0; j < dataset_nodes.length; j++) {
					if(dataset_nodes[j].nodeType == 1) { //Process only element nodes (type 1) - whitespaces and breaks are counted as text nodes!!
						if(dataset_nodes[j].nodeName == "title") { dataset_titles.push(trimWhitespaces(dataset_nodes[j].childNodes[0].nodeValue)); }
						else if(dataset_nodes[j].nodeName == "point") {
							var points = dataset_nodes[j].childNodes;
							for(var k = 0; k < points.length; k++) {
								if(points[k].nodeType == 1) { //Process only element nodes (type 1) - whitespaces and breaks are counted as text nodes!!
									if(points[k].nodeName == "x_value") { //only use x_values from first dataset; same equally spaced x_values
										if(firstDataset) { x_labels.push(points[k].childNodes[0].nodeValue); }
									}
									else if(points[k].nodeName == "y_value") { curve.push(parseFloat(points[k].childNodes[0].nodeValue)); }
								}
							}
						}
					}
				}
				datapointsArray.push(curve);
				datasetCount++;
				firstDataset = false;
			}
		}
	}
	return datapointsArray;
}

// removes whitespace on the beginning and end of the given string
function trimWhitespaces(string) { return string.replace(/^\s+/,'').replace(/\s+$/,''); }


/*********************************** Lee Byron's test data generator**********************************************/

function randomString(length) {
	var chars = 'abcdefghiklmnopqrstuvwxyz'.split('');
	var str = '';
	if (!length) { length = Math.floor(Math.random() * chars.length); }
	for (var i = 0; i < length; i++) { str += chars[Math.floor(Math.random() * chars.length)]; }
	return str;
}

function makeRandomData(numLayers, arrLength) {
	graph_title = 'Streamgraph generated with random data';
	graph_x_axis = 'x-axis';
	graph_y_axis = 'random value';

	var datapointsArray = new Array();
	x_labels = new Array();
	datasetCount = numLayers;
	dataset_titles = new Array();

	for(var i=0; i<arrLength; i++) { var label = 'x'+i; x_labels.push(label); }

	for (var i=0; i<numLayers; i++) {
		dataset_titles.push("Layer #" + i);
		var onset = parseInt(Math.random()*arrLength*0.5);
		var duration = parseInt(Math.random()*(arrLength));
		datapointsArray[i] = makeRandomArray(arrLength, onset, duration);
	}
	return datapointsArray;
}

function makeRandomArray(n, o, d) {
	var randomArray = new Array(n);
	for(var i=0; i<n ; i++) { randomArray[i] = 0; }
	for (var i=0; i<3; i++) { randomArray = addRandomBump(randomArray, o, d); } //3 is a good number to add bumps to a graph
	return randomArray;
}

// adds random bumps to the streamgraph ... actually this creates the y values and than adds random bumps three times
function addRandomBump(x, o, d) {
	var height = 1 / Math.random();
	var start = Math.max(0, o);
	var end = Math.min(x.length, (o+d));
	for (var i=start; i<x.length && i<(o+d); i++) {
		var a = parseFloat(((i-o)/d)*Math.exp(-10*((i-o)/d)));
		if(!x[i]) {x[i] = height * a; }
		else { x[i] = x[i] + (height * a); }

		x[i]=Math.round(x[i]*Math.pow(10,2))/Math.pow(10,2);
		x[i]*=10;
	}
	return x;
}


/*****************************************************************************************************************************/
/*** ORDERING
/*****************************************************************************************************************************/

// called when radiobutton on front end is selected
this.orderPicker = function(e) {
	switch (e.target.value) {
	case 'outsidesum':
		orderMode = orderModeEnum.OUTSIDESUM;
		break;
	case 'outsideup':
		orderMode = orderModeEnum.OUTSIDEUP;
		break;
	case 'outsidedown':
		orderMode = orderModeEnum.OUTSIDEDOWN;
		break;
	case 'none':
		orderMode = orderModeEnum.NONE;
		break;
	default:
		orderMode = orderModeEnum.NONE;
	}

	recalculate();
};

function orderLayers(layers){ //order layers by globally selected method
	switch (orderMode) {
	case orderModeEnum.NONE:
		return layers.concat(); //don't order but return just a copy
		break;
	case orderModeEnum.OUTSIDESUM:
		return orderToOutside(layers);
		break;
	case orderModeEnum.OUTSIDEUP:
		return orderOnset(layers,true);
		break;
	case orderModeEnum.OUTSIDEDOWN:
		return orderOnset(layers,false);
		break;
	default:
		return layers.concat();
	}

}

// SORT BY ONSET TIME
function sortByOnsetTime(layers) { //quicksort
	if(layers.length <= 1) { return layers; }

	var smallerList = new Array();
	var biggerList = new Array();
	var onsetPivot = onsetCurrent = -1;
	var pivot = Math.floor((layers.length-1)/2);
	var pivotArray = layers[pivot];
	layers.splice(pivot,1); //remove pivot from array

	for (var i=0; i<(pivotArray.length-2); i++) { if((pivotArray[i] > 0) && (onsetPivot == -1)) onsetPivot = i; }

	for (var i=0; i<layers.length; i++) {
		onsetCurrent = -1;
		for (var j=0; j<(layers[i].length-2); j++) { if((layers[i][j] > 0) && (onsetCurrent == -1)) onsetCurrent = j; }
		(onsetCurrent <= onsetPivot) ? smallerList.push(layers[i]) : biggerList.push(layers[i]);
	}
	return sortByOnsetTime(smallerList).concat([pivotArray], sortByOnsetTime(biggerList)); //recursive call for subarrays
}

/******************************************* ORDER TO OUTSIDE ********************************************************/

// orders layers in a way that onsetting layers are placed on the outside of the graph while distribution among top
// and bottom is nearly equal with respect to the individual layers' sum of y-values
// layers are divided in two arrays, sum of layers should be nearly equal in both lists. and then put back together in
// one list whereas top list is pushed and bottom list is added to the end of the new array
function orderToOutside(curves) {
	var layers = curves.concat();
	var sum = new Array();
	var topSum = botSum = 0;
	var ordered = new Array();

	for(var i=0; i<layers.length; i++) { //necessary cuz dataset titles and y values have to be reordered too!
		layers[i].push(datasets[i]);
		layers[i].push(dataset_titles[i]);
	}

	var sortedLayers = sortByOnsetTime(layers); //quick sort for ordering layers according to onset time
	//calculate sum of each layer
	dataset_titles.length = 0; //just to make sure no data is in dataset_titles anymore, clear array.
	for(var i=0; i<sortedLayers.length; i++) {
		sum[i]=0;
		for (var j=0; j<sortedLayers[i].length-2; j++) {
			sum[i] += sortedLayers[i][j];
		}
	}
	dataset_titles.length = 0;
	datasets.length = 0;

	for (var i=0; i<sortedLayers.length; i++) { //i am making a list, checking it twice, i am gonna find out whos ...
		if (topSum <= botSum) { //top
			topSum += sum[i];
			//alert(sortedLayers[i][sortedLayers[i].length-1]);
			dataset_titles.push(sortedLayers[i].pop());
			datasets.push(sortedLayers[i].pop());
			ordered.push(sortedLayers[i]); //put back together in one array
		} else { //bottom
			botSum += sum[i];
			dataset_titles.unshift(sortedLayers[i].pop());
			datasets.unshift(sortedLayers[i].pop());
			ordered.unshift(sortedLayers[i]); //put back toghether in one array
		}
	}

	return ordered;
}

// orders layers according to onset times, always placing new onsetting layers on top (up==true) or bottom (up==false)
function orderOnset(curves,up) {
	var layers = curves.concat();
	var sum = new Array();
	var ordered = new Array();

	for(var i=0; i<layers.length; i++) { //necessary cuz dataset titles and x labels have to be reordered too!
		layers[i].push(datasets[i]);
		layers[i].push(dataset_titles[i]);
	}

	var sortedLayers = sortByOnsetTime(layers); //quick sort for ordering layers according to onset time

	dataset_titles.length = 0;
	datasets.length = 0;
	
	for (var i=0; i<sortedLayers.length; i++) { //i am making a list, checking it twice, i am gonna find out whos ...
		if(up){
			dataset_titles.push(sortedLayers[i].pop());
			datasets.push(sortedLayers[i].pop());
			ordered.push(sortedLayers[i]); //put back together in one array
		}else{
			dataset_titles.unshift(sortedLayers[i].pop());
			datasets.unshift(sortedLayers[i].pop());
			ordered.unshift(sortedLayers[i]);
		}
	}

	return ordered;
}


/*****************************************************************************************************************************/
/*** OPTIMIZING AESTHETICS - each formula is to be calculated in each x-point; functions fi are defined on the interval [0,1]
/*** notation convention: when a summation's top subscript is less than the bottom, as in the case i=0,
/*** the sum is taken as empty and EQUAL TO 0.
/*****************************************************************************************************************************/

// called when radiobutton on front end is selected
this.baselinePicker = function(e) {
	switch (e.target.value) {
	case 'straight':
		baselineCalculation = baselineCalculationEnum.STACKED;
		break;
	case 'middle':
		baselineCalculation = baselineCalculationEnum.MIDDLE;
		break;
	case 'wiggle':
		baselineCalculation = baselineCalculationEnum.WIGGLE;
		break;
	case 'weighted':
		baselineCalculation = baselineCalculationEnum.WEIGHTEDWIGGLE;
		break;
	default:
		baselineCalculation = baselineCalculationEnum.WIGGLE;
	}

	recalculate();
};

// calls according function for selected baseline calculation setting
function determineLayout(layers) {
	switch (baselineCalculation) {
	case baselineCalculationEnum.STACKED:
		baseline = straightBaseline(layers);
		break;
	case baselineCalculationEnum.MIDDLE:
		baseline = MiddleBaseline(layers);
		break;
	case baselineCalculationEnum.WIGGLE:
		baseline = calculateWiggleBaseline(layers);
		break;
	case baselineCalculationEnum.WEIGHTEDWIGGLE:
		baseline = calculateWeightedWiggleBaseline(layers);
		break;
	default:
		baseline = calculateWiggleBaseline(layers);
	}

	layers.unshift(baseline); //add baseline
	return layers; //return all
}

// formula: g = 0
function straightBaseline(curveArray) {
	var baseline = new Array();
	for(var i = 0; i < curveArray[0].length; i++) { baseline.push(0); } //simple stacked graph - just 0s
	return baseline;
}

// formula: g = 0.5*sum y(x)
function MiddleBaseline(layers) {
	var baseline = [];
	for (var i=0; i<layers[0].length; i++) { //layers[0].length --> # x-values
		for (var j=0, b=0; j<layers.length; j++) b += layers[j][i]; //sum at given x-value
		baseline[i] = -b*0.5;
	}
	return baseline;
}

// formula: baseline = (-1 / (n+2)) * sum{i=1..n}((n - i + 1) * fi)
function calculateWiggleBaseline(curveArray) {
	var baseline = new Array();
	var n = curveArray.length;
	var preFactor = - 1 / (n + 1);
	//calculate formula for each point
	for(var x = 0; x < curveArray[0].length; x++) {
		var sum = 0;
		for(var i = 1; i <= n; i++) { sum += (n - i + 1) * curveArray[i-1][x]; }
		var y = preFactor * sum;
		baseline.push(y);
	}
	return baseline;
}

// formula: baseline' = (-1 / sum(fi)) * sum{i=0..n}((1/2 * fi' + sum{j=1..i-1}(fj')) * fi)
function calculateWeightedWiggleBaseline(curveArray) {
	var n = curveArray.length;
	
	//scale all curves to be in the interval [0,1] (and keep ratios between curves intact)
	//all input curves must already be positive
	var minimum = curveArray[0][0];
	var maximum = curveArray[0][0];
	for(var x = 0; x < curveArray[0].length; x++) {
		for(var i = 0; i < curveArray.length; i++) {
			if(curveArray[i][x] < minimum) { minimum = curveArray[i][x]; }
			if(curveArray[i][x] > maximum) { maximum = curveArray[i][x]; }
		}
	}
	//var curveoffset = minimum;
	//var curvescale = (maximum - minimum); //scale after offset
	var curvescale = maximum; //all input curves must be positive then

	var scaledCurveArray = new Array();
	for(var i = 0; i < curveArray.length; i++) {
		var newCurve = new Array();
		for(var x = 0; x < curveArray[i].length; x++) { newCurve.push(curveArray[i][x]/curvescale); }
		scaledCurveArray.push(newCurve);
	}
	
	//calculate slope for every curve
	var slopeArray = new Array();
	for(var i = 0; i < n; i++){
		var curve_slopes = new Array();
		//x=0: slope is calculated differently as there is no point (i-1)
		var deltay = (scaledCurveArray[i][1] - scaledCurveArray[i][0]);
		curve_slopes.push(deltay); //TODO find better slope
		//for all points in between, the slope is calculated from (i-1) and (i+1) as the spline interpolation also works this way
		for(var x=1; x<scaledCurveArray[i].length-1; x++) {
			var deltay = scaledCurveArray[i][x+1] - scaledCurveArray[i][x-1];
			var deltax = (x-1)+(x+1);
			curve_slopes.push(deltay/deltax);
		}
		//x=scaledCurveArray[i].length-1: slope is calculated differently as there is no point (i+1)
		curve_slopes.push(scaledCurveArray[i][scaledCurveArray[i].length-1] - scaledCurveArray[i][scaledCurveArray[i].length-2]);
		slopeArray.push(curve_slopes);
	}
	
	//calculate formula for each point
	var baseline_delta = new Array();
	for(var x = 0; x < scaledCurveArray[0].length; x++) {
		var sum_fi = 0, sum_big = 0;
		//for prefactor calculate sum(fi)
		for(var i = 0; i < n; i++){
			sum_fi += scaledCurveArray[i][x];
		}
		//the big sum sum{i=0..n}((1/2 * fi' + sum{j=1..i-1}(fj')) * fi)
		for(var i = 0; i < n; i++){ //actually it should start from (i=0-1), but the first one is always 0
			var sum_fj_slope = 0;
			if(j <= i-1){
				for(var j = 1; j <= i-1; j++){
					sum_fj_slope += slopeArray[j][x];
				}
			}
			sum_big += (0.5*slopeArray[i][x] + sum_fj_slope) * scaledCurveArray[i][x];
		}
		if(sum_big == 0) baseline_delta.push(0);
		else baseline_delta.push(-1/sum_fi * sum_big);
	}

	//as baseline_delta only contains differential values, sum them up cumulatively (integrate numerically)
	var baseline = new Array();
	baseline.push(0); //start with 0
	for(var x = 1; x < baseline_delta.length; x++) {
		//also scale up the baseline again
		var a = baseline[x-1] + baseline_delta[x-1] * curvescale;  //this will ignore the last slope value
		a = Math.round(a*Math.pow(10,3))/Math.pow(10,3);
		baseline.push(a);
	}
	
	return baseline;
}


/*****************************************************************************************************************************/
/*** DRAW GRAPH
/*****************************************************************************************************************************/

// draws the streamgraph
// can be called periodically
function draw_streamgraph() {
	if(redrawFrame){ //only redraw when something has changed, like mouse has been moved
		redrawFrame = false;
		//clear canvas
		streamgraph_context.clearRect(0,0,streamgraph_canvas.width,streamgraph_canvas.height);
		
		streamgraph_context.save();
		
		shrinkCanvas(streamgraph_canvas, streamgraph_context, gscalex, gscaley);
		offsetCanvas(streamgraph_canvas, streamgraph_context, gmovex, gmovey);
		
		streamgraph_context.save();
		
		//zoom according to mousewheel
		streamgraph_context.scale(scale,scale); //must be before translating
		streamgraph_context.translate(-originx*streamgraph_canvas.width, -originy*streamgraph_canvas.height);
		
		drawStackedGraph(streamgraph_canvas, streamgraph_context, stacked01, smoothing);
		
		drawVerticalHighlight(streamgraph_canvas, streamgraph_context, mousexhover);
		
		streamgraph_context.restore();
		
		drawXAxis(streamgraph_canvas, streamgraph_context, x_labels, 20);

		streamgraph_context.restore();
	}
}

// zooms out by the given scale
function shrinkCanvas(canvas, context, xscale, yscale){
	//scale down from full canvas size //translating before scaling, otherwise the translating coordinates get scaled too
	context.translate(canvas.width*(1-xscale)/2, canvas.height*(1-yscale)/2); //move whole plot to the center
	context.scale(xscale,yscale); //zoom out
}

// moves the canvas by the offset
// offset is given as multiple of width/height
function offsetCanvas(canvas, context, xoffset, yoffset){
	context.translate(canvas.width*xoffset, canvas.height*yoffset);
}

// calculate a layer fill color
// use a single hue with changing brightness according to layer number
function getLayerFillColors_Hue(stackedCurves){
	var cols = Array();

	for(var layer = 0; layer < stackedCurves.length-1; layer++) {
		cols.push([
			"hsla(" + layerhue + "," + 70 + "%," + ((100 * layer / (stackedCurves.length-2)) * 20 % 60 + 20) + "%, 1.0)",
			"hsla(" + (layerhue-30) + "," + 70 + "%," + 70 + "%, 1.0)" //highlight color
			]);
	}

	return cols;
}

// calculate a layer fill color
// use color points from a canvas to calculate
function getLayerFillColors_Pic(stackedCurves){
	var cols = Array();
	var layerSums = Array();
	var maxSum = 0;

	for(var x=0; x<datasets.length; x++) {
		var sum = 0;
		for(var y=0; y<datasets[x].length; y++) { sum += datasets[x][y]; }
		maxSum = Math.max(maxSum, sum);
		layerSums.push(sum);
	}


	for(var layer = 0; layer < datasets.length; layer++) {
		var onset = -1;

		for(var a=0; a<datasets[layer].length-1; a++) { if(onset == -1 && datasets[layer][a]>0) { onset = a; } }

		onset = (onset == -1) ? 0 : (col_canvas.width-1)/datasets[0].length*onset;
		var bending = 8; // bends value between [0,1], >1 means positive bending, <1 negative bending
		var sum = (layerSums[layer] == 0) ? 0 : (col_canvas.height-1) - (col_canvas.height-1) * Math.pow((layerSums[layer] / maxSum), (1.0/bending));
		
		var col_data = col_context.getImageData(onset, sum, 1, 1).data; //get rgb value from pixel
		//dependent on layer size and onset time.

		cols.push([
			'rgba(' + (col_data[0]) + ',' + (col_data[1])  + ',' + (col_data[2]) + ', 0.8)',
			'rgba(' + (col_data[0]) + ',' + (col_data[1])  + ',' + (col_data[2]) + ', 1.0)' //highlight color
			]);
	}

	return cols;
}

// calculate a layer fill color
// use a quite random coloring
function getLayerFillColors_Rand(stackedCurves){
	var cols = Array();

	for(var layer = 0; layer < stackedCurves.length-1; layer++) {
		var a=c=0;
		for(var j=0; j<stackedCurves[layer].length-1; j++){
			a += stackedCurves[layer][j];
			c++;
		}
		var rint = parseInt((255-(a/c)) * a / ((stackedCurves[layer][0] + 0.01)/(a * layer + 1)));
		cols.push([
			'rgba(' + (rint >> (10-10*candyCrazinessFactor)) + ',' + (rint >> (8-8*candyCrazinessFactor) & 255) + ',' + (rint >> (16-16*candyCrazinessFactor) & 255) + ', 0.85)',
			'rgba(' + (rint >> (10-10*candyCrazinessFactor)) + ',' + (rint >> (8-8*candyCrazinessFactor) & 255) + ',' + (rint >> (16-16*candyCrazinessFactor) & 255) + ', 0.6)' //highlight color
			]);
	}

	return cols;
}

// calculates colors for the single layers according to globally set color scheme
function calcLayerColors(stackedCurves){
	switch (colorMode) {
	case colorModeEnum.HUE:
		layerColors = getLayerFillColors_Hue(stackedCurves);
		break;
	case colorModeEnum.HUEBONUS:
		layerColors = getLayerFillColors_Hue(stackedCurves);
		break;
	case colorModeEnum.RANDOM:
		layerColors = getLayerFillColors_Rand(stackedCurves);
		break;
	case colorModeEnum.PICTURE:
		layerColors = getLayerFillColors_Pic(stackedCurves);
		break;
	default:
		layerColors = getLayerFillColors_Hue(stackedCurves);
	}
}

// draws the stacked graph (streamgraph) with the given curves, the first curve is the baseline
function drawStackedGraph(canvas, context, stackedCurves, smoothing) {
	var mouseyhover = -1;
	for(var i = 0; i < stackedCurves.length-1; i++) {
		//COLOURING
		context.strokeStyle = "rgb(" + 50 + "," + 120 + "," + 150 + ")";
		context.fillStyle = layerColors[i][0];

		drawLayer(canvas, context, stackedCurves[i], stackedCurves[i+1], smoothing);

		context.save();
		//workaround for firefox which does not take account for scaling
		context.setTransform(1,0,0,1,0,0);
		if(interactive && mouseyhover==-1 && mousex >= 0 && mousey >=0 && context.isPointInPath(mousex, mousey)) {
			context.globalCompositeOperation = "source-over";
			context.fillStyle = 'white'; //clean layer to not disturb highlighting
			context.fill();
			context.fillStyle = layerColors[i][1];
			//context.lineWidth *= 2;
			context.fill();
			mouseyhover = i;
		}
		context.restore();
	}

	//print legend in the end so it's displayed z-above graph
	if(mouseyhover >= 0){
		var labelx = 20;
		var labely = 30;
		var labeltext = dataset_titles[mouseyhover];
		var pointtext = mousexhover>=0 ? x_labels[mousexhover] + ": " + datasets[mouseyhover][mousexhover] + " " + graph_y_axis : "";
		var betweenthelines = 7;
		var space = 5;
		var fontsize = 10;

		context.save();
		context.setTransform(1,0,0,1,0,0);
		context.globalCompositeOperation = "source-over";
		//print background
		context.fillStyle = "rgba(255, 255, 255, 0.7)";
		context.font = fontsize + "pt Arial";
		context.fillRect(labelx-space, labely-fontsize-space, Math.max(context.measureText(labeltext).width+2*space, context.measureText(pointtext).width+2*space), fontsize+fontsize+betweenthelines+2*space);

		context.fillStyle = "rgba(0, 0, 0, 0.7)";
		context.fillText(labeltext, labelx,labely);
		context.fillText(pointtext, labelx, labely + fontsize + betweenthelines);
		context.restore();
	}
}

// draws an area with the given bottom and top points
// filling will be behind everything
function drawLayer(canvas, context, points1, points2, smoothing) {
	var left = 0;
	var right = canvas.width;
	var top = 0;
	var bottom = canvas.height;
	//top and bottom will be swapped as our graph's point of origin is in the lower left, but from the canvas in the upper left
	context.save();
	pathLayer(context, left, right, top, bottom, points1, points2, smoothing);
	//filling behind everything else, because already drawn outlines should not be painted over
	//can be disabled as no outlines are used in this version, also not !when highlighting!
	//context.globalCompositeOperation = "destination-over"; //this takes 35ms in Opera which is inacceptable
	context.globalCompositeOperation = "source-over";
	context.fill();
	//context.globalCompositeOperation = "source-over"; //outline
	context.restore();
}

// creates a path with the given bottom and top points
// creates a closed sub path for each closed region (and doesn't draw lines for zero regions)
function pathLayer(context, left, right, top, bottom, points1, points2, smoothing) {
	context.save();
	context.beginPath();
	
	var subleft=subright=0;
	
	while(subright < points1.length-1 && points1[subright] == points2[subright]){ // throw away zeros in the beginning
		subright++; // subleft will be updated afterwards
	}
	
	while(subright < points1.length-1){ // only draw if there is something left
		subleft = subright; // start of new subpath
		if(subleft>0){ // at the onset time the curve also is zero, but that's wanted - except to the complete beginning of the graph
			subleft--;
		}
		while(subright < points1.length-1 && points1[subright] != points2[subright]){ // take for subpath
			subright++; // still belongs to the same sub path
		}
		
		var leftfake = subleft > 0; // when there's a point before the subpath available, take that for calculating the bezier curve
		var rightfake = subright < points1.length-1; // when there's a point after the subpath available, take that for calculating the bezier curve
		
		//due to drawInterpolatedCurve() taking left and right values and stretching the subpaths to that
		var realleft=left+(right-left)*subleft/(points1.length-1);
		var realright=left+(right-left)*subright/(points1.length-1);
		
		//start point
		context.moveTo(realleft, top + (bottom-top) * (1 - points1[subleft]));
		
		//first curve from left to right (usually the lower curve, but upper one would work the same if points1 and points2 were swapped)
		drawInterpolatedCurve(context, points1.slice(subleft - (leftfake?1:0), subright+1 + (rightfake?1:0)), false, realleft, realright, top, bottom, smoothing, leftfake, rightfake);
		
		//connect the last point of the first curve with the last point of the second curve
		context.lineTo(realright, top + (bottom-top) * (1 - points2[subright]));
		
		//second curve from right to left
		drawInterpolatedCurve(context, points2.slice(subleft - (leftfake?1:0), subright+1 + (rightfake?1:0)), true, realleft, realright, top, bottom, smoothing, leftfake, rightfake);
		
		//connect the first point of the second point (the last point when viewing from right to left) with the first point of the first curve
		context.lineTo(realleft, top + (bottom-top) * (1 - points1[subleft]));
		
		context.closePath();

		while(subright < points1.length-1 && points1[subright] == points2[subright]){ // throw away zeros
			subright++; // use subright as it has the correct left-off value from before
		}
	}
	
	context.restore();
}

// draw a curve from an array of y-values which lie in range [0,1]
// lower left of the canvas is assumed to be coordinate (0,0),
// top has y-coordinate 1
// reverse=true draws line from right to left
// does NOT call beginPath() or stroke()
// TODO how to pass points array? as x-y coordinate or only y-coordinate and assume even-spread x? (right now even-spread)
function drawInterpolatedCurve(context, pts, reverse, l, r, t, b, smoothing, leftfake, rightfake) {
	var splineArray = Array();
	var realPointsLength = pts.length - (leftfake?1:0) - (rightfake?1:0);
	if(reverse) {
		for(var i=(pts.length-1); i>=0; i--)
		{
			var x = l+(i - (leftfake?1:0))*(r-l)/(realPointsLength-1);
			var y = t+(b-t)*(1-pts[i]);
			x = Math.round(x*Math.pow(10,2))/Math.pow(10,2);
			y = Math.round(y*Math.pow(10,2))/Math.pow(10,2);
			splineArray.push(x,y);
			//splineArray.push(l+i*(r-l)/(pts.length-1),t+(b-t)*(1-pts[i]));
		}
		drawSpline(context, splineArray, smoothing, rightfake, leftfake);
	}
	else {
		for(var i=0; i<pts.length; i++)
		{
			var x = l+(i - (leftfake?1:0))*(r-l)/(realPointsLength-1);
			var y = t+(b-t)*(1-pts[i]);
			x = Math.round(x*Math.pow(10,2))/Math.pow(10,2);
			y = Math.round(y*Math.pow(10,2))/Math.pow(10,2);
			splineArray.push(x,y);
			//splineArray.push(l+i*(r-l)/(pts.length-1),t+(b-t)*(1-pts[i]));
		}
		drawSpline(context, splineArray, smoothing, leftfake, rightfake);
	}
}

// get control points of bezier curve to draw a spline with free parameter t
// thanks to http://scaledinnovation.com/analytics/splines/aboutSplines.html; GPL3
function getControlPoints(x0,y0,x1,y1,x2,y2,t){
	//  x0,y0,x1,y1 are the coordinates of the end (knot) pts of this segment
	//  x2,y2 is the next knot -- not connected here but needed to calculate p2
	//  p1 is the control point calculated here, from x1 back toward x0.
	//  p2 is the next control point, calculated here and returned to become the
	//  next segment's p1.
	//  t is the 'tension' which controls how far the control points spread.

	//  Scaling factors: distances from this knot to the previous and following knots.
	var d01=Math.sqrt(Math.pow(x1-x0,2)+Math.pow(y1-y0,2));
	var d12=Math.sqrt(Math.pow(x2-x1,2)+Math.pow(y2-y1,2));

	var fa=t*d01/(d01+d12); // scaling factor for triangle Ta
	var fb=t-fa; // ditto for Tb, simplifies to fb=t-fa

	var p1x=x1+fa*(x0-x2); //left of point
	var p1y=y1+fa*(y0-y2);

	var p2x=x1-fb*(x0-x2); //right of point
	var p2y=y1-fb*(y0-y2);

	return [p1x,p1y,p2x,p2y]
}

// draws a smooth spline with free parameter t
// thanks to http://scaledinnovation.com/analytics/splines/aboutSplines.html; GPL3
// modified to NOT call beginPath() or stroke()
// modified to draw the curve from first point to last point without moveTo
function drawSpline(context,pts,t, firstfake, lastfake){
	var cp=[]; // array of control points, as x0,y0,x1,y1,...
	var n=pts.length;
	var flag = true;

	// Draw an open curve, not connected at the ends
	for(var i=0;i<n-4;i+=2){
		if(pts[i+1] == pts[i+3] || pts[i+3] == pts[i+5]) {
			cp=cp.concat(getControlPoints(pts[i],pts[i+1],pts[i+2],pts[i+3],pts[i+4],pts[i+5],0));
		}
		else { cp=cp.concat(getControlPoints(pts[i],pts[i+1],pts[i+2],pts[i+3],pts[i+4],pts[i+5],t)); }
	}
	
	if(!firstfake){ // when the leftmost point is a real point we need to draw a quadratic curve as we haven't got enough points for bezier interpolation
		context.quadraticCurveTo(cp[0],cp[1],pts[2],pts[3]); // For open curves the first and last arcs are simple quadratics.
	}

	for(var i = 2; i < pts.length-5; i+=2){
		context.bezierCurveTo(cp[2*i-2],cp[2*i-1],cp[2*i],cp[2*i+1],pts[i+2],pts[i+3]);
	}
	
	if(!lastfake){ // when the rightmost point is a real point we need to draw a quadratic curve as we haven't got enough points for bezier interpolation
		context.quadraticCurveTo(cp[2*n-10],cp[2*n-9],pts[n-2],pts[n-1]); // For open curves the first and last arcs are simple quadratics.
	}
}

// draws an x-axis at the given y_height
function drawXAxis(canvas, context, x_labels, y_offset) {
	var left = 0;
	var right = canvas.width;
	var y_height = canvas.height + y_offset;
	var tick_height = 10;
	var space = 5;
	//zoom horizontally without distorting, according to current mousewheel zoom state
	right = (right - left) * scale -originx*canvas.width*scale;
	left = -originx*canvas.width*scale;
	context.save();
	context.globalCompositeOperation = "source-over";
	//print background
	context.fillStyle = "rgba(255, 255, 255, 0.7)";
	context.fillRect(left-space, y_height-tick_height-space, (right - left)+2*space, 70+2*space);
	context.lineWidth = 2;
	context.lineJoin = "round";
	context.strokeStyle = "rgb(" + 100 + "," + 100 + "," + 100 + ")";
	context.fillStyle = "rgb(" + 0 + "," + 0 + "," + 0 + ")";
	context.font = "10pt Arial";
	context.beginPath();
	context.moveTo(left, y_height); //start point
	context.lineTo(right, y_height); //draw horizontal axis line
	for(var i = 0; i < x_labels.length; i++) {
		var currentX = left + (right - left) / (x_labels.length - 1) * i;
		context.moveTo(currentX, y_height - tick_height / 2);
		context.lineTo(currentX, y_height + tick_height / 2);
		context.save();
		context.translate(currentX, y_height);
		context.rotate(45 * Math.PI/180);
		context.textBaseline = "top";
		context.fillText(x_labels[i], 10, 0);
		context.restore();
	}
	context.stroke();
	context.restore();
}

//draws a vertical line snapped to the nearest x_value
function drawVerticalHighlight(canvas, context, xindex){
	if(xindex >= 0){
		var xval = xindex * canvas.width / (x_labels.length-1)
		context.save();
		context.globalCompositeOperation = "source-over";
		context.lineWidth = 1 / scale;
		context.lineCap = "round";
		context.lineJoin = "round";
		context.strokeStyle = "rgba(" + 100 + "," + 100 + "," + 100 + "," + 0.5 + ")";
		context.beginPath();
		context.moveTo(xval, 0);
		context.lineTo(xval, canvas.height);
		context.stroke();
		context.restore();
	}
}


/*****************************************************************************************************************************/
/*** COLOURING
/*****************************************************************************************************************************/

// changes the smoothness of the interpolation between points, range [0,1]
this.smoothingPicker = function(e){
	smoothing = e.target.value;
	redrawFrame = true;
};

// called when radio button on front end has changed
this.colorPicker = function(e){
	var col_hue_bonus = document.getElementById('col_hue_bonus');
	var col_hue = document.getElementById('col_hue');
	var col_candy = document.getElementById('col_candy');
	if (col_hue_bonus) col_hue_bonus.style.display = "none";
	if (col_hue) col_hue.style.display = "none";
	if (col_candy) col_candy.style.display = "none";

	switch (e.target.value) {
	case 'random':
		if (col_candy) col_candy.style.display = "block";
		colorMode = colorModeEnum.RANDOM;
		calcLayerColors(stacked01);
		redrawFrame = true;
		break;
	case 'hue':
		if (col_hue) col_hue.style.display = "block";
		colorMode = colorModeEnum.HUE;
		myStreamGraph.changeHue(layerhue,false); //fix having to use myStreamGraph
		break;
	case 'bonus':
		if (col_hue_bonus) col_hue_bonus.style.display = "block";
		colorMode = colorModeEnum.HUEBONUS;
		myStreamGraph.changeHue(layerhue,true); //fix having to use myStreamGraph
		break;
	case 'nice':
		colorMode = colorModeEnum.PICTURE;
		calcLayerColors(stacked01);
		redrawFrame = true;
		break;
	default:
		if (col_hue) col_hue.style.display = "block";
		colorMode = colorModeEnum.HUE;
		myStreamGraph.changeHue(layerhue,false); //fix having to use myStreamGraph
	}
};

// changes the hue of the streamgraph in case it is drawn in single-color mode
this.changeHue = function(hue,bonus) {
	layerhue = hue < 0 ? 0 : hue > 360 ? 360 : hue;
	calcLayerColors(stacked01);
	redrawFrame = true;

	if(bonus){
		if (document.getElementById('col_hue') && document.getElementById('col_hue').querySelector('input')) 
			document.getElementById('col_hue').querySelector('input').value = hue;

		//bonus for coloring website
		if (document.getElementById('content')) document.getElementById('content').style.backgroundColor = 'hsla(' + layerhue + ',92%,71%,1.0)';
		if (document.querySelector('#streamgraph_container h2')) document.querySelector('#streamgraph_container h2').style.color = 'hsla(' + layerhue/*-24*/ + ',100%,20%,1.0)';
		if (document.querySelector('#streamgraph_container.hidden_show')) document.querySelector('#streamgraph_container.hidden_show').style.borderBottomColor = 'hsla(' + layerhue/*-24*/ + ',100%,20%,0.7)';
		if (document.querySelector('canvas')) document.querySelector('canvas').style.borderColor = 'hsla(' + layerhue/*-25*/ + ',61%,51%,1.0)';
		if (document.querySelector('canvas#color')) document.querySelector('canvas#color').style.borderColor = 'hsla(' + layerhue/*-25*/ + ',61%,51%,1.0)';
		if (document.querySelector('h1')){
			document.querySelector('h1').style.color = 'hsla(' + layerhue/*-24*/ + ',100%,20%,1.0)';
			document.querySelector('h1').style.borderBottomColor = 'hsla(' + layerhue/*-24*/ + ',100%,20%,1.0)';
			document.querySelector('h1').style.textShadow = '0.07em 0.07em 0.2em hsla(' + layerhue/*-24*/ + ',100%,20%,1.0)';
		}
		//document.querySelector('#streamgraph_explanation h2:nth-of-type(1n+2)').style.borderTopColor = 'hsla(' + layerhue/*-24*/ + ',100%,20%,1.0)';

		var elems = document.querySelectorAll('#streamgraph_explanation h2:nth-of-type(1n+2)');
		for(var i=0; i<elems.length; i++){ elems[i].style.borderTopColor = 'hsla(' + layerhue/*-24*/ + ',100%,20%,1.0)'; }
	}else{
		document.getElementById('col_hue_bonus').querySelector('input').value = hue;
	}
};

// changes the hue of the streamgraph in case it is drawn in single-color mode
this.changeCandy = function(candy) {
	candyCrazinessFactor = candy < 0 ? 0 : candy > 1 ? 1 : candy;
	calcLayerColors(stacked01);
	
	redrawFrame = true;
};


/*****************************************************************************************************************************/
/*** INTERACTION
/*****************************************************************************************************************************/

// called when the mouse has been moved
// used for displaying dynamic legends
function mouseMoved(event) {
	//mouse position relative to the canvas
	mousex = event.clientX + self.pageXOffset - streamgraph_canvas.offsetLeft;
	mousey = event.clientY + self.pageYOffset - streamgraph_canvas.offsetTop;

	//also working alternative
	//mousex = event.pageX - streamgraph_canvas.offsetLeft;
	//mousey = event.pageY - streamgraph_canvas.offsetTop;

	//alternative that should work everywhere, but doesn't in Firefox
	//mousex = event.offsetX;
	//mousey = event.offsetY;

	//mouseposition on the unzoomed and untranslated graph - just the global zoom and translation applied
	mouseunzoomedgraphx = ((mousex/streamgraph_canvas.width  - (1 - gscalex) / 2) / gscalex - gmovex);
	mouseunzoomedgraphy = ((mousey/streamgraph_canvas.height - (1 - gscaley) / 2) / gscaley - gmovey);
	//mouseposition - on the streamgraph is range [0,1], outside lower/higher
	mousegraphx = mouseunzoomedgraphx / scale + originx;
	mousegraphy = mouseunzoomedgraphy / scale + originy;
	mousexhover = mousegraphx >= (0 - 0.5/(x_labels.length-1)) && mousegraphx <= (1 + 0.5/(x_labels.length-1)) ? parseInt( mousegraphx * (x_labels.length-1) + 0.5 ) : -1;

	redrawFrame = true;
}

// called when the mouse leaves the canvas
// clears layer highlighting and vertical line
function mouseLeft(event) {
	//special treatment for -1
	mousex = -1;
	mousey = -1;
	mousexhover = -1;

	redrawFrame = true;
}

// called when the mousewheel has been moved
// used for zooming
// thanks to http://stackoverflow.com/questions/2916081/zoom-in-on-a-point-using-scale-and-translate for some minor starting clues
// thanks to diverse sources for Firefox workarounds, e.g. http://help.dottoro.com/ljqeknfl.php
function mouseWheel(event) {
	var rolled = 0;
	if ('wheelDelta' in event) { rolled = event.wheelDelta; }
	else { rolled = -40 * event.detail; } //Firefox workaround
	var wheel = rolled/120;
	var zoom = 1 + wheel/8;
	var scaleold = scale;
	scale *= zoom;
	scale = scale < 1 ? 1 : scale;	//limit zooming-out to full graph
	
	//for a nice zooming experience, the graph-mousposition mousegraphx/y should not change
	//so: calculating the new originx/y from the equation mousegraphx/y_old == mousegraphx/y_new
	originx = mousegraphx - mouseunzoomedgraphx / scale; //using new scale
	originy = mousegraphy - mouseunzoomedgraphy / scale;
	
	//limit offset
	originx = originx < 0 ? 0 : originx;
	originx = originx > (1 - 1/scale) ? (1 - 1/scale) : originx;
	originy = originy < 0 ? 0 : originy;
	originy = originy > (1 - 1/scale) ? (1 - 1/scale) : originy;
	
	redrawFrame = true;
	
	event.returnValue = false; //don't scroll whole browser window (Chrome)
	event.preventDefault(); //same for Firefox, thanks to http://forums.asp.net/t/1071858.aspx
	//event.stopPropagation(); //that would be the standard
}


/*************************************************************************************************************************************/

// vertically scale down curves to fit in range [0,1]
function scaleCurves(curveArray) {
	var minimum = curveArray[0][0];
	var maximum = curveArray[0][0];

	for(var x=0; x<curveArray[0].length; x++) {
		if(curveArray[0][x] < minimum) { minimum = curveArray[0][x]; }
		if(curveArray[curveArray.length - 1][x] > maximum) { maximum = curveArray[curveArray.length - 1][x]; }
	}

	var offset = minimum;
	var scale = 1 / (maximum - minimum); //scale after offset

	var scaledCurveArray = new Array();
	for(var i=0; i<curveArray.length; i++) {
		var newCurve=new Array();
		for(var x = 0; x<curveArray[i].length; x++) { newCurve.push((curveArray[i][x] - offset) * scale); }
		scaledCurveArray.push(newCurve);
	}
	return scaledCurveArray;
}

// stacks curves in a way that the y-values of the first one are unchanges, for the second one are first + second, for the third are first + second + third and so on
// all arrays need to be of equal length
function stackCurves(curveArray) {
	stackedArray = new Array();
	pointCount = curveArray[0].length;

	for(var i = 0; i < curveArray.length; i++) {
		var layertop = new Array();
		for(var x = 0; x < pointCount; x++) {
			var ySum = 0;
			for(var j = 0; j <= i; j++) { ySum += curveArray[j][x]; }
			layertop.push(ySum);
		}
		stackedArray.push(layertop);
	}
	return stackedArray;
}


};
