
'use strict';

const kStartMsg = 'Land the ship on the flat pads. Use left/right arrows to rotate and up/down arrows to control thrust.';
const kLandMsg = 'The Eagle has landed! Increase thrust to take off again.';
const kCrashMsg = 'You just blew a billion dollar hole in NASA\'s budget. Sad!<br\>(reload to try again)';

class LuniTwo {
  constructor() {
    this.two = new Two({
      fullscreen: false,
      autostart: true,
      width: window.innerWidth,
      height: window.innerHeight
    }).appendTo(document.getElementById('app'));

    window.onresize = debounce(() => this.resize(), 200);

    this.dark = true

    this.keyboard = new KeyboardController({
      ArrowLeft:  () => this.ship.av -= this.ship.rotation <= Math.PI/2 && this.ship.rotation >= -Math.PI/2 ? 0.0005 : 0.0002,
      ArrowRight: () => this.ship.av += this.ship.rotation <= Math.PI/2 && this.ship.rotation >= -Math.PI/2 ? 0.0005 : 0.0002,
      ArrowUp:    () => this.ship.engineLevel += 1,
      ArrowDown: () => this.ship.engineLevel -= 1
    }, 60);

    this.touch = new TouchController({
      left:  () => this.ship.av -= this.ship.rotation <= Math.PI/2 && this.ship.rotation >= -Math.PI/2 ? 0.0005 : 0.0002,
      right: () => this.ship.av += this.ship.rotation <= Math.PI/2 && this.ship.rotation >= -Math.PI/2 ? 0.0005 : 0.0002,
      up:    () => this.ship.engineLevel += 1,
      down: () => this.ship.engineLevel -= 1
    });

    this.statusLabel = new Label('status', {dark: this.dark });
    this.statusLabel.showHTML(kStartMsg, 7000);

    this.vxLabel = new Label('vx', { label: 'v<sub>x</sub>', plusSign: '→', minusSign: '←', dark: this.dark });
    this.vyLabel = new Label('vy', { label: 'v<sub>y</sub>', plusSign: '↓', minusSign: '↑', dark: this.dark });
    this.rtLabel = new Label('rotation', { label: 'r:', plusSign: '↻', minusSign: '↺', dark: this.dark });
    this.fuelLabel = new Label('fuel', { label: 'fuel:', plusSign: '', minusSign: '-', dark: this.dark });
    this.fuelMonitorLabel = new Label('fuelMonitorLabel', { label: 'Monitor fuel ?', plusSign: '', minusSign: '', dark: this.dark});

    this.state = this.startingState;
  }

  resize() {
    this.two.width = window.innerWidth,
    this.two.height = window.innerHeight;
    this.two.update()
  }

  // each game state method performs an action for that state and returns a next state
  startingState() {
    this.terrain = new Terrain(this.two, -8192, 16384, this.two.height, 16, this.dark);
    this.ship = new Ship(this.two, 0, -1200);
    this.ship.rotation = Math.PI/2;
    this.ship.v = new Two.Vector(0.1, 0.0);

    this.ship.monitorFuel = false
    this.fuelCheckChange( false )


    this.camera = new Camera(this.two, this.cameraTransform());
    return this.flyingState;
  }

  cameraTransform() {
    const minScale = 0.1, maxScale = 1.5

    // aim below the ship vertically, more at higher altitudes
    // aim behind the ship horizontally, more at higher speeds
    let horizon = this.terrain.horizonAtX(this.ship.translation.x);
    const altitude = horizon.y - this.ship.translation.y;

    const scale = 0.50 * this.two.height / Math.abs(altitude);
    const horizontalLag = this.ship.v.x * (this.two.width / scale);

    const translation = {
      x: this.ship.translation.x - horizontalLag,
      y: horizon.y - (altitude / 3.0)
    }
    //debugDraw('halff', translation, "black", 1 );

    return { translation, scale: Math.min(maxScale, Math.max(minScale, scale)) };
  }

  flyingState() {
    this.ship.tick();

    const cameraTransform = this.cameraTransform()
    this.camera.setTranslation(cameraTransform.translation);
    this.camera.setScale(cameraTransform.scale);

    // App calculates in px/ms.  px/ms * m/px * s/ms = m/s (???)
    const landable = this.ship.landable();
    const okTextColor = this.dark ? 'white' : 'black'
    this.vxLabel.setNumber(landable.vx * 100, landable.vxOkay ? okTextColor : 'red');
    this.vyLabel.setNumber(landable.vy * 100, landable.vyOkay ? okTextColor : 'red');
    this.rtLabel.setNumber(landable.rotation * 180 / Math.PI, landable.rotationOkay ? okTextColor : 'red', '°');
    this.fuelLabel.setNumber( this.ship.fuelLevel, this.ship.fuelLevel > 250 ? okTextColor : 'red');

    const nextState = { flying: this.flyingState, landing: this.landingState, crashing: this.crashingState };
    const hitTest = this.ship.hitTest(this.terrain);
    return nextState[hitTest];
  }

  crashingState() {
    const debris = this.ship.crash();
    this.two.add(debris.group);
    this.ship = debris;
    this.statusLabel.showHTML(kCrashMsg, 10000);

    return this.idleState;
  }

  landingState() {
    const y = this.terrain.horizonAtX(this.ship.translation.x).y;
    this.ship.land(y);
    this.statusLabel.showHTML(kLandMsg, 10000);

    return this.ship.stopped ? this.idleState : this.landingState;
  }

  // This method toggles fuel burn on / off AND changed visibility of the fuel states label group
  fuelCheckChange( chkbox ) {
    const fuelSpan = document.getElementById('fuel')
    if ( chkbox.checked ) {
      this.ship.monitorFuel = true
      fuelSpan.style.visibility = 'visible'
    } else {
      this.ship.monitorFuel = false
      fuelSpan.style.visibility = 'hidden'
    }
  }

  lightDark() {
    this.dark = !this.dark
    console.log('light dark', this.dark)
    const cont = document.getElementById('container')
    cont.style['background-color'] = this.dark ? 'black' : 'white'
    this.fuelMonitorLabel = new Label('fuelMonitorLabel', { label: 'Monitor fuel ?', plusSign: '', minusSign: '', dark: this.dark});
  }

  idleState() {
    this.ship.tick()
    if (this.ship.engineLevel > 4) {
      this.ship.launch();
      this.statusLabel.hideHTML(0);
      return this.flyingState;
    }
    return this.idleState
  }

  run () {
    this.two.bind('update', () => {
      this.state = this.state()
    });
  }

}

const luniTwo = new LuniTwo();
luniTwo.run()
