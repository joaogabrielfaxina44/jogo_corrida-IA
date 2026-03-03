class RaceScene extends Phaser.Scene {
    constructor() {
        super('RaceScene');
    }

    init() {
        this.trackPoints = [];
        this.player = null;
        this.opponents = [];
        this.items = [];
        this.currentLap = 1;
        this.maxLaps = 5;
        this.isRacing = false;
        this.stats = window.gameStats || SaveManager.load();
        this.trackWidth = 350;
    }

    preload() {
        // Load with fallback logic for missing assets
        this.load.image('player_car', './assets/car_player.png');
        this.load.image('enemy_car', './assets/car_enemy.png');
        this.load.image('item_box', './assets/item_box.png');
        this.load.image('oil_spill', './assets/oil.png');

        // Error handling for assets
        this.load.on('loaderror', (fileObj) => {
            console.warn('Failed to load asset:', fileObj.key);
        });
    }

    create() {
        const { width, height } = this.scale;

        // Ensure we have a valid generator
        if (!TrackGenerator) {
            console.error("TrackGenerator not found!");
            return;
        }

        // 1. Generate Track
        this.trackPoints = TrackGenerator.generate(3000, 3000, 15);

        if (!this.trackPoints || this.trackPoints.length === 0) {
            console.error("Failed to generate track points");
            return;
        }

        // 2. Draw Track
        this.renderTrack();

        // 3. Physics
        this.physics.world.setBounds(0, 0, 3000, 3000);

        // 4. Create Cars
        this.player = this.createCar(this.trackPoints[0].x, this.trackPoints[0].y, 'player_car', true);

        for (let i = 0; i < 3; i++) {
            const opp = this.createCar(this.trackPoints[0].x + (i + 1) * 60, this.trackPoints[0].y, 'enemy_car', false);
            this.opponents.push(opp);
        }

        // 5. Camera
        this.cameras.main.setBounds(0, 0, 3000, 3000);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // 6. HUD & Mini-map
        this.createMiniMap();
        this.createHUD();

        // 7. Barriers & Colliders
        this.physics.add.collider(this.player, this.barriers);
        this.opponents.forEach(opp => {
            this.physics.add.collider(opp, this.barriers);
            this.physics.add.collider(this.player, opp);
        });

        // 8. Start Sequence
        this.spawnItems();
        this.startCountdown();
    }

    createCar(x, y, key, isPlayer) {
        const car = this.physics.add.sprite(x, y, key);

        // Color fallback if image fails
        if (!this.textures.exists(key)) {
            car.setTexture('__WHITE'); // Internal Phaser placeholder
            car.setDisplaySize(40, 60);
            car.setTint(isPlayer ? 0x00a3ff : 0xff3333);
        }

        car.setCollideWorldBounds(true);
        car.setDrag(0.95);
        car.setAngularDrag(0.9);
        car.depth = 10;

        car.stats = {
            speed: 0,
            maxSpeed: (isPlayer ? 400 * (1 + (this.stats.engineLevel - 1) * 0.05) : 380 + Math.random() * 40),
            acceleration: (isPlayer ? 10 * (1 + (this.stats.accelerationLevel - 1) * 0.1) : 8 + Math.random() * 4),
            handling: 4,
            lap: 1,
            checkpoint: 0,
            isStunned: false
        };

        return car;
    }

    renderTrack() {
        const graphics = this.add.graphics();
        this.barriers = this.physics.add.staticGroup();

        graphics.lineStyle(this.trackWidth, 0x333333, 1);
        graphics.beginPath();
        graphics.moveTo(this.trackPoints[0].x, this.trackPoints[0].y);

        for (let i = 1; i < this.trackPoints.length; i++) {
            graphics.lineTo(this.trackPoints[i].x, this.trackPoints[i].y);
        }
        graphics.closePath();
        graphics.strokePath();

        graphics.lineStyle(4, 0xffffff, 0.2);
        graphics.strokePath();

        const halfWidth = this.trackWidth / 2 + 10;
        for (let i = 0; i < this.trackPoints.length; i++) {
            const p1 = this.trackPoints[i];
            const p2 = this.trackPoints[(i + 1) % this.trackPoints.length];
            const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
            const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);

            const normal = angle + Math.PI / 2;
            this.createBarrierSegment(p1.x + Math.cos(normal) * halfWidth, p1.y + Math.sin(normal) * halfWidth, angle, dist);
            this.createBarrierSegment(p1.x - Math.cos(normal) * halfWidth, p1.y - Math.sin(normal) * halfWidth, angle, dist);
        }

        const start = this.trackPoints[0];
        const angle = Phaser.Math.Angle.Between(start.x, start.y, this.trackPoints[1].x, this.trackPoints[1].y);
        this.add.rectangle(start.x, start.y, this.trackWidth, 20, 0xff0000).setRotation(angle + Math.PI / 2);
    }

    createBarrierSegment(x, y, angle, length) {
        const step = 40; // Less dense for performance
        for (let d = 0; d < length; d += step) {
            const bx = x + Math.cos(angle) * d;
            const by = y + Math.sin(angle) * d;
            const dot = this.add.circle(bx, by, 10, 0x00ffa3, 0); // Invisible by default
            this.barriers.add(dot);
            dot.body.setCircle(10);
            dot.body.setImmovable(true);
        }
    }

    update() {
        if (!this.isRacing || !this.player) return;

        this.handlePlayerInput();
        this.opponents.forEach(opp => this.handleAIBehavior(opp));
        this.checkLapProgress(this.player);
        this.opponents.forEach(opp => this.checkLapProgress(opp));
        this.updateHUD();
    }

    handlePlayerInput() {
        if (this.player.stats.isStunned) return;
        const cursors = this.input.keyboard.createCursorKeys();
        let moveX = 0, moveY = 0;

        if (cursors.left.isDown) moveX = -1;
        else if (cursors.right.isDown) moveX = 1;

        if (cursors.up.isDown) moveY = -1;
        else if (cursors.down.isDown) moveY = 1;

        if (moveX !== 0 || moveY !== 0) {
            const targetAngle = Math.atan2(moveY, moveX);
            this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, targetAngle, 0.15);
            this.player.stats.speed = Math.min(this.player.stats.speed + this.player.stats.acceleration, this.player.stats.maxSpeed);
        } else {
            this.player.stats.speed *= 0.96;
        }

        this.player.setVelocity(Math.cos(this.player.rotation) * this.player.stats.speed, Math.sin(this.player.rotation) * this.player.stats.speed);
    }

    handleAIBehavior(car) {
        if (car.stats.isStunned) return;
        const target = this.trackPoints[(car.stats.checkpoint + 1) % this.trackPoints.length];
        const angle = Phaser.Math.Angle.Between(car.x, car.y, target.x, target.y);
        car.rotation = Phaser.Math.Angle.RotateTo(car.rotation, angle, 0.1);
        car.stats.speed = Math.min(car.stats.speed + car.stats.acceleration, car.stats.maxSpeed * 0.85);
        car.setVelocity(Math.cos(car.rotation) * car.stats.speed, Math.sin(car.rotation) * car.stats.speed);
    }

    checkLapProgress(car) {
        const nextIdx = (car.stats.checkpoint + 1) % this.trackPoints.length;
        const dist = Phaser.Math.Distance.Between(car.x, car.y, this.trackPoints[nextIdx].x, this.trackPoints[nextIdx].y);
        if (dist < 300) {
            car.stats.checkpoint = nextIdx;
            if (nextIdx === 0) {
                car.stats.lap++;
                if (car === this.player && car.stats.lap > this.maxLaps) this.endRace();
            }
        }
    }

    spawnItems() {
        for (let i = 0; i < 15; i++) {
            const pt = this.trackPoints[Math.floor(Math.random() * this.trackPoints.length)];
            const item = this.physics.add.sprite(pt.x + Phaser.Math.Between(-100, 100), pt.y + Phaser.Math.Between(-100, 100), 'item_box');
            if (!this.textures.exists('item_box')) item.setTexture('__WHITE').setTint(0xffff00);
            this.physics.add.overlap(this.player, item, () => {
                item.destroy();
                this.applyItemEffect(Phaser.Utils.Array.GetRandom(['turbo', 'oil', 'projectile']));
            });
        }
    }

    applyItemEffect(effect) {
        if (effect === 'turbo') {
            const original = this.player.stats.maxSpeed;
            this.player.stats.maxSpeed *= 1.6;
            this.player.setTint(0x00ffff);
            this.time.delayedCall(3000, () => { this.player.stats.maxSpeed = original; this.player.clearTint(); });
        } else if (effect === 'oil') {
            const oil = this.physics.add.sprite(this.player.x, this.player.y, 'oil_spill');
            if (!this.textures.exists('oil_spill')) oil.setTexture('__WHITE').setTint(0x000000);
            this.opponents.forEach(opp => this.physics.add.overlap(opp, oil, () => { this.stunCar(opp); oil.destroy(); }));
        } else if (effect === 'projectile') {
            const proj = this.physics.add.sprite(this.player.x, this.player.y, 'item_box');
            proj.setTint(0xff0000).setVelocity(Math.cos(this.player.rotation) * 800, Math.sin(this.player.rotation) * 800);
            this.opponents.forEach(opp => this.physics.add.overlap(opp, proj, () => { this.stunCar(opp); proj.destroy(); }));
            this.time.delayedCall(2000, () => proj.destroy());
        }
    }

    stunCar(car) {
        if (car.stats.isStunned) return;
        car.stats.isStunned = true;
        car.setTint(0xff0000);
        car.setVelocity(0, 0);
        this.time.delayedCall(1500, () => { car.stats.isStunned = false; car.clearTint(); });
    }

    createMiniMap() {
        const mm = this.cameras.add(1050, 20, 200, 200).setZoom(0.04).setName('mini');
        mm.setBackgroundColor(0x000000).scrollX = 1400; mm.scrollY = 1400;
    }

    createHUD() {
        this.lapText = this.add.text(20, 20, 'LAP: 1/5', { fontSize: '24px', color: '#fff' }).setScrollFactor(0);
        this.speedText = this.add.text(20, 50, 'SPEED: 0', { fontSize: '24px', color: '#fff' }).setScrollFactor(0);
        this.posText = this.add.text(20, 80, 'POS: 1/4', { fontSize: '24px', color: '#fff' }).setScrollFactor(0);
    }

    updateHUD() {
        this.lapText.setText(`LAP: ${Math.min(this.player.stats.lap, this.maxLaps)}/5`);
        this.speedText.setText(`SPEED: ${Math.floor(this.player.stats.speed)}`);
        let pos = 1;
        const pProg = this.player.stats.lap * 1000 + this.player.stats.checkpoint;
        this.opponents.forEach(o => { if (o.stats.lap * 1000 + o.stats.checkpoint > pProg) pos++; });
        this.posText.setText(`POS: ${pos}/4`);
    }

    startCountdown() {
        let count = 3;
        const txt = this.add.text(640, 320, '3', { fontSize: '120px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0);
        this.time.addEvent({
            delay: 1000, repeat: 3, callback: () => {
                count--;
                if (count === 0) { txt.setText('GO!'); this.isRacing = true; this.time.delayedCall(1000, () => txt.destroy()); }
                else if (count > 0) txt.setText(count);
            }
        });
    }

    endRace() {
        this.isRacing = false;
        this.add.text(640, 360, 'FINISH!', { fontSize: '100px', backgroundColor: '#000' }).setOrigin(0.5).setScrollFactor(0);
        this.time.delayedCall(3000, () => this.scene.start('MenuScene'));
    }
}
