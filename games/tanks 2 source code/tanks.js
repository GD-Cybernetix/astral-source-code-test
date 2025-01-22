/* ####  BEGIN util.js  ####*/

/*Polyfill*/
Number.parseInt = parseInt;

// from:https://github.com/jserz/js_piece/blob/master/DOM/ChildNode/remove()/remove().md
(function (arr) {

  arr.forEach(function (item) {
    if (item.hasOwnProperty('remove')) {

      return;
    }
    Object.defineProperty(item, 'remove', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: function remove() {
        this.parentNode.removeChild(this);
      }
    });
  });
})([Element.prototype, CharacterData.prototype, DocumentType.prototype]);


// Helper Logging function
function log(msg){
	if (DEBUG_MODE_ENABLED){
		var func = arguments.callee.caller.name;
		msg = msg || '';
		console.log(arguments.callee.caller.name + "() --> " + msg);
	}
		
  		
}

//Read paramaters from url
function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}

//Helper utility for DOM operations 
var util = {
	// FYI: This isn't exactly jquery but should work for simple stuff
	// @param id=Element ID
	get: function(id){
		return document.getElementById(id)
	},

	getClass: function(className){
		return document.getElementsByClassName(className);
	},

	html: function(id,val){
		var e = document.getElementById(id);
		if (val) return e.innerHTML = val;
		else return this.getElementById
	},

	size: function(id,val){
		var e = document.getElementById(id);
		if (val) {
			e.style.width = val.x + 'px';
			e.style.height = val.y + 'px';
		}
		else return {x: e.offsetWidth, y: e.offsetHeight}

	},
	//Not working?
	randomArray: function(items){
		if (!items || !Array.isArray(items)){
			return null;
		}
		return items[~~(items.length * Math.random())];
	},

	uniqueId: function(){
		return Math.random().toString(36).substring(2) 
		+ (new Date()).getTime().toString(36);		
	}



}


/* ####  BEGIN config.js  ####*/

const TANKS_VERSION = "0.72";
const DEBUG_MODE_ENABLED = false;

var difficulty = 1,
	ratio = 1,
	startingMoney = 100,
	winPayout = 500, 			//Cash payout for winning match
	hitPayout = 250,			//Cash payout for hitting enemy tank

	cheatsEnabled = false;
	soundEnabled = true;

	particle_WeatherEnabled = false,

	//Total POSSIBLE number of tanks in game.
	// tanks are created once initially and reused - regardless of whether they are in play.
	tankMax = 4,					
	tankPlayers = 4,			// Number of chosen players		
	tankNo = 0, 				// Current tank
	showCompassQ = true, 		// Controls when tank compass / ui is visible
	tanks = [],					// Container for player tanks

	//Turns that a human hasn't played
	aiOnlyTurns = 0,

	//Mapping of color names to hex for tanks
	clrs = [["Blue", '#0066FF'], ["Red", '#FF0000'], ["Orange", '#ff7700'], ["Purple", '#9155ff']],

	windForce = 0,
	maxWindForce = .015,

	//Force applied downard (everything assumed to have mass of 1)
	gravityForce = .03,

	//Terrain types. [file, ground color, params, smoothness, display name]
	ters = [
		['images/bg/basic.svg', '#578641', 		 [0.40, 0.6,  0.3,  0.1,  0.05, 0.02,  0.001,  0.001,  0], 0.2, 'Grassland','grass-texture',0.03],
		['images/bg/desert.svg', '#bea276', 		 [0.08, 0.04, 0.03, 0.02, 0.01, 0.002, 0.0001, 0.0001, 0], 0.01, 'Desert','desert-texture',0.03],
		['images/bg/snow.svg', '#fafaff', 		 [0.0,  0.0,  0.5,  0.15, 0.0,  0.02,  0.002,  0.001,  0], 0.05, 'Snow','snow-texture',0.03],
		['images/bg/forest.svg', 'rgb(50,150,16)', [0.4,  0.6,  0.3,  0.1,  0.05, 0.02,  0.001,  0.001,  0], 0.06, 'Forest','forest-texture',0.03],
		['images/bg/hills.svg', '#359539', 		 [0.4,  0.6,  0.3,  0.1,  0.05, 0.02,  0.001,  0.001,  0], 0.06, 'Hills','hills-texture',0.03],
		['images/bg/moon.svg', '#888', 		 	 [0.40, 0.6,  0.03,  0.1,  0.05, 0.02,  0.001,  0.001,  0], .3, 'Moon','moon-texture',0.011],
		['images/bg/city.svg', '#578641', 		 	 [.2, 0, 0, 0, 0, 0, 0, 0, 0], .3, 'City','grass-texture',0.03],
		['images/bg/city-night2.svg', '#888', 		 	 [.2, 0, 0, 0, 0, 0, 0, 0, 0], .5, 'City-Night','moon-texture',0.03],
		['images/bg/beach.svg', '#bea276', 		 	 [.2, .2, .2, 0, 0, 0, 0, 0, 0], .01, 'Beach','desert-texture',0.03]
	],
	terPts = [],
	terMax = 9,
	terNo = 0,
	terBottomOffset = 18, //min distance between bottom of screen and terrain
	terTopOffset = 75; 		//min distance between top of screen and terrain

var costMap = {
	//items
	'Fuel':50,
	'Health':75,
	'Shield':150,
	'Targeting':200,

  	//Weapons
	'Medium Shell':50,
	'Large Shell': 200,
	'Cannon Ball': 300,
	'EMP':500,
	'Atomic Shell':750,
	'Air Strike': 1000,
	'Napalm':1000,
	'Sniper Shell': 500,
	'Flak Cannon': 500

}

/* ####  BEGIN game.js  ####*/

var tanksTimesClicked = 0;

var newRound = false;
var titleMute = true;
var timeouts = [];
var demoModeEnabled = false;
var skipAiRound = false;

//Detect optimal resolution.
var resolution = {	
	x : Number(getURLParameter('width')) || window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth,
	y : Number(getURLParameter('height')) || window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight
}
//Swap x & y (cheap way to handle portrait / landscape... TODO: this only works on page load)
if (resolution.y > resolution.x){
	var tmp = resolution.x;
	resolution.x = resolution.y;
	resolution.y = tmp;
}
//Small screen? Lets zoom out a bit
if (resolution.x < 800) {
	resolution.x *= 1.25; 
	resolution.y *= 1.25;
}

// Main Entry Point
function tanksMain() {
	log('<==== tanksMain ====>')

	//Hide loading screen
	window.addEventListener('load',function(){
		document.getElementById('load-screen').onclick = function(){
			this.style.display = 'none';
			document.getElementById('game').style.display = 'block';
		}
		var text = document.getElementById('load-screen').children[0];
		text.innerHTML = "OK!";
		text.style.background = "white";
		text.style.transform = "rotate(-3deg);"

		//document.getElementById('image-assets').style.display = 'none';

		//Move cursor crosshair for airstrike
		/*
		document.body.onmousemove = function(e){
			var crosshair = document.getElementById('crosshair');
			crosshair.style.left = e.clientX + 'px';
			crosshair.style.top = e.clientY + 'px';
		}
		*/

		//Prevent right click context menus
		window.oncontextmenu = function(event) {
			log("prevent context menu");
			event.preventDefault();
			event.stopPropagation();
			return false;
		};

	});

	//Window resize event
	window.addEventListener('resize',screenResized);

	if (!soundEnabled) document.getElementById('mute-control-checkbox').checked = true;
	if (cheatsEnabled) document.getElementById('cheats').style.display = "block";


	setVersion(TANKS_VERSION);
	initRendering();
	setTerrain(0);
	updateParticles();
	showHud(false);
	showMainMenu(true);
	bindButtonHandlers();
	popPlayerSelect(tankPlayers);
  	setBackground(ters[0][0]);
	drawGrid();
	toggleGrid();
	demoMode();

}

function toggleFullScreen() {

  var doc = window.document;
  var docEl = doc.documentElement;

  var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    
	requestFullScreen.call(docEl);
  }
  else {
    cancelFullScreen.call(doc);
  }

  screenResized();

}

/*param = 'rain'|'snow'|'clouds'*/
/*
function setWeather(weathertype){
	var elem = util.get('weather-scroll');
	var bg = '';
	var anim = 'none';
	var h = '100%';
	var dir = '/images/textures/';
	switch(weathertype){
		case 'rain': 
			bg = dir + 'rain.png';
			anim = 'backgroundScrollDiagonal 5s linear infinite'
			break;

		case 'snow':
			bg = dir + 'snow/png';
			h = '25%';
			anim = 'backgroundScrollVertical 10s linear infinite'
			break;

		case 'clouds':
			bg = dir + 'clouds.png';
			anim = 'backgroundScrollDiagonal 5s linear infinite'
			break;
	}

	elem.style.animation = anim;
	elem.style.height = h;
	elem.style.background = bg;
}

*/
function screenResized(){
	log();
	var scale = {
		x: document.body.offsetWidth / resolution.x,
		y: document.body.offsetHeight / resolution.y
	}

	ratio = Math.min(scale.x,scale.y)
	var dim = {x:(resolution.x * ratio),y: (resolution.y * ratio)}

	util.size('game',dim);

	//util.size('hud',dim);
	//util.size('main-menu',dim);

	var cans = document.getElementsByTagName('canvas');
	var x = cans.length;
	for (var i=0; i < x; i++){
		resizeCanvas(cans[i]);
	}

	drawTerrain();
	drawTanks();
	drawGrid();
}

function startGame(){
	demoModeEnabled = false;
	clearParticleCanvas();
	hideTitle();
	initPlayers();
	createTanks();
	newGame();	
}

//Players count dropdown change value
function playerCountChange(){
	var e = document.getElementById('player-count-box');
	var n = Number.parseInt(e.options[e.selectedIndex].innerHTML);
	popPlayerSelect(n);
}

//AI tanks duking it out in background of main menu
function demoMode(){

	var n = 2;
	demoModeEnabled = true;
	initPlayers();
	createTanks(n);

	newGame();
	//particle_WeatherEnabled = true;
	setTerrain(2);
	drawTanks();
	for (var i in tanks) tanks[i].aiq=true;
	aistt();
	showMainMenu();	
}

//Set tankPlayers from the select box
function initPlayers(){
	var pSel = document.getElementById('player-count-box');
	tankPlayers = Number.parseInt(pSel.options[pSel.selectedIndex].innerHTML);

	var scores = document.getElementsByClassName('player-score');
	for (var i=0; i < scores.length; i++){
		if (i < tankPlayers) scores[i].style.display = 'inline';
		else scores[i].style.display = 'none';
	}

}

//Tank earns some cash
function payTank(tank,amt){
	log(tank.name + " has earned $" + amt);
	tank.money += amt;
	flashMessage('$' + amt,1000,'lime');
}

//Cheat function to instantly set all weapons ammo
function giveAllWeapons(tank){
	log('CHEATER!!!..');
	flashMessage("Weapon Cheat!");
	for (var i=1;i<tank.weapons.length;i++){
		tank.weapons[i].ammo = 100;
	}

	updateHud();
}

// Helper function to animate something over time
// calls a function with the progress every tick
//  callback at the end of animation
function animate(totalTime,func,callback){

  log("Start animating: " + arguments.callee.caller.name);
	var lastFrame = 0;
	var elapsed = 0;
	var progress = 0;
	var dt = 0;

	var loop = function(timestamp){
		if (lastFrame == 0) lastFrame = timestamp;
		dt = timestamp - lastFrame;
		elapsed += dt;
		lastFrame = timestamp;
		progress = elapsed / totalTime;
		if (elapsed < totalTime){
			func(progress);
			requestAnimationFrame(loop);
		}

		else{
			if (callback) callback();
		}

	}

	loop(0);
}

// Set current tanks weapon to the selected weapon in dropdown
function changeWeapon(){
	var selected = document.getElementById('player-weapon').selectedIndex;
	var tank = tanks[tankNo];
	tank.currentWeapon = selected;
	log('Change weapon:' + tank.weapons[selected].name);
}

/*
function airStrike(x){
	log('Air Strike Launching Projectiles. x:' + x);

	var tank = tanks[tankNo];
	var spread = tank.weapons[tank.currentWeapon].spread;
	tank.strikeLocation = x;
	tank.loaded = false;
	tank.strikesLeft--;

	log(tank.strikesLeft + " strikes left");

	if (tank.strikesLeft > 0) {
		tank.shellX = x + (Math.random() * spread * 2 - (spread*2));
		tank.shellY = 0;
		tank.vX = Math.random();
		tank.vY = -15;
		tank.fireAnim();
	}

	else{
		tank.strikeLocation = null;
		tank.strikesLeft = 0; //Number of air strikes
		tank.effectCanvas.getContext('2d').clearRect(0,0,resolution.x,resolution.y);
		nextTurn();
	}

}
*/

//Quickly display message on screen
function flashMessage(msg,fadeOut,color,callback){
	fadeOut = fadeOut || 1500;
	var msgDiv = document.getElementById('flash-message');
	msgDiv.innerHTML = msg;
	msgDiv.style.opacity = 1;
	msgDiv.style.paddingBottom = "0px";
	msgDiv.style.color = color || 'white';

	animate(fadeOut,function(progress){
		msgDiv.style.opacity = 1-progress;
		msgDiv.style.paddingBottom = (progress * 150) + 'px';
	},function(){
		msgDiv.style.opacity = 0;
		if (callback) callback();}

	);
}

// Populates player selection panels ( n= how many players)
function popPlayerSelect(n){
	var elem = document.getElementById('player-selection');
	elem.innerHTML = s = "";

	for (var i = 0; i < n; i++) {
		//var t = tanks[i];
		s += '<li class="player-select-box" style="background-color: ' + clrs[i][1] + '; ">';
		//s += '<p>' + t.name + ' Tank:</p>';
		//s += 'Type: ';
		var selected = i == 0 ? 0 : 1; //Blue default to human
		s += getDropdownHTML(['Human', 'Computer'], 'funcy', 'playerType' + i, selected);
		s += '</li>';
		//if (i!=n-1) s+=" vs ";
	}

	elem.innerHTML = s;

	log("Player selection panels created.");
}

function buy(name){

	log("Buy: " + name);

	var tank = tanks[tankNo];
	var cost = costMap[name];

	if (tank.money < cost){
		log("Not enough money");
		flashMessage("Not Enough Money!",1000,'red');
		return;
	}
	
	switch (name){
		case 'Health':
			if (tank.health < 100) tank.health += 25; 
			else {
				flashMessage("Health Already Max!",1000,'red');
				return;
			}
			tank.health = Math.min(tank.health,100);
			break;

		case 'Fuel': 
			tank.fuel += 25; break;

		case 'Shield':
			tank.shields += 1; break;

		case 'Targeting':
			tank.targeting += 1; break;

		case 'Medium Shell':
			tank.weapons[1].ammo += 1; break;

		case 'Large Shell':
			tank.weapons[2].ammo += 1; break;

		case 'Atomic Shell':
			tank.weapons[3].ammo += 1; break;

		case 'Cannon Ball':
			tank.weapons[4].ammo += 1; break;

		case 'Air Strike':
			tank.weapons[5].ammo += 1; break;

		case 'EMP':
			tank.weapons[6].ammo += 1; break;

		case 'Napalm':
			tank.weapons[7].ammo += 1; break;

		case 'Sniper Shell':
			tank.weapons[8].ammo += 1; break;
			
		case 'Flak Cannon':
			tank.weapons[9].ammo += 1; break;

	};

	// Purchase successful - play sound
	playSound('cash');

	//Deduct cost of item and update hud/store count
	flashMessage(name,1500,tank.clr);
	tank.money -= cost;
	updateStoreCounts();
	tank.draw();
	updateHud();
}

//Update all hud values
function updateHud(){
	//log('updateHUD');

	var name = document.getElementById('player-name');
	var health = document.getElementById('player-health');
	var position = document.getElementById('player-position');
	var angle = document.getElementById('player-angle');
	var force = document.getElementById('player-force');
	var gas = document.getElementById('player-gas');
	var money = document.getElementById('player-money');
	var blueScore = document.getElementById('blue-score');
	var redScore = document.getElementById('red-score');
	var orangeScore = document.getElementById('orange-score');
	var purpleScore = document.getElementById('purple-score');
	var weapon = document.getElementById('player-weapon');

	var tank = tanks[tankNo];
	name.innerHTML = tank.name;
	name.style.color = tank.clr;

	health.innerHTML = tank.health;
	position.innerHTML = Math.ceil(tank.x);
	angle.innerHTML = (tank.dangle > 90 ? 180-tank.dangle : tank.dangle) + 'Â°';
	force.innerHTML = tank.force;
	gas.innerHTML = tank.fuel;
	money.innerHTML = tank.money;
	blueScore.innerHTML = tanks[0].kills;
	redScore.innerHTML = tanks[1].kills;
	orangeScore.innerHTML = tanks[2].kills;
	purpleScore.innerHTML = tanks[3].kills;

	//Weapon Select Box
	for (i = 0; i < weapon.options.length; i++) {
		weapon.options[i].disabled = tank.weapons[i].ammo == 0;
	}
	weapon.selectedIndex = tank.weapons[tank.currentWeapon].ammo != 0 ? tank.currentWeapon : 0;
	
	//TODO: Why? 
	changeWeapon();

	//update grid info
	var infoPanel = document.getElementById('grid-info-panel');

	var f = tanks[tankNo].force;
	var a = tanks[tankNo].dangle;

	var angle = a * (Math.PI / 180);
	var pX = tanks[tankNo].barrelX;
	var pY = resolution.y - tanks[tankNo].barrelY;

	var vX = (Math.cos(angle) * f / 5)*3;
	var vY = (Math.sin(angle) * f / 5)*2;

	var s = "<p>Assume that all bullets have a mass of 1</p>";
	//s += "<p>Your opponents position: (<b>" + pXo.toFixed(2) + "</b> , <b>" + pYo.toFixed(2) + "</b>)</p>"
	s += "<p>Bullet initial velocity: <br>(<b>" + vX.toFixed(1) + "</b> , <b>" + vY.toFixed(1) + "</b>)</p>";
	s += "<p>Gravity acceleration: <br><b>" + gravityForce + "</b></p>";
	s += "<p>Your position: <br>(<b>" + pX.toFixed(1) + "</b> , <b>" + pY.toFixed(1) + "</b>)</p>";
	s += "<p>Bullet position after 1 second: <br>(<b>" + (pX + vX).toFixed(1) + "</b> , <b>" + (pY + vY - gravityForce).toFixed(1) + "</b>)</p>";
	s += "<button class='togglebtn' style='float:right;font-family:gameFont;' onclick='payToPlot();'>Plot It!<br>$50</button>"
	infoPanel.innerHTML = s;

	//Draw wind vector
	/*
	var windCanvas = document.getElementById('wind-vector-canvas');
	var ctx = windCanvas.getContext('2d');
	ctx.clearRect(0,0,windCanvas.width,windCanvas.height);

	if (windForce !== 0){
		var mag = (((Math.abs(windForce) / maxWindForce) * 15) + 5) -5;
		var x = windCanvas.width,
				y = windCanvas.height/2;
		if (windForce >= 0) {
			drawArrow(ctx, 7, y, x-mag, y, mag, '#00a8ff');
		}

		else {
			drawArrow(ctx,x-7, y,mag, y, mag, '#00a8ff');
		}
	}
	*/
}

function payToPlot(){
		if (tanks[tankNo].money < 50) {
			flashMessage('Not Enough Money',2000,'red');
			return;
		}
		else {
			flashMessage("GRAPHING ACTION!",2500,'orange');
		}

		tanks[tankNo].money -= 50;
		updateHud();
		drawGrid();

		//Trajectory
		//TODO: This is duplicated elsewhere
		var points = [];
		var tank = tanks[tankNo];
		var a = tank.dangle * (Math.PI / 180);
		var g = document.getElementById('grid-canvas').getContext('2d');
		var m = .5,
			n = 500,
			int = 5;

		var p = {x:tank.barrelX,y:tank.barrelY},
			v = {x:Math.cos(a) * tank.force / 5,
				 y:Math.sin(a) * tank.force / 5}
				 console.log(p,v);
		for (var i=0; i < n; i++){
			console.log("looping");
			v.y -= gravityForce * m;
			p.x += m * v.x * 3;
			p.y -= m * v.y * 2;
			var ht = terPts[Math.round(p.x)] - p.y;
			if (ht > 0) {
				points.push([p.x,p.y]);
			} else break;
		}
		console.log(points);
		drawParabola(g,tank.clr,points,int);
}

//Create tanks
function createTanks(){
	for (var i in tanks){
		tanks[i].cleanupAndRemove();
		tanks[i] = null;
	}

	tanks = [];
	for (var i = 0; i < tankMax; i++) {
		var tank = new Tank(i);
		tank.name = clrs[i][0];
		tank.clr = clrs[i][1];
		tank.aiq = false;
		tanks.push(tank);
	}

	log(tankMax + " tanks created");
}

//Play a sound depending on mute setting
function playSound(name){
	var muted = titleMute || document.getElementById('mute-control-checkbox').checked;
	if (!muted){
		log('play sound ' + name);
		var element = document.getElementById('sfx-'+name);
		if (element) element.play();
		else log("sound '" + name + "' does not exist");
	}

}

//Sets the version string for the game
function setVersion(str){
	log("Version=" + str);
	var els = document.getElementsByClassName("version-number");
	for (var i in els){
		els[i].innerHTML = str;
	}

}

function initRendering(){
	var tCanvas = createCanvas('terrain-canvas');
	var pCanvas = createCanvas('particle-canvas');
	var gCanvas = createCanvas('grid-canvas');
	screenResized();
}

//Assign event handlers to buttons to allow 'hold to increase' functionality;
function bindButtonHandlers(){

	//log("Creating UI button event handlers");

	var interval;

	//Change this to change how sensitive the buttons are (delay in ms)
	var default_dt = 170;

	//Ids and assosciated actions (some buttons are set to be less sensitive)
	var btnHandlers = [
		{ id:'move-left-button', 	dt:150,	action: function(){ move(-1); updateHud();}},
		{ id:'move-right-button', dt:150,	action: function(){ move(1); updateHud();}},
		{ id:'force-down-button',  action: function(){	forceDown(); updateHud();}},
		{ id:'force-up-button', 	action: function(){	forceUp(); updateHud();}},
		{ id:'angle-down-button',  action: function(){	angleDecrement(1); updateHud();}},
		{ id:'angle-up-button', 	 action: function(){	angleIncrement(1); updateHud();}},
		{ id:'angle-down-big-button', 		action: function(){	angleDecrement(5); updateHud();}},
		{ id:'angle-up-big-button', 			action: function(){	angleIncrement(5); updateHud();}}
	];

	//Stops button presses from repeating
	function stopIt(){
		window.clearInterval(interval);
		interval = null;
	}

	//Helper function to clear & set interval correctly for each button element
	function bindHandler(id,action,dt){
		var btn = document.getElementById(id);
		if (!btn) log("could not bind handler: " + id);
		btn.onmousedown = function(){
			action();
			window.clearInterval(interval);
			interval = window.setInterval(action,dt ? dt : default_dt);
		}

		btn.ontouchstart = function(){
			window.clearInterval(interval);
			interval = window.setInterval(action,dt ? dt : default_dt);
		};

		btn.onmouseup = stopIt;
		btn.onmouseout = stopIt;
		btn.ontouchleave = stopIt;
	}

	//Bind em all
	for (var i in btnHandlers){
		var h = btnHandlers[i];
		bindHandler(h.id,h.action,h.dt);
	}

	//Prevent any runaway timers
	document.body.onclick = stopIt;
	document.body.ontouchend = stopIt;
	document.body.ontouchleave = stopIt;
	document.body.onmouseup = stopIt;
	document.body.onmouseleave = stopIt;

	//Listen for keyboard events
	//window.addEventListener("keydown", key, false);
	document.body.onkeydown = key;
}

//AI function: Start turn
function aistt() {
	showHud(false);
	var t = tanks[tankNo];
	if (t.aiq){
		aishop();
		aiequip();
		t.aiDirn = (Math.random() > t.x / resolution.x) ? 1 : -1;
		aimove();
	}

}

//AI function : move
function aimove() {

	//log("aimove");
	var t = tanks[tankNo];

	if (!t.aiq) return;

	//if (t.driven < driveMax){
	if (t.fuel > 0){
		move(t.aiDirn);
	}

	else {
		log("ai tank out of fuel");
	}

	if (Math.random() > 0.25) { // chance to move
		timeouts.push(setTimeout(aimove, 200));
	} else {
		timeouts.push(setTimeout(aiplay,200));
	}

}

//AI function : equip weapon
function aiequip(){
	var t = tanks[tankNo];
	if (!t.aiq) return;

	for (var i=t.weapons.length-1; i>-1;i--){
		if (t.weapons[i].ammo > 0){
			t.currentWeapon = i;
			log("AI tank equips " + t.weapons[i].name);
			return;
		}

	}

	t.currentWeapon = 0;
}

//AI function : Shop for weapons and items
function aishop(){
	var t = tanks[tankNo];
	if (!t.aiq) return;

	var chanceToBuy;
	if (difficulty == 0) chanceToBuy = .1;
	else if (difficulty == 1) chanceToBuy = .3;
	else if (difficulty == 2) chanceToBuy = .6;
	else if (difficulty >= 3) chanceToBuy = .8;

	if (Math.random() > chanceToBuy) return;

 	
	function tryBuy(n){
		if (t.money >= costMap[n]){
			buy(n);
		} 
	}
	//Pick a random fraction of money to spend (minimum = half of money, maximum = 1000)
	//(maximum buys = difficulty)
	var buyRounds = 0;
	while ((buyRounds < difficulty) && (t.money > Math.max(Math.min(1000,Math.random() * t.money)),t.money/2)){
		buyRounds++;

		if (t.health < 50){
			tryBuy('Health');
		}

		//if (t.driven == driveMax){
		if (t.fuel == 0){
			tryBuy('Fuel');
		}

		if (Math.random() > .5 && t.shields < 3){
			tryBuy('Shield')
		}

		// The AI will prefer weapons in this order
		tryBuy('Napalm');
		tryBuy('EMP');
		tryBuy('Atomic Shell');
		tryBuy('Cannon Ball');
		tryBuy('Large Shell');
		tryBuy('Medium Shell');
		tryBuy('Sniper Shell');
		tryBuy('Targeting');
	}


}

//AI function : Fire
function aiplay() {
	var t = tanks[tankNo];
	if (!t.aiq) return;
	// More tries = more direct hits
	var tries = 10 - (2-difficulty);

	var triesData = [];

	var dmax = 1e11;
	//var best = [0, 0, 0];

	//Which direction are the other tanks
	var tanksLeft = 0, tanksRight = 0;
	for (var i=0; i < tankPlayers; i++){
		if(tanks[i].health > 0){
			if (tanks[i].x < t.x) tanksLeft++;
			else if (tanks[i].x > t.x) tanksRight++;
		}

	}

	if (t.dangle > 90 && tanksLeft == 0) t.dangle = 45;
	else if (t.dangle < 90 && tanksRight == 0) t.dangle = 135;

	for (var i = 0; i < tries; i++) {
		var f = t.force;
		var a = t.dangle;
		if (i > 0) {
			f += getRandomInt(-5, 5);
			a += getRandomInt(-25, 25);
		}

		var d = t.aifire(f, a);
		triesData.push([d,f,a]);
	}

	//Sort the attempted shots by smallest distance
	triesData.sort(function(a,b){
		if (a[0] < b[0]) return -1;
		if (a[0] > b[0]) return 1;
		return 0;
	});

	var chosenTry = triesData[Math.max(0,2-difficulty)];

	if (typeof t.lastShotDistance == "undefined"){
		t.lastShotDistance = 1e11;
	}

	log(triesData);

	if (t.lastShotDistance > chosenTry[0] || t.lastShotOutOfBounds){
		log('New shot setup: ' + chosenTry);
		t.lastShotDistance = chosenTry[0];
		t.force = chosenTry[1];
		t.dangle = chosenTry[2];
		//redraw();
		t.draw();
	}

	else {
		log("Using last shot setup");
	}

	t.fire();

}

function shakeScreen(){
	var shakeTime = .82;
	var gameEl = document.getElementById('game');
	gameEl.style.animation = "shake " + shakeTime + "s cubic-bezier(.36,.07,.19,.97) both"
	setTimeout(function(){gameEl.style.animation =""},shakeTime * 1000);
}

//Set background image
function setBackground(image){
	log("Set background: " + image);
	var div = document.getElementById('bg');

	div.style.backgroundImage = "url('" + image + "')";
}
function setGravity(n){
	gravityForce = n;
}

function setTerrain(n){
  log();
  terNo = n;
  setBackground(ters[n][0]);
  setGravity(ters[n][6])
  terPts = terrain(resolution.x, resolution.y+20, ters[n][2], ters[n][3]);
  //redraw();
  drawTerrain();
}

//Picks the next terrain in the list
function nextTerrain(){
	log("Choosing next terrain");
	terNo = (++terNo) % terMax;
  	setTerrain(terNo);
}

//Picks a random terrain from the list
function randomTerrain(){
	terNo = getRandomInt(0,terMax-1);
	log("Choosing random terrain: " + terNo);
  	setTerrain(terNo);
}

//Start new game
function newGame( id ) {
	log("newGame id=" + id);

	flashMessage("START!",1250);

	newRound = true;
	tankNo = 0;

	for (var i in timeouts){
		window.clearTimeout(timeouts[i]);
	}

	if (document.getElementById('wind-control-checkbox').checked){
		randomWind();
	}

	else {
		windForce = 0;
	}

	updateDifficulty();
	initPlayers();

	overQ = false;
	showCompassQ = true;
	showMainMenu(false);
	showHud(true);

	var terSelect = document.getElementById('terrain-select-box');
	if (terSelect.selectedIndex == 0){
		randomTerrain();
	}

	else{
		terNo = terSelect.selectedIndex - 1;
		setTerrain(terNo);
	}

	//particle_WeatherEnabled = false;
	particle_WeatherEnabled = Math.random() > .5;
	particles = [];
	resetTanks();
	drawTanks();
	updateHud();

	if(tanks[tankNo].aiq) {
		aistt();
	}

}

//Reset tanks money, score, & weapons/items
function newMatch(){
	demoModeEnabled =false;
	util.get('skip-ai-match-button').style.display="none";
	for (var i=0; i < tankPlayers;i++){
		var t = tanks[i];
		t.kills = 0;
		t.money = startingMoney;
		t.weapons.map(function(e,idx){
			if (idx == 0) return;
			e.ammo = 0;
		})

	}

}

function updateDifficulty(){
	if (document.getElementById("difficulty-easy").checked) difficulty = 0;
	if (document.getElementById("difficulty-normal").checked) difficulty = 1;
	if (document.getElementById("difficulty-hard").checked) difficulty = 2;
}

//Randomize wind vector
function randomWind(){
	windForce = Math.random() * maxWindForce;
	if (Math.random() >= .5) windForce *= -1;
	log('randomWind = ' + windForce);
}

//Reset all tanks for next match
function resetTanks(){
	log('Resetting tanks');
	var w = resolution.x;
	var range = w / 3,
		tankStts = [ [0, 45], [w - range, 135], [w * .25, 135], [w * .75,45] ];

	//Reset tanks
	for (var i = 0; i < tankPlayers; i++) {
		var tank = tanks[i];

		tank.reset();
		tank.x = Math.max(0,Math.min(tankStts[i][0] + Math.random() * range,w));

		tank.dangle = tankStts[i][1];
    	tank.aiq =false;

		var div = document.getElementById("playerType" + i);
		var s = div.options[div.selectedIndex].text;
		switch ( s ) {
			case 'Human':
				tank.aiq = false;
				break;
			case 'Computer':
				tank.aiq = true;
				break;
			default:
		}
	}
}

function updateAngleSlider(){
	var e = util.get('angle-range-control');
	var tank = tanks[tankNo];
	tank.dangle = Math.round(Number(e.value));
	tank.drawUI();
	playSound('aim');
	updateHud();
}

function updateForceSlider(){
	var e = util.get('force-range-control');
	var tank = tanks[tankNo];
	tank.force = Number(e.value);
	tank.drawUI();
	updateHud();
}

//Increase force
function forceUp(){
	var tank = tanks[tankNo];
	if (tank.force < 20) tank.force += 0.1;
	tank.force = Number(tank.force.toFixed(1));
	tank.drawUI();
	document.getElementById('force-range-control').value = tank.force;
}

//Decrease force
function forceDown(){
	var tank = tanks[tankNo];
	if (tank.force > 1) tank.force -= 0.1;
	tank.force = Number(tank.force.toFixed(1));
	tank.drawUI();
	document.getElementById('force-range-control').value = tank.force;
}

//Reduce angle
function angleDecrement( n ){
	n = n || 1;
	playSound('aim');
	var tank = tanks[tankNo];
	if (tank.dangle + n < 200) tank.dangle += n;
	tank.drawUI();
	document.getElementById('angle-range-control').value = tank.dangle;
}

//Increase angle
function angleIncrement( n ){
	n = n || 1;
	playSound('aim');
	var tank = tanks[tankNo];
	if (tank.dangle - n > -20) tank.dangle -= n;
	tank.drawUI();
	document.getElementById('angle-range-control').value = tank.dangle;
}

//Handle keyboard button press
function key( ev ) {
	//Remove focus from anything that might have it
	var mainMenuButton = document.getElementById('main-menu-button');
	mainMenuButton.focus();
	mainMenuButton.blur();

	//Cant do anything before reload or is AI player
	var tank = tanks[tankNo];
	if (!tank.loaded || tank.aiq) return;

	log("Handling key event ",ev)

	var tank = tanks[tankNo];
	var keyCode = ev.keyCode;
	var yesq = false;

	switch ( keyCode ) {
		case 37: // arrow lt
			angleDecrement(1);
			yesq = true;
			break;
		case 39: // arrow rt
			angleIncrement(1);
			yesq = true;
			break;
		case 38: // arrow up
			forceUp();
			yesq = true;
			break;
		case 40: // arrow dn
			forceDown();
			yesq = true;
			break;
		case 65: // a
			move(-1);
			yesq = true;
			break;
		case 68: // d
			move(1);
			yesq = true;
			break;
		default:
			break;
	}

	if (yesq) {
		ev.preventDefault();
	}

	//tank.draw();

	if (keyCode == 9 || keyCode == 13 || keyCode == 32) { // tab (9), enter (13) or space (32)
		fire();
		ev.preventDefault();
	}

	updateHud();
}

//Move current tank
function move( d ) {

	//TODO: weird mix of functional & OO Style going on

	log("move",d);
	var tank = tanks[tankNo];
	
	var newPosition = tank.x + (tank.moveIncrement * d);
	
	if (newPosition < 0 || newPosition > resolution.x){
		flashMessage('Out of bounds');
		return;
	}
	
	if (tank.fuel > 0){
		tank.move(d);
		playSound('move');
	}

	else {
		flashMessage('Out of Fuel');
	}

}

function drawTerrain(){
	
	var canvas = document.getElementById('terrain-canvas');
	var ctx = canvas.getContext('2d');

	// draw the terrain points
	log("drawing terrain");
	ctx.clearRect(0, 0, resolution.x, resolution.y);
	ctx.beginPath();
	var pattern = ctx.createPattern(document.getElementById(ters[terNo][5]),'repeat');
	ctx.fillStyle = pattern;
	ctx.strokeStyle = "rgba(0,0,0,.3)";
	ctx.lineWidth =2;
	ctx.moveTo(0, terPts[0]);

	for (var t = 1; t < terPts.length; t++) {
		ctx.lineTo(t, terPts[t]);
	}
	//log("Finished drawing points. Closing shape..");

	// finish creating the rect so we can fill it
	var w = resolution.x,
		h = resolution.y;
	ctx.lineTo(w + 5, terPts[t]);
	ctx.lineTo(w + 5, h + 5);
	ctx.lineTo(-5, h + 5);
	ctx.lineTo(-5, terPts[0] - 5);
	ctx.closePath();
	ctx.fill();
	ctx.stroke();

	//log("done");
}

//Tell all tanks to redraw themselves now
function drawTanks() {
	log('draw all the tanks');
	//draw tanks
	for (var i = 0; i < tankPlayers; i++) {
		log('draw tank: ' + i);
		if (tanks[i])tanks[i].draw();
	}

}

//Victory/defeat
function frag( fromTank, toTank ) {
	log("frag.. (aka tank kill)", fromTank, toTank);

	var deadTanks = 0;

	for (var i=0; i < tankPlayers; i++){		
		deadTanks += tanks[i].health <= 0 ? 1 : 0;
	}

	if (deadTanks == tankPlayers-1) {
		log('match is over')
		overQ = true;
	}

	if (titleMute) return;

	//Stop airstrike in progress
	//fromTank.strikesLeft = 0;

	if (fromTank.id == toTank.id) {
		s = "Destroyed Self!";
		flashMessage(fromTank.name + " Destroyed Self!",1500,fromTank.clr,function(){
			if (overQ) {
				var winner;
				for (var i=0; i<tankPlayers; i++) if (tanks[i].health > 0) {
					flashMessage(tanks[i].name + " Victory!", 1500, tanks[i].clr,newGame);
				}

			}

		});
	}

	else {
		fromTank.kills++;
		flashMessage(fromTank.name + ' Destroyed ' + toTank.name + '!',1500, fromTank.clr,
			function(){
				payTank(fromTank,winPayout);
				if (overQ) flashMessage(fromTank.name + " Victory!", 1500, fromTank.clr,newGame); 
			}

		);
	}

	updateHud();
}

//Current tank fire bullet
function fire() {
 	newRound =false;
	showHud(false);
	tanks[tankNo].fire();
}

function hideTitle(){
	newMatch();
  document.getElementById('main-menu-exit-button').style.display = "block";
  titleMute = false;
}

function showMainMenu(v){
	if (v == null) v = true;
	log("Show Main Menu: " + v);
  	var el = document.getElementById("main-menu");
	el.style.right = v ? "0" : "3000px";

	//el.style.display = v ? "block" : "none";
	showStoreMenu(false);
	showHud(!v);
	el.blur();
}

//Updates the item counts for all items in the store menu for the current player
function updateStoreCounts(){
	log('update store counts');
	var tank = tanks[tankNo];
	var valMap = {
		'health-item':tank.health,
		'fuel-item': tank.fuel,/*driveMax - tank.driven,*/
		'shield-item': tank.shields,
		'medium-shell-item' : tank.weapons[1].ammo,
		'large-shell-item' : tank.weapons[2].ammo,
		'atomic-shell-item' : tank.weapons[3].ammo,
		'cannon-ball-item' : tank.weapons[4].ammo,
		'air-strike-item' : tank.weapons[5].ammo,
		'emp-item' : tank.weapons[6].ammo
	}

	for (var i in valMap){
		var el = document.getElementById(i);
		if (el){
			var cnt = el.getElementsByClassName('item-count')[0];
			if (cnt) cnt.innerHTML = valMap[i];
		}
	}
}

function showStoreMenu(v){
	if (v == null) v = true;
	log("Show Items Menu: " + v);
  var el = document.getElementById("store-menu");
	el.style.bottom = v ? "0" : "200%";
	if (v) updateStoreCounts();
	showHud(!v);
}

function showHud(v){
	if (v == null) v = true;
	log('Show Hud: ' + v);
	var h = document.getElementById('hud');
	//h.style.top = v ? '0' : '-2000px';
	h.style.opacity = v ? ".75" : "0";

	var d = document.getElementById('disabler-div');
	d.style.display = v ? "none" : "block";

	/*
	var btn = document.getElementById("main-menu-button");
	btn.style.display = v ? "block" : "none";
	var btn2 = document.getElementById("show-grid-button");
	btn2.style.display = v ? "block" : "none";
	*/

}

function randomWinner(){
	log("pick random winner");
	console.log('pick random winner');
	var winner = null;
	while (!winner){
		var t = util.randomArray(tanks);
		if (t.health > 0) winner = t;
	}
	console.log('winner is ', winner);

	for (var i in tanks){
		if (tanks[i] !== winner){
			var data = {
				victim: tanks[i],
				aggressor: winner,
				type: "Napalm",
				damage: 300
			}
			doDamage(data);
		}
	}
}

function nextTurn() {
	log('Next Turn');

	//Crank up the difficulty if there are no human players. (Should end match quicker)
	var humans = 0;
	for (var i in tanks){
		if (!tanks[i].aiq && tanks[i].health > 0){
			humans++;
		}
	};
	
	if (humans < 1 && !demoModeEnabled && !skipAiRound) {
		util.get('skip-ai-match-button').style.display = 'block';
		difficulty = 25;
	}
	if (skipAiRound){
		console.log('skip AI Round');
		skipAiRound = false;
		randomWinner();
	}
	
	//If its a new round then don't switch player
	if (newRound) {
		return;
	}

	//Switch to Next player
	do { tankNo = (++tankNo) % tankPlayers; }

	while (tanks[tankNo].health <= 0)

	showCompassQ = true;
	tanks[tankNo].drawUI();

	if (!overQ) {
		showHud();
		var tank = tanks[tankNo];
		tank.loaded = true;
		if (tank.aiq) aistt(); //<---- AI function
	}

	else {
		showHud(false);
	}

	updateHud();

}

 // width and height are the overall width and height we have to work with, displace is
 // the maximum deviation value. This stops the terrain from going out of bounds if we choose
function terrain( width, height, hts, smooth ) {
	log('Creating terrain');

	var pts = [],
	// Gives us a power of 2 based on our width
	power = Math.pow(2, Math.ceil(Math.log(width) / (Math.log(2))));
	var htN = 0;
	var displace = height * hts[htN];
	// Set the initial left point
	pts[0] = height / 2 + (Math.random() * displace * 2) - displace;
	// set the initial right point
	pts[power] = height / 2 + (Math.random() * displace * 2) - displace;
	// Increase the number of segments
	for (var i = 1; i < power; i *= 2) {
		htN = Math.min(++htN, hts.length - 1);
		displace = height * hts[htN];

		// Iterate through each segment calculating the center point
		for (var j = (power / i) / 2; j < power; j += power / i) {
			pts[j] = ((pts[j - (power / i) / 2] + pts[j + (power / i) / 2]) / 2);
			pts[j] += (Math.random() * displace * 2) - displace;
		}

	}

	// smooth
	var sm = 1;
	var i = pts.length - 1;
	prev = pts[i];
	var currSlope = 0;
	while (i--) {
		var slope = pts[i] - prev;
		if (slope > currSlope) currSlope = Math.min(slope, currSlope + smooth);
		if (slope < currSlope) currSlope = Math.max(slope, currSlope - smooth);
		pts[i] = prev + currSlope;
		var prev = pts[i];
	}

	// fit on screen
	var i = pts.length - 1;
	var max = pts[i];
	var min = pts[i];
	while (i--) {
		max = Math.max(max, pts[i]);
		min = Math.min(min, pts[i]);
	}

	var above = height - terBottomOffset * 2 - max;

	// minimum
	i = pts.length;
	while (i--) {
		pts[i] += above;
		//pts[i] = Math.max(pts[i], terTopOffset);
	}

	return pts;
}

function getDistance(x1,y1,x2,y2){
	return Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) );
}

function getTanksTouching(x,y,r){
	var r = r || 20;
	var touching = []
	for (var i=0; i < tankPlayers; i++){
		var d = getDistance(x,y,tanks[i].x,tanks[i].y);
		if (d < r){
			touching.push(tanks[i]);
		}

	}

	return touching;
}

function doDamage(data){

	if (data.victim.health <= 0) return;

	shakeScreen();

	//Calculate damage reduced by shields
	var dmgMod = Math.floor(data.damage / (data.victim.shields + 1))

	//EMP Damage
	if (data.type == "EMP"){
		//flashMessage("EMP DISABLED SHIELDS & ENGINE",2000);
		log("EMP DISABLED SHIELDS, ENGINE, & TARGETING");
		data.victim.health -= (data.victim.health * .25);
		data.victim.fuel = 0;
		data.victim.shields = 0;
		data.victim.targeting = 0;
	}

	//Napalm damage
	else if (data.type == "Napalm"){
		log("Napalm damage: " + data.damage);
		data.victim.health -= dmgMod;
	}

	//Normal Damage
	else {
		//var dmg = Math.max(sz * 2 - d) << 0;
		log("Damage: " + data.damage);
		data.victim.shields = Math.max(0, data.victim.shields - 1);
		data.victim.health -= dmgMod;

	}

	//explode tank
	if (data.victim.health <= 0) {
		data.victim.explode(data.aggressor); 
	}

	data.victim.draw();

}

function drawSolidDot(ctx,color,x,y,r){
	r=r || 10;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x,y,r,0,2*Math.PI);
	ctx.fill();
}

function drawParabola(ctx,color,pts,inc,rad){
	//SPecial effects disabled
	document.getElementById('fx-control-checkbox');
	if (!util.get('fx-control-checkbox').checked) return;

	if (!inc) inc = 5;
	if (pts.length < 1) return;

	ctx.fillStyle = color || 'rgba(255,255,255,.3)';

	for (var i=1; i < pts.length; i+=inc){
		var r = rad || (i / pts.length * 4);
		ctx.beginPath();
		ctx.arc(pts[i][0],pts[i][1],r,0,2*Math.PI,false);
		ctx.fill();
	}

	//ctx.fillStyle = color;
}

function drawCompass (ctx, circleX, circleY, tickRadius ) {

	//log("Draw compass");
	var tickLen = 12;
	for (var i = -15; i <= 195; i += 15) {
		var angle = i * Math.PI / 180;
		if (i % 90) {
			ctx.strokeStyle = 'rgba(0,0,0,0.2)';
			ctx.lineWidth = 1;
		}

		else {
			ctx.strokeStyle = 'rgba(0,0,0,.8)';
			ctx.lineWidth = 1;
		}

		ctx.beginPath();
		var cX = circleX + Math.cos(angle) * tickRadius;
		var cY = circleY - Math.sin(angle) * tickRadius;
		ctx.moveTo(cX, cY);
		cX = circleX + Math.cos(angle) * (tickRadius + tickLen);
		cY = circleY - Math.sin(angle) * (tickRadius + tickLen);
		ctx.lineTo(cX, cY);
		ctx.stroke();
	}

}

function drawArrow(ctx, fromx, fromy, tox, toy, thick, color){
	var headlen = 1;
	var angle = Math.atan2(toy-fromy,tox-fromx);

	//Default values if none provided
	thick = thick || 2;
	color = color || clrs[tankNo][1];

	ctx.lineCap="round";
	ctx.strokeStyle = color;
	ctx.lineWidth = thick;

	//starting a new path from the head of the arrow to one of the sides of the point
	ctx.beginPath();
	ctx.moveTo(tox, toy);
	ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),toy-headlen*Math.sin(angle-Math.PI/7));

	//path from the side point of the arrow, to the other side point
	ctx.lineTo(tox-headlen*Math.cos(angle+Math.PI/7),toy-headlen*Math.sin(angle+Math.PI/7));

	//path from the side point back to the tip of the arrow, and then again to the opposite side point
	ctx.lineTo(tox, toy);
	ctx.lineTo(tox-headlen*Math.cos(angle-Math.PI/7),toy-headlen*Math.sin(angle-Math.PI/7));
	ctx.lineTo(fromx,fromy);
	ctx.stroke();
}

function drawVector(ctx,x,y,angle,magnitude){
	//Line length multiplier
	var d = 6 * magnitude;
	var opacity = Math.max(Math.min((magnitude/20),.8),.3);
	var vx = d * Math.cos(angle * (Math.PI/180)),
			vy = -d * Math.sin(angle * (Math.PI/180)),
			//rgb(255,189,14) orange-ish
			clr = 'rgba(255,189,14,'+ opacity +')'; // <--- change arrow opacity w/magnitude
	//Drawn a second time a little larger to give a subtle outline			
	drawArrow(ctx,x,y-5,vx + x,vy + y,magnitude+3,'rgba(0,0,0,'+opacity/3+')');
	drawArrow(ctx,x,y-5,vx + x,vy + y,magnitude+2,clr);
};

function resizeCanvas(c){
	c.width = document.body.offsetWidth;
	c.height = document.body.offsetHeight;
	c.width = resolution.x * ratio;
	c.height = resolution.y * ratio;
	var ctx = c.getContext('2d');
	ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
	ctx.translate(0.5,0.5);
}

//create new canvas (tank creates about 3 individual canvas' for compass and other stuff)
function createCanvas( id ) {
	//log("new canvas: " + id);
	var el = document.createElement('canvas');
	var div = document.getElementById('canvas-container');
	div.appendChild(el);
	el.id = id;
	resizeCanvas(el);
	return el;
}

function getRandomInt( min, max ) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDropdownHTML( opts, funcName, id, chkNo ) {
	var s = '';
	s += '<select id="' + id + '">';
	for (var i = 0; i < opts.length; i++) {
		var idStr = id + i;
		var chkStr = i == chkNo ? 'selected' : '';
		s += '<option id="' + idStr + '" value="' + opts[i] + '" style="height:21px;" ' + chkStr + ' >' + opts[i] + '</option>';
	}

	s += '</select>';
	return s;
}

function toggleGridInfo(){
	var c = document.getElementById('grid-info-panel');
	if (c.style.top == "0px") {
		c.style.top = "-250px";
		c.style.opacity = ".3";
	}

	else {
		c.style.top = "0px";
		c.style.opacity = "1";
	}

}

function toggleGrid(){
	var info = document.getElementById("grid-info-panel");
	var c = document.getElementById('grid-canvas');
	if (c.style.display == "none") {
		c.style.display = "block";
	}

	else {
		c.style.display = "none";
	}

	info.style.display = c.style.display;

}

function drawGrid(){

	var c = document.getElementById('grid-canvas');
	var ctx = c.getContext('2d');

	var w = resolution.x, 
		h = resolution.y;

	ctx.clearRect(0,0,w,h);

	var minor = 50;
	var major = 100;
	for (var i=0; i < w / minor;i++){
		if (i*minor % major == 0){
			ctx.fillStyle = 'white';
			ctx.strokeStyle = 'white';
			ctx.fillText(i*minor, i*minor, h-10);
		}

		else ctx.strokeStyle = 'rgba(0,0,0,.3)';
		ctx.beginPath();
		ctx.moveTo(i*minor,0);
		ctx.lineTo(i*minor,h);
		ctx.stroke();
	}

	for (var i=0; i < h/minor;i++){
		ctx.beginPath();
		if (i*minor % major == 0){
			ctx.fillStyle = 'white';
			ctx.strokeStyle = 'white';
			ctx.fillText(i*minor, 0, h - i*minor);
		}

		else ctx.strokeStyle = 'rgba(0,0,0,.3)';
		ctx.moveTo(0,i*minor);
		ctx.lineTo(w,i*minor);
		ctx.stroke();

	}

}

/* ####  BEGIN tank.js  ####*/

function Tank( n ) {

	log("New tank");
	this.x = 0;
	this.y = 0;
	
	this.moveIncrement = 5;
	
	this.vX = 0;
	this.vY = 0;
	
	this.shellX = -1000;
	this.shellY = -1000;
	this.shellPoints = [];
	this.dangle = 90;
	this.force = 10;

	this.frame = 0; //Current sprite animation frame

	this.health = 100;
	this.shields = 0;
	this.targeting = 0;
	this.fuel = 25;
	this.loaded = true;

	this.id = n;
	this.clr = 'blue';
	this.name = 'Blue';
	//this.size = 8;  // actually half length of tank
	this.kills = 0;
	this.money = startingMoney;
	this.weapons = [
		{name:'Small Shell',size:2,ammo:-1,damage:18},					// 0
		{name:'Medium Shell',size:3.3,ammo:0,damage:28},					// 1
		{name:'Large Shell',size:4,ammo:0,damage:37},					// 2
		{name:'Atomic Shell',size:4.5,ammo:0,damage:70},					// 3
		{name:'Cannon Ball',size:2.5,ammo:0,damage:30},						// 4
		{name:'Air Strike',size:1,ammo:0,damage:20,strikes:9,spread:200,blastTime:100},							// 5
		{name:'EMP',size:3,ammo:0,damage:100},										// 6
		{name:'Napalm',size:2,ammo:0,damage:10},			// 7
		{name:'Sniper Shell',size:1,ammo:0,damage:100},			// 8
		{name:'Flak Cannon',size:1,ammo:0,damage:0}			//9
		//{name:'Sniper Shell',size:1,ammo:0,damage:100}			// 10
	];
	this.currentWeapon = 0;
	this.aiq = false;
	this.aiDirn = 1;

	this.reset();

	this.uiCanvas = createCanvas('tank-' + this.id + "-ui-canvas");
	this.spriteCanvas = createCanvas('tank-' + this.id + "-sprite-canvas")
	this.effectCanvas = createCanvas('tank-' + this.id + "-effect-canvas");

	//this.effectCanvas.style.zIndex = 1;
	//this.effectCanvas = document.getElementById('particle-canvas');
	this.fireanim_lastframe = 0;
	this.fireanim_step = 16;
	this.fireanim_acc =0;
}

//Removes the left over canvases
Tank.prototype.cleanupAndRemove = function(){
	this.uiCanvas.remove();
	this.effectCanvas.remove();
	this.spriteCanvas.remove();
	this.isDeleted = true;
}

Tank.prototype.reset = function(){

	this.x = 0;
	this.y = 0;
	this.vX = 0;
	this.vY = 0;

	this.shellX = -1000;
	this.shellY = -1000;
	this.shellPoints = [];
	this.dangle = 90;
	this.force = 10;
	this.loaded = true;

	this.frame = 0; //Current sprite animation frame

	//this.health = 100;
	if (this.health <= 0) {
		this.health = 100;
		this.shields = 0;
		this.targeting = 0;
		this.fuel = 25;
	}
}

Tank.prototype.aifire = function ( force, dangle ) {

	log("Tank AI Fire");

	var best = 1e10;
	var worst = 1e10;
	var shellX = this.barrelX;
	var shellY = this.barrelY;

	var angle = dangle * (Math.PI / 180);

	var vX = Math.cos(angle) * force / 5;
	var vY = Math.sin(angle) * force / 5;

	shellX += vX * 2; // to move shell beyond barrel
	shellY -= vY * 2;

	var movingq = true;
	do {
		//vX += windForce;
		vY -= gravityForce;
		shellX += vX * 3;
		shellY -= vY * 2;

		if (shellX > 0 && shellX < resolution.x) {
			var xPos = shellX << 0;
			var yPos = terPts[xPos];
			var ht = yPos - shellY;

			if (ht > 0) {

				//.... do nothing

			} else {

				best = 1e10;
				worst = 1e10;
				// hit ground ... how close to any enemy?
				for (var j = 0; j < tankPlayers; j++) {
					var t = tanks[j];
					if (t.health > 0){
						if (t == this) {
							worst = Math.min(worst, Math.abs(xPos - t.x));
						} else { //ignore dead tanks
							best = Math.min(best, Math.abs(xPos - t.x));
						}

					}

				}

				movingq = false;
			}

		} else {
			movingq = false;
		}

	} while (movingq);

	var selfDmgDist = 60;
	if (worst < selfDmgDist) { // own shell landed near self
		//log("best, worst", best, worst);
		best += (selfDmgDist - worst) * 3;  // penalty:  further away the bette
		//log("best now", best);
	}

	return best;
};

Tank.prototype.move = function ( d ) {
	//log("Tank move", d, this.driven);
	//this.frame = !this.frame;
	//this.driven += Math.abs(d);
	this.fuel -= Math.abs(d);
	this.x += this.moveIncrement * d;
	this.draw();	
};

Tank.prototype.fire = function () {

  	newRound =false;

	var w = this.weapons[this.currentWeapon];

	log("Tank fires " + w.name);

	if (w.ammo === 0 || !this.loaded) {
		playSound('emptyclip');
		return;
	}

	showCompassQ = false;

	this.drawUI();

	if (this.health <= 0) return;

	playSound('fire');

	this.shellX = this.barrelX;
	this.shellY = this.barrelY;
	this.shellPoints = [];

	var angle = this.dangle * (Math.PI / 180);
	this.vX = Math.cos(angle) * this.force / 5;
	this.vY = Math.sin(angle) * this.force / 5;

	this.shellX += this.vX * 2; // to move shell beyond barrel
	this.shellY -= this.vY * 2;

	w.ammo -= 1;
	this.targeting = Math.max(0,--this.targeting);
	this.loaded = false;

	var weaponName = this.weapons[this.currentWeapon].name;

   //Special - Cannon Ball
	if (weaponName == 'Cannon Ball'){
		this.bombOnGround = false;
		this.bombTimer = 5000;
		this.fireAnim();
		this.muzzle();
	}

	//Airstrike
	else if (weaponName == 'Air Strike'){
		for (var i=0; i < 3; i++){
			var plane = particleFactory.plane(this);
			//plane.damage = this.weapons[5].damage;
		}
		this.endTurn();
	}

	//Special - Air Strike
	/*
	else if (this.weapons[this.currentWeapon].name == 'Air Strike'){
		log('preparing air strike');

		var tank = this;
		var crosshair = document.getElementById('crosshair');
		crosshair.style.display = "block";

		flashMessage("Tap or click location to strike!",1500,'white',function(){
			var elem = document.body;//document.getElementById('hud');
			elem.style.cursor = "pointer";
			elem.addEventListener('touch',callback)
			elem.addEventListener('click',callback)
			function callback(e){
				elem.style.cursor = "auto";
				crosshair.style.display = "none";
				log('Srike location selected: ' +e.clientX);
				tank.strikesLeft = tank.weapons[tank.currentWeapon].strikes;
				airStrike(e.offsetX);
				elem.removeEventListener('touch', arguments.callee);
				elem.removeEventListener('click', arguments.callee);
			};
			
		})
		//Exit function completely
		return;
	}
	*/
	//Special - Flak Cannon
	else if (weaponName == 'Flak Cannon'){
		//var _vx = this.vX * 100;
		//var _vy = this.vY * -100;
		//var _x = this.shellX;
		//var _y = this.shellY;
		
		var bullets_to_create = 10;
		var speed = 100;
		var spread = 30;

		for (var i=0; i<bullets_to_create; i++){
			//var r1 = Math.random();
			//var r2 = Math.random();
			var b = particleFactory.bullet(this);
			b.launch(this.shellX,this.shellY,this.vX*speed,this.vY*-speed,spread);
			//console.log(b.owner);
			//b.velocity.x = _vx * 3 * Math.max(.5,r1);// + (Math.random() * 2) - 1;
			//b.velocity.y = _vy * 3 * Math.max(.5,r2);// + (Math.random() * 2) - 1;
			//b.position.x = _x + (_x >= 0 ? i * r2* 5 : i * r1 * -5);
			//b.position.y = _y + (_y <= 0 ? i * r1 * 5 : i * r1 * -5); 
			//console.log(b);
		}
		//this.fireAnim();
		this.endTurn();
	}
	else{
		this.fireAnim();
		this.muzzle();
	};

};

Tank.prototype.fireAnim = function (ts) {
	//log('fireanim');

	var dt= (ts - this.fireanim_lastframe) || 0;
	this.fireanim_acc += dt;
	this.fireanim_lastframe = ts;

	if (this.isDeleted) return;

	//console.time('fireAnim');

	var g = this.effectCanvas.getContext('2d');
	//g.clearRect(0, 0, resolution.x, resolution.y);
	//this.draw();

	//this.vX += windForce;
	this.vY -= gravityForce;

	this.shellX += this.vX * 3;
	this.shellY -= this.vY * 2;
	
	//draw projectile
	if (this.fireanim_acc >= this.fireanim_step) {
		this.shellPoints.push([this.shellX,this.shellY]);
		this.drawProjectiles();
		this.fireanim_acc = 0;
	}

	//Shell within bounds
	if (this.shellX > 0 && this.shellX < resolution.x) {

		this.lastShotOutOfBounds = false;

		var xPos = this.shellX << 0; //TODO: What & why?
		var yPos = terPts[xPos];
		var ht = yPos - this.shellY;

		//Keep bullet flying if not touching tank or ground
		var touchingTanks = getTanksTouching(this.shellX,this.shellY);
		var weaponName = this.weapons[this.currentWeapon].name;
		if (ht > 0 && touchingTanks.length <= 0) {
			requestAnimationFrame(this.fireAnim.bind(this));   // added .bind(this) to end of this.animate
			if (weaponName == 'Napalm'){
				if (Math.random() > .6) { 
					var p = particleFactory.napalm(this);
					p.position.x = this.shellX;
					p.position.y = this.shellY;
					p.velocity.x = this.vX;
					p.velocity.y = 0;
					//p.velocity.y = this.vY;
				}

			}

		}

		//Projectile hit something
		else {

			log(weaponName + ' projectile impact');

			//Cannon ball rolls on ground
			if (weaponName == 'Cannon Ball'){

				//Cannon ball just hit ground
				if (!this.bombOnGround){
					log("Cannon ball hit ground")
					this.bombOnGround = true;
					this.bombStartTime = ts;
					this.bombTimer = 2500;
					requestAnimationFrame(this.fireAnim.bind(this));
				}

				//Cannon ball has been on the ground
				else{
					this.shellY = yPos;
					this.vY = 0;
					//this.vX -= 2 * windForce;
					this.vX *= .98;

					var nextPoint = this.shellX + this.vX;
					var nextY = terPts[nextPoint << 0];
					var uphill = nextY < yPos;
					if (uphill) {
						this.vx *= .4;
					}

					//Cannon ball is close to a tank
					var bombTouchingTank = false;
					for (var i=0; i < tankPlayers; i++){
						if (tanks[i].health > 0){
							var dx = Math.abs(tanks[i].x - this.shellX);
							var dy = Math.abs(tanks[i].y - this.shellY);
							if (dx < this.weapons[this.currentWeapon].damage &&
								dy < this.weapons[this.currentWeapon].damage){
									bombTouchingTank = true;
							}
						}
					}

					//Cannon ball timer has run out
					var elapsedTime = ts - this.bombStartTime;
					if (elapsedTime > this.bombTimer || bombTouchingTank){
						log("cannon ball exploded");
						this.loaded = true; // TODO: reload after a time?
						this.bang(this.shellX, this.shellY);
						this.bombOnGround = false;
					}

					//Cannon ball timer is still counting down
					else {
						requestAnimationFrame(this.fireAnim.bind(this));
					}

				}

			}

			//All other projectiles blow up
			else {
				log('this thing should blow up now');
				this.bang(this.shellX, this.shellY);
			}

		}

	}

	//Shell outside of bounds
	else{
		log("projectile out of bounds");

		this.lastShotOutOfBounds = true;
		/*
		if (this.weapons[this.currentWeapon].name == 'Air Strike'){
			//TODO: not working. Firings stops when missle is out of bounds
			//Fixed???
			log('airstrike shell is out of bounds, lets call airstrike() again');
			airStrike(this.strikeLocation);
		}
		*/

		//else{
			log('time to end turn');
			this.endTurn()
			/*
			//Fade bullet trail
			var ttlPoints = tanks[tankNo].shellPoints.length;
			var trailFadeTime = 700;
			var pointsPerTick = Math.ceil(trailFadeTime / (ttlPoints ? ttlPoints : 1));
			animate(trailFadeTime,function(progress){
				for (var i = 0; i < pointsPerTick; i++){
					tanks[tankNo].shellPoints.shift();
				}

				tanks[tankNo].drawProjectiles();
				//tanks[tankNo].draw();
			},function(){
				tanks[tankNo].shellPoints = [];
				//nextTurn();
			});
			*/
		//}

	}

};

//@param 'from' is the tank that caused the tank tank to explode
Tank.prototype.explode = function ( from ) {
	if (overQ) return;
	playSound('explode');
	var e = document.getElementById('explosion');
	var offsetX = this.effectCanvas.offsetLeft;
	var offsetY = this.effectCanvas.offsetTop;	
	e.style.top= (ratio * this.y - 20 + offsetX) + "px";
	e.style.left= (ratio * this.x - 20 + offsetY) + "px";
	e.src="images/sprites/explode.gif";
	//this.flashX = this.barrelX;
	//this.flashY = this.barrelY;
	log("tank explode");
	frag(from, this); 

};

Tank.prototype.muzzle = function () {
	log('muzzle');
	this.muzzleAnim();
};

Tank.prototype.muzzleAnim = function () {
	log('muzzleAnim');
	//var fireNow = performance.now();
	var fireNow = Date.now();
	var g = this.effectCanvas.getContext('2d');
	g.clearRect(0, 0, resolution.x, resolution.y);
	if (fireNow < 500) {
		g.fillStyle = '#ee0';
		g.beginPath();
		g.arc(this.barrelX, this.barrelY, fireNow / 70, 0, 2 * Math.PI);
		g.closePath();
		g.fill();
		requestAnimationFrame(this.muzzleAnim.bind(this));   // added .bind(this) to end of this.animate
	}

};

Tank.prototype.bang = function ( x, y) {
	log('bang');
	//effectFactory.explosion(x,terPts[Math.round(x)]);
	//var weaponName = 
	//Hide the shell
	this.shellX = -1000;
	this.shellY = -1000;

	//Record Point of explosion, time, and the used weapon
	this.bangX = x;
	this.bangY = y;
	//this.bangStt = performance.now(); //bang start time stamp
	this.bangStt = Date.now();
	this.lastFiredWeapon = this.currentWeapon;

	// blow up ground (if not EMP or Sniper)
	var sz = this.weapons[this.currentWeapon].damage;
	var xi = x << 0;
	var yHt = terPts[xi] + sz * 0.5; // hole depth
	var min = Math.max(0, xi - sz * 3) << 0;
	var max = Math.min(resolution.x, xi + sz * 3) << 0;

	if (this.weapons[this.currentWeapon].name != "EMP" && 
		this.weapons[this.currentWeapon].name != "Sniper Shell"){

		// Make a hole
		for (var i = min; i < max; i++) {
			var d = Math.abs(xi - i);
			d *= d / sz * 0.3;
			terPts[i] = Math.max(terPts[i], yHt - d);
			terPts[i] = Math.min(terPts[i], resolution.y - terBottomOffset);
		}

		//Special collision effects
		if (document.getElementById('fx-control-checkbox').checked){
			//Create particles
			var params = {
				n: sz*2,
				vx: ((this.vX * 30)),
				vy: ((this.vY * 2)) - (sz*2)-50,
				y: terPts[Math.round(x)]
			}

			//Dirt
			for (var i=0; i < params.n/2; i++){
				var p = particleFactory.dirt();
				p.position.x = x + (Math.random() * sz * 1.5) - (sz * .75);
				p.position.y = terPts[Math.round(x)];
				p.velocity.y += params.vy;
				p.velocity.x += params.vx;
			}

			//Fireworks
			for (var i=0; i < params.n; i++){
				var p = particleFactory.smoke();
				p.position.x = x + (Math.random() * sz/2) - (sz/4);
				p.position.y = y + 5;		
			}
		}

		//Napalm
		if (this.lastFiredWeapon == 7){
			for (var i=0; i < 50; i++){
				var p = particleFactory.napalm(this);
				p.position.x = x + (Math.random() * sz/2) - (sz/4);
				p.position.y = y;
			}
		}


	}

	// damage
	for (var i = 0; i < tankPlayers; i++) {
		
		tank = tanks[i];
		//if (tank == this ) continue;
		var d = Math.abs(tank.x - xi);

		if (tank.health >= 0 && (d < sz * 2)) {
			log('do damage');
			var dmgData = {
				victim: tank,
				aggressor: this,
				type: this.weapons[this.currentWeapon].name,
				damage: Math.round(sz * 2 - d)			
			}
			var weaponName = this.weapons[this.currentWeapon].name;

			//Sniper shell within distance
			if (weaponName == "Sniper Shell"){
				//check within range
				if (d < 16) {
					doDamage(dmgData);
					// Pay the tank.. unless it shot itself
					if (dmgData.victim !== dmgData.aggressor){			
						payTank(dmgData.aggressor,Math.round(hitPayout-(d*2)));
					}		
					flashMessage('Direct Hit!',1000,"#fff");			
				}
				else {
					flashMessage('Sniper Missed!',1000,"#fff");
				}

			}
			else {
				doDamage(dmgData);
				// Pay the tank.. unless it shot itself
				if (dmgData.victim !== dmgData.aggressor){			
					payTank(dmgData.aggressor,Math.round(hitPayout-(d*2)));
				}
			}
		}
	}

	// Atomic shell explosion
	if (this.lastFiredWeapon == 3){ 
		log('atomic shell explosion');
		var offsetX = this.effectCanvas.offsetLeft;
		var offsetY = this.effectCanvas.offsetTop;
		var e = document.getElementById('explosion-nuke');
		e.style.left= (ratio * this.bangX -80 + offsetX) + "px";
		e.style.top= (ratio * this.bangY -90 + offsetY) + "px";
		e.style.width="160px";
		e.style.height="114px";
		e.src="images/sprites/nuke.gif";
	}

	playSound('bang');
	this.bangAnim(); //This needs to happen to end the turn
	drawTerrain();
	drawTanks();	

};

Tank.prototype.endTurn = function(){
	log('tank endTurn');
	console.log('tank end turn');
	for (var i in particles){
		if (particles[i].owner === this){
			log('particles still in play. Waiting ');
			setTimeout(this.endTurn.bind(this),2000);
			return;
		}
	}

	clearParticleCanvas();

	var weaponName = this.weapons[this.currentWeapon].name;
	//if (weaponName == "Air Strike"){
		//airStrike(this.strikeLocation);
	//}

	//else {
		//this.draw();
		this.effectCanvas.getContext('2d').clearRect(0,0,resolution.x,resolution.y);

		log('Ok now its really time for next turn');
		nextTurn();
		/*
		//Fade bullet trail
		var ttlPoints = tanks[tankNo].shellPoints.length;
		var trailFadeTime = 700;
		var pointsPerTick = Math.ceil(trailFadeTime / (ttlPoints ? ttlPoints : 1));
		animate(trailFadeTime,function(progress){
			for (var i = 0; i < pointsPerTick; i++){
				tanks[tankNo].shellPoints.shift();
			}

			tanks[tankNo].drawProjectiles();
			//tanks[tankNo].draw();
		},function(){
			tanks[tankNo].shellPoints = [];
			nextTurn();
		});
		*/
	//}

}

// Animate projectile impact explosion
Tank.prototype.bangAnim = function () {

	//this.drawProjectiles();

	var g = this.effectCanvas.getContext('2d');
	g.clearRect(0, 0, resolution.x, resolution.y);

	//var elapsed = performance.now() - this.bangStt;
	var elapsed = Date.now() - this.bangStt;
	var progress = elapsed / 1000;

	//Make sure we know what type of weapon is exploding
	var weaponType = this.lastFiredWeapon ? this.weapons[this.lastFiredWeapon] :this.weapons[this.currentWeapon];

	//Total explosion animation time
	//var explosionTime = 800
	var explosionTime = weaponType.blastTime || 800;

  //Explosion radius
	var r = 4 * progress * weaponType.damage;

	if (elapsed < explosionTime) {

		var alpha = (1000 - elapsed) / 1000;

		//Explosion color
		if (weaponType.name == "EMP"){
			g.fillStyle = 'rgba(0,100,200,' + alpha + ')';
		}

		else if (weaponType.name == "Atomic Shell"){
			g.fillStyle = 'rgba(220,255,10,' + alpha + ')';
		}

		else {
			g.fillStyle = 'rgba(200,100,0,' + alpha + ')';
		}

		g.beginPath();
		g.arc(this.bangX, this.bangY, r, 0, 2 * Math.PI);
		g.closePath();
		g.fill();

		g.fillStyle="rgba(255,100,100,.2)";
		g.beginPath();
		g.arc(this.bangX, this.bangY, r/2, 0, 2 * Math.PI);
		g.closePath();
		g.fill()

		requestAnimationFrame(this.bangAnim.bind(this));   // added .bind(this) to end of this.animate
		//requestAnimationFrame(this.bangAnim);
	}

	//animation complete
	else {
		/*
		if (this.lastFiredWeapon == 5){
			airStrike(this.strikeLocation);
		}
		

		else */
		this.endTurn();
		//if (typeof(callback) != 'undefined') callback();
	}

};

Tank.prototype.drawSprite = function(){

	var tankWidth = 26,
		tankHeight = 18;

	//Position on top of terrain
	this.y = terPts[this.x << 0];

	var g = this.spriteCanvas.getContext('2d');
	var w= resolution.x, 
		h= resolution.y;
	g.clearRect(0, 0, w, h);

	//Draw tank sprite
	function getImg(name,frame){
		return document.getElementById(name.toLowerCase() + "-tank-" + frame + "-img");
	}

	img = getImg(this.name,this.frame+1);
	if (this.health <= 0) img = getImg('dead',1);
	g.drawImage(img,this.x-tankWidth/2,this.y-tankHeight/1.1,tankWidth,tankHeight);

	// Draw shields
	if (this.shields > 0){
		var r = (this.shields + 15);
		//log('shield radius= '+r);
		var grd = g.createRadialGradient(this.x, this.y-20, r/4, this.x, this.y, r*2);
		grd.addColorStop(0, 'rgba(0,189,240,.2)');
		grd.addColorStop(0.8, 'rgba(0,200,255,.7)');
		grd.addColorStop(.9, 'rgba(0,189,240,0)');
		grd.addColorStop(1, 'rgba(0,0,0,0)');
		g.fillStyle = grd;
		g.fillRect(this.x-100, this.y-100, 200, 200);
	}

}

//Bullets,trajectories
Tank.prototype.drawProjectiles = function(){
	var g = this.effectCanvas.getContext('2d');
	g.clearRect(0,0,resolution.x,resolution.y);

	//Draw Shell Parabola (Bullet trails)
	if (this.shellPoints.length > 0){
		drawParabola(g,this.color,this.shellPoints,2);
	}

	//Draw Shell
	var ht = terPts[Math.round(this.shellX)] - this.shellY;
	if (ht > 0){
		g.fillStyle = this.clr;
		g.lineWidth = 1;
		g.strokeStyle = 'rgba(0,0,0,.1)';
		g.beginPath();
		var r = this.weapons[this.currentWeapon].size;
		g.arc(this.shellX, this.shellY, r, 0, 2 * Math.PI);
		g.closePath();
		g.fill();
		g.stroke();
	}

}

Tank.prototype.drawUI = function(){

	var g = this.uiCanvas.getContext('2d');
	g.clearRect(0,0,resolution.x,resolution.y);

	// draw barrel
	var sz = 12,
		barrelOffset = { x:0, y:-sz * 0.8 },
		barrelLength = sz * 1.5,
		barrelWidth = sz * 0.2,
		angle = this.dangle * (Math.PI / 180);

	//These should only ever be drawn for active player
	if (this.id == tankNo && showCompassQ) {

		var userAng = this.dangle;
		if (userAng > 90) userAng = 180 - userAng;

		// Draw force vector
		drawVector(g,this.x + barrelOffset.x, this.y + barrelOffset.y/2,this.dangle,this.force);

		// Draw force & angle text
		g.textAlign = 'center';
		g.font = '16px uiFont';
		g.fillStyle = this.clr;
		g.fillText(userAng + '\u00B0', this.x, this.y - 55);
		g.font = '14px uiFont';
		g.fillText(this.force, this.x, this.y + 20);


		//Compass hashmarks
		drawCompass(g, this.x + barrelOffset.x, this.y + barrelOffset.y/2, 25);

		//Trajectory
		//TODO: This is duplicated elsewhere
		var points = [];
		var tank = this;
		var a = tank.dangle * (Math.PI / 180);
		var m = .5,
			n = 50 * tank.targeting,
			int = 5;
		var p = {x:tank.barrelX,y:tank.barrelY},
			v = {x:Math.cos(a) * tank.force / 5,
				 y:Math.sin(a) * tank.force / 5}
		for (var i=0; i < n; i++){
			v.y -= gravityForce * m;
			p.x += m * v.x * 3;
			p.y -= m * v.y * 2;
			var ht = terPts[Math.round(p.x)] - p.y;
			if (ht > 0) {
				points.push([p.x,p.y]);
			} else break;
		}
		drawParabola(g,tank.clr,points,int);
		
	}

	if (this.health > 0){

		//Health Bar
		g.fillStyle = "lime";
		g.fillRect(this.x - 12,this.y + 5, this.health/100 * 24,2);
		g.fillStyle = this.clr;

		// Draw barrel
		g.strokeStyle = this.clr;
		g.lineWidth = barrelWidth;
		g.lineCap = "butt";  // butt|round|square
		g.beginPath();
		g.moveTo(this.x + barrelOffset.x, this.y + barrelOffset.y);

		this.barrelX = this.x + Math.cos(angle) * barrelLength;
		this.barrelY = this.y - 8 - Math.sin(angle) * barrelLength;

		g.lineTo(this.barrelX, this.barrelY);
		g.stroke();
	}

	//g.fillText(this.health + '%', this.x, this.y + 15);
}

Tank.prototype.draw = function () {
	this.drawSprite()
	this.drawUI();
};

/* ####  BEGIN particles.js  ####*/

// ==============================================
// 		Particle Rendering
// ==============================================

var particles = [];
var particles_pool = [];
var particlesToRemove = [];
var particleFrame = 0;
var particleAcc = 0;
var particleStep = 28 //ms - lower=smoother
var weatherAcc = 0;
var particleBounds = getBounds();

function clearParticleCanvas(){
	var c = util.get('particle-canvas');
	var ctx = c.getContext('2d');
	ctx.clearRect(0,0,resolution.x,resolution.y);
}

function getNewParticle(owner){
	if (particles_pool.length > 0){
		var p = particles_pool[0];
		particles_pool.splice(0,1);
		p.reset();
		p.owner = owner;
		return p;
	}
	return new Particle(owner);
}

function getBounds(arr){ 
	if (!arr || !Array.isArray(arr) || arr.length < 1 ) return {x:0,y:0,w:0,h:0}

	var minX = arr[0].x,
	    minY = arr[0].y,
		maxX = minX + arr[0].w,
		maxY = minY + arr[0].h;
	
	//for (var i=1; i<arr.length; i++){
	arr.map(function(){
		minX = Math.min(arr[i].x,minX);
		minY = Math.min(arr[i].y,minY);
		maxX = Math.max(arr[i].x+arr[i].w, maxX);
		maxY = Math.max(arr[i].y+arr[i].h, maxY);
	});

	return {
		x:minX,
		y:minY,
		w:maxX - minX,
		h:maxY - minY
	}
}

function removeDeadParticles(){
	if (particlesToRemove.length > 0){
		//var redraw_terrain = false;
		particlesToRemove.forEach(function(e){
			//if (e.corrosive && (e.getAltitude() < e.size)) redraw_terrain = true;
			particles_pool.push(e);
			var idx = particles.indexOf(e);
			if (idx > -1) particles.splice(idx,1);
		})
		particlesToRemove = [];
		//if (redraw_terrain) drawTerrain();
	}
}



//Update & render all particles
function updateParticles(ts){

	var ctx = util.get('particle-canvas').getContext('2d');
	var dt= (ts - particleFrame) || 0;
	particleAcc += dt;
	particleFrame = ts;

	//Weather Particles
	weatherAcc += dt;
	//SPecial effects disabled
	var sfx_enabled = util.get('fx-control-checkbox').checked;

	//Update weather particles?
	if (weatherAcc > 300 && particle_WeatherEnabled && sfx_enabled){
		for (var i=0; i < 3; i++){
			weatherAcc = 0;
			var x = Math.floor(Math.random() * resolution.x);
			var p;
			//Only if snow terrain
			if (terNo == 2) {
				p = particleFactory.snow();
				p.position.y = 0;
				p.position.x = x; 
			}
		}
	}


	//RENDER
	//var doRender = particleAcc > particleStep ? true  : false;	
	while (particleAcc >= particleStep){
		
		particleAcc -= particleStep;
		//if (particleAcc >= particleStep * 3) particleAcc = 0;
		
		ctx.clearRect(particleBounds.x,particleBounds.y,particleBounds.w,particleBounds.h);
		removeDeadParticles();

		//UPDATE & RENDER (only clear rectangle area containing particles)
		if (particles.length > 0){
			var r = particles[0].getBounds();
			var minX = r.x,
				minY = r.y,
				maxX = minX + r.w,
				maxY = minY + r.h;

			for (var i=0; i< particles.length;i++){	
				if (particles[i].onUpdate){
					particles[i].onUpdate(particleStep);
				}
				var r = particles[i].getBounds();
				
				minX = Math.min(r.x,minX);
				minY = Math.min(r.y,minY);
				maxX = Math.max(r.x+r.w, maxX);
				maxY = Math.max(r.y+r.h, maxY);

				//rects.push(particles[i].getBounds());
				particles[i].update(particleStep/1000);
				particles[i].render();
			}		
			particleBounds = {x:minX,y:minY,w:maxX-minX,h:maxY-minY};
		}
	}
	requestAnimationFrame(updateParticles);
}

//Remove Particle
function removeParticle(particle){
	//console.log('remove particle');
	particle.disabled = true;
	particlesToRemove.push(particle);
}

//position, width, depth
function holeInTheGround(x, w, d){
	for (var i = x - w; i < (x + w); i++){
		d1 = d - Math.abs(x-i);
		//lower terrain
		terPts[Math.round(i)] =  Math.min(resolution.y- terBottomOffset, terPts[Math.round(i)] + d1);
	}	

	//High damage spawns dirt
	if (d > 20){
		//Dirt
		for (var i=0; i < 10; i++){
			var p = particleFactory.dirt();
			p.position.x = x + (Math.random() * 5) - (2.5);
			p.position.y = terPts[Math.round(x)]-3;
			p.velocity.y = -Math.random() * 100;
			p.velocity.x += Math.random() * 30 - 15
		}	
	}
	drawTerrain();
	drawTanks();
}

//Particle (Base class)
// Tanks wait for any particles they own to finish 
// animating before handing over game to next player
function Particle(owner){
	this.reset();
	this.owner = owner;
}

Particle.prototype.getBounds = function(){
	var s = this.size*2;
	var x = this.position.x; 
	var y = this.position.y; 

	var r = {x:0,y:0,w:s,h:s};
	if (this.type == "ball"){
		r.x = x - r.w/2 - 1;
		r.y = y - r.h/2;
	}
	else if (this.type == "block"){
		r.x = x -1;
		r.y = y -1;
	}
	return r;
}

Particle.prototype.reset = function(){
	this.disabled = false;
	this.corrosive = false;
	this.owner = null;
	this.damage = 0;
	this.size = 25;
	this.time = 0;
	this.maxTime = 0;
	this.position = {x:0, y:0};
	this.velocity = {x:0, y:0};
	this.bombTime = 0;// + (Math.random() * 400);
	this.bombAcc = 0;
	this.type = Math.random() > .5 ? "ball" : "block";	
	this.color = "purple";
	this.physical = true; //affected by terrain
	this.hasMass = true; // affected by gravity
	this.hasWindResistance = false; // slows lateral movement due to air resistance
	this.onUpdate = null;
	this.image = null;
}

Particle.prototype.launch = function(x,y,vx,vy,drift){
	drift = drift || 0;
	this.position.x = x + (Math.random()*(drift/2)) - drift/4;
	this.position.y = y + (Math.random()*(drift/2)) - drift/4;
	this.velocity.x = vx + (Math.random()*drift) - drift/2;
	this.velocity.y = vy + (Math.random()*drift) - drift/2;
}

Particle.prototype.getAltitude = function(){
	return terPts[Math.round(this.position.x)] - this.position.y;
}

Particle.prototype.update = function(deltaTime){
	
	// Add velocity & gravity
	this.position.x += this.velocity.x * deltaTime;
	this.position.y += this.velocity.y * deltaTime ;

	if (this.hasMass){
		this.velocity.y += gravityForce * 100;
		//this.velocity.x += -this.velocity.x * .01;
	}
	if (this.hasWindResistance){
		this.velocity.x -= this.velocity.x * .01;
	}

	// Particle expired
	if (this.maxTime > 0 ){
		this.time += deltaTime;
		if (this.time >= this.maxTime) removeParticle(this);
	}

	// Remove particle if out of bounds
	if (this.position.x < 0 || this.position.x + this.size > resolution.x ||
		(this.position.y < -100) || this.position.y + this.size > resolution.y) {
		removeParticle(this);
	}

	//Corrosive particles damage tanks
	if (this.corrosive){
		if (this.owner){
			var arr = getTanksTouching(this.position.x,this.position.y,this.size*2);
			for (var i in arr){
				var data = {
					victim: arr[i],
					aggressor: this.owner,
					type: "Napalm",
					damage: this.damage
				}
				doDamage(data);
				removeParticle(this);
			}
		}
	}

	//Keep above ground
	if (this.physical){
		var h = this.getAltitude(); //terPts[Math.round(this.position.x)] - this.position.y;
		if (h <= 0) {
			
			//Corrosive particles destroy ground
			if (this.corrosive){
				holeInTheGround(this.position.x,this.size,this.size)
				drawTerrain();
				drawTanks();
				removeParticle(this)
			}
							
			else{
				this.position.y = terPts[Math.round(this.position.x)];
				this.velocity.y = 10;
			}
				
		}
	}
}

// Draw that there particle
Particle.prototype.render = function(){
	var ctx = util.get('particle-canvas').getContext('2d'); 
	ctx.strokeWidth = 0;
	ctx.strokeStyle = this.color;
	ctx.fillStyle = this.color;

	if (this.type == "block"){
		ctx.fillRect(this.position.x,this.position.y,this.size,this.size);
	}

	else if (this.type == "ball"){
		ctx.beginPath();
		ctx.arc(this.position.x,this.position.y,this.size/2,0,2 * Math.PI)
		ctx.fill();
	}
	if (this.image){
		ctx.drawImage(this.image,this.position.x,this.position.y,this.size,this.size);
	}
}

// This object is used to quickly create particle types. The game waits for any particles with owners to finish 
// animating before moving to next players turn
var particleFactory = {
	bullet: function(owner){
		var p = getNewParticle(owner);
		p.corrosive = true;
		p.physical = true;
		p.hasMass = true;
		p.damage = 15;
		p.size = 5;
		p.time = 0;
		p.maxTime = 2000;
		p.velocity.x = 10;
		p.velocity.y = -10;
		p.color = 'black';

		particles.push(p);
		return p;
	},
	
	napalm: function(owner){
		var p = getNewParticle(owner);
		p.corrosive = true;
		p.physical = true;
		p.hasMass = true;
		p.hasWindResistance = true;
		p.damage = 10;
		p.size = Math.random() * 3 + 2;
		p.time = 0;
		p.maxTime = Math.random() * 6 + 4;
		p.velocity.x = Math.random() * 250 - 125;
		p.velocity.y = -Math.random() * 150 - 75;
		p.color = '#fbe658';
		var r = Math.random();
		if (r < .3) p.color = '#4b4044';
		else if (r < .6) p.color = '#aa2316';
		else if (r < .9) p.color = '#fa5429';

		particles.push(p);
		return p;
	},
	snow: function(owner){
		var p = getNewParticle(owner);// new Particle();
		p.size = Math.random() * 5 + 2;
		p.hasMass = false;
		p.time = 0;
		p.velocity.y = Math.random() * 100 + 50;
		p.maxTime = Math.random() * 20;
		p.color = 'white';
		particles.push(p);
		return p;
	},
	dirt: function(owner){
		var p = getNewParticle(owner);// new Particle();
		p.size = Math.random() * 3 + 2;
		//p.size = 20;
		p.time = 0;
		p.velocity.x = Math.random() * 40 - 20;
		p.velocity.y = Math.random() * 40 - 20;
		p.maxTime = Math.random() * 2;
		p.color = ters[terNo][1];
		particles.push(p);
		return p;
	},
	shrapnel: function(owner){
		var p = getNewParticle();// new Particle();
		p.size = Math.random() * 4 + 2;
		p.velocity.x = 200 * Math.random() - 100
		p.velocity.y = 200 * Math.random() - 100;		
		p.time = 0;
		p.type='ball'
		var r = Math.random();
		p.maxTime = r;
		p.velocity.x = Math.random() * 30 - 15;
		p.velocity.y = Math.random() * 30 - 15;
		if (r < .8) p.color = "rgba(255,0,0,.3)";
		else p.color = "rgba(200,100,0,.2)";
		particles.push(p);
		return p;
	},
	smoke: function(owner){
		var p = getNewParticle(owner);// new Particle();
		var r = Math.random();
		if (r > .3) p.color = 'rgba(0,0,0,.5)';
		else p.color = 'rgba(255,0,0,.5)';
		p.physical = false;
		p.hasMass = false;
		p.time = 0;
		p.maxTime =r < .6 ? Math.random() * 2.5 : r * 1.8;
		p.size = Math.random() * 3 + 1
		//p.size = 20;
		p.velocity.x = 30 * Math.random() - 15
		p.velocity.y = Math.random() * -50;
		particles.push(p)
		return p;
	},
	plane: function(owner){
		var p = getNewParticle(owner);// new Particle();
		p.color = "rgba(0,0,0,0)";
		p.image = util.get('plane-img');
		p.size = 40;
		p.position.x = 0;
		p.position.y = 10 + (Math.random() * 30);
		p.physical = false;
		p.hasMass = false;
		p.time = 0;
		p.maxTime = 5000;
		p.velocity.x = 100 + (Math.random() * 200);
		p.velocity.y = 0;		

		//var emitter = new ParticleEmitter(particleFactory.bomb,1000);
		p.bombTime = 500;// + (Math.random() * 400);
		p.bombAcc = p.bombTime;
		p.onUpdate = function(dt){
			p.bombAcc+= dt;
			if (p.bombAcc >= p.bombTime){
				p.bombAcc = 0;
				var dist = 99999;
				if (p.owner){
					dist = Math.abs((p.owner.x + 13) - (p.position.x + p.size /2 ));
					if (p.position.x < p.owner.x) dist -= p.velocity.x * .2;
				}
				if (dist > 60) {
					var b = particleFactory.bomb(p.owner);
					b.position.x = p.position.x + p.size / 2;
					b.position.y = p.position.y + p.size;
					b.velocity.x = p.velocity.x * .1;
					b.velocity.y = 10;
				}
			}
		}
		//p.size = 20;

		particles.push(p);
		return p;
	},
	bomb: function(owner){
		var p = getNewParticle(owner);// new Particle();
		p.color = "rgba(0,0,0,0)";
		p.image = util.get('bomb-img');
		p.size = 25;
		p.physical = true;
		p.hasMass = true;
		p.corrosive = true;
		p.hasWindResistance = true;
		p.damage = 35;
		p.time = 0;
		p.maxTime = 5000;
		//p.size = 20;
		particles.push(p);
		return p;
	}

}

/*
util.get('game').onclick = function(e){
	particleFactory.plane();
};
*/


function ParticleEmitter(func,delay){
	this.delay = 100;
	this.acc = 0;
	this.particleFunc = func;	
	this.position = {x:0,y:0};
	this.velocity = {x:0,y:0};
}
ParticleEmitter.prototype.update = function(dt){
	this.acc += dt;
	if (this.acc > this.delay){
		this.acc = 0;
		this.position.x += this.velocity.x * dt;
		this.position.y += this.velocity.y * dt;
		if (this.particleFunc) this.particleFunc();
	} 
}