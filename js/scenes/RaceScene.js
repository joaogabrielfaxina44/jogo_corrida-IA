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
        this.stats = window.gameStats;
    }

    preload() {
        // Assets - placeholders or links to generated ones
        // Note: For GitHub Pages, these must be in the repository
        this.load.image('player_car', './assets/car_player.png');
        this.load.image('enemy_car', './assets/car_enemy.png');
        this.load.image('item_box', './assets/item_box.png');
        this.load.image('oil_spill', './assets/oil.png'); // Need to handle missing assets gracefully
    }

    create() {
        const { width, height } = this.scale;

        // 1. Generate Track
        this.trackPoints = TrackGenerator.generate(3000, 3000, 15); // Large track area

        // 2. Draw Track to Texture
        this.renderTrack();

        // 3. Setup Physics World
        this.physics.world.setBounds(0, 0, 3000, 3000);

        // 4. Create Player
        this.player = this.createCar(this.trackPoints[0].x, this.trackPoints[0].y, 'player_car', true);

        // 5. Create Opponents (3 AI)
        for (let i = 0; i < 3; i++) {
            const opp = this.createCar(this.trackPoints[0].x + (i + 1) * 40, this.trackPoints[0].y, 'enemy_car', false);
            this.opponents.push(opp);
        }

        // 6. Camera
        this.cameras.main.setBounds(0, 0, 3000, 3000);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // 7. Mini-map
        this.createMiniMap();

        // 8. HUD
        this.createHUD();

        // 9. Countdown
        this.startCountdown();

        // 10. Items
        this.spawnItems();
    }

    createCar(x, y, key, isPlayer) {
        const car = this.physics.add.sprite(x, y, key);
        car.setCollideWorldBounds(true);
        car.setDrag(0.95);
        car.setAngularDrag(0.9);
        car.depth = 10;

        // Custom properties
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
        graphics.lineStyle(120, 0x333333, 1); // Track width
        graphics.beginPath();
        graphics.moveTo(this.trackPoints[0].x, this.trackPoints[0].y);

        for (let i = 1; i < this.trackPoints.length; i++) {
            graphics.lineTo(this.trackPoints[i].x, this.trackPoints[i].y);
        }
        graphics.closePath();
        graphics.strokePath();

        // Lines (Center)
        graphics.lineStyle(4, 0xffffff, 0.5);
        graphics.strokePath();

        // Finish Line
        const start = this.trackPoints[0];
        const next = this.trackPoints[1];
        const angle = Phaser.Math.Angle.Between(start.x, start.y, next.x, next.y);

        const finishLine = this.add.rectangle(start.x, start.y, 140, 20, 0xff0000)
            .setRotation(angle + Math.PI / 2);
    }

    update() {
        if (!this.isRacing) return;

        this.handlePlayerInput();
        this.opponents.forEach(opp => this.handleAIBehavior(opp));
        this.checkLapProgress(this.player);
        this.opponents.forEach(opp => this.checkLapProgress(opp));
        this.updateMiniMap();
        this.updateHUD();
    }

    handlePlayerInput() {
        if (this.player.stats.isStunned) return;

        const cursors = this.input.keyboard.createCursorKeys();

        if (cursors.up.isDown) {
            this.player.stats.speed = Math.min(this.player.stats.speed + this.player.stats.acceleration, this.player.stats.maxSpeed);
        } else if (cursors.down.isDown) {
            this.player.stats.speed = Math.max(this.player.stats.speed - this.player.stats.acceleration * 2, -this.player.stats.maxSpeed / 2);
        } else {
            this.player.stats.speed *= 0.98;
        }

        if (cursors.left.isDown) {
            this.player.setAngularVelocity(-this.player.stats.handling * (this.player.stats.speed / 100));
        } else if (cursors.right.isDown) {
            this.player.setAngularVelocity(this.player.stats.handling * (this.player.stats.speed / 100));
        } else {
            this.player.setAngularVelocity(0);
        }

        const angle = this.player.rotation;
        this.player.setVelocity(
            Math.cos(angle) * this.player.stats.speed,
            Math.sin(angle) * this.player.stats.speed
        );
    }

    handleAIBehavior(car) {
        if (car.stats.isStunned) return;

        // Path following logic
        const target = this.trackPoints[(car.stats.checkpoint + 1) % this.trackPoints.length];
        const angleToTarget = Phaser.Math.Angle.Between(car.x, car.y, target.x, target.y);

        car.rotation = Phaser.Math.Angle.RotateTo(car.rotation, angleToTarget, 0.1);
        car.stats.speed = Math.min(car.stats.speed + car.stats.acceleration, car.stats.maxSpeed * 0.9);

        car.setVelocity(
            Math.cos(car.rotation) * car.stats.speed,
            Math.sin(car.rotation) * car.stats.speed
        );

        // Advance checkpoint
        const dist = Phaser.Math.Distance.Between(car.x, car.y, target.x, target.y);
        if (dist < 150) {
            car.stats.checkpoint = (car.stats.checkpoint + 1) % this.trackPoints.length;
        }
    }

    checkLapProgress(car) {
        const nextTarget = (car.stats.checkpoint + 1) % this.trackPoints.length;
        const dist = Phaser.Math.Distance.Between(car.x, car.y, this.trackPoints[nextTarget].x, this.trackPoints[nextTarget].y);

        if (dist < 150) {
            car.stats.checkpoint = nextTarget;
            if (nextTarget === 0) {
                car.stats.lap++;
                if (car === this.player && car.stats.lap > this.maxLaps) {
                    this.endRace();
                }
            }
        }
    }

    spawnItems() {
        for (let i = 0; i < 10; i++) {
            const idx = Math.floor(Math.random() * this.trackPoints.length);
            const pt = this.trackPoints[idx];
            const item = this.physics.add.sprite(pt.x + (Math.random() - 0.5) * 50, pt.y + (Math.random() - 0.5) * 50, 'item_box');
            this.physics.add.overlap(this.player, item, () => this.collectItem(item), null, this);
            this.items.push(item);
        }
    }

    collectItem(item) {
        item.destroy();
        // Item logic...
        const effect = Phaser.Utils.Array.GetRandom(['turbo', 'oil', 'projectile']);
        this.applyItemEffect(effect);
    }

    applyItemEffect(effect) {
        console.log("Effect:", effect);
        if (effect === 'turbo') {
            const originalMax = this.player.stats.maxSpeed;
            this.player.stats.maxSpeed *= 1.5;
            this.player.setTint(0x00ffff);
            this.time.delayedCall(3000, () => {
                this.player.stats.maxSpeed = originalMax;
                this.player.clearTint();
            });
        } else if (effect === 'oil') {
            // Drop an oil spill behind
            const angle = this.player.rotation;
            const ox = this.player.x - Math.cos(angle) * 100;
            const oy = this.player.y - Math.sin(angle) * 100;
            const oil = this.physics.add.sprite(ox, oy, 'oil_spill');
            oil.setScale(0.5);

            this.opponents.forEach(opp => {
                this.physics.add.overlap(opp, oil, () => {
                    this.stunCar(opp);
                    oil.destroy();
                });
            });
        } else if (effect === 'projectile') {
            // Fire forward
            const proj = this.physics.add.sprite(this.player.x, this.player.y, 'item_box');
            proj.setScale(0.3);
            proj.setTint(0xff0000);
            proj.setVelocity(
                Math.cos(this.player.rotation) * 800,
                Math.sin(this.player.rotation) * 800
            );

            this.opponents.forEach(opp => {
                this.physics.add.overlap(opp, proj, () => {
                    this.stunCar(opp);
                    proj.destroy();
                });
            });

            this.time.delayedCall(2000, () => proj.destroy());
        }
    }

    stunCar(car) {
        if (car.stats.isStunned) return;
        car.stats.isStunned = true;
        car.setTint(0xff0000);
        car.setVelocity(0, 0);
        this.time.delayedCall(2000, () => {
            car.stats.isStunned = false;
            car.clearTint();
        });
    }

    createMiniMap() {
        this.minimap = this.cameras.add(1050, 20, 200, 200).setZoom(0.05).setName('mini');
        this.minimap.setBackgroundColor(0x000000);
        this.minimap.scrollX = 1500 - 100;
        this.minimap.scrollY = 1500 - 100;
    }

    createHUD() {
        this.hudLayer = this.add.container(0, 0).setScrollFactor(0);

        this.lapText = this.add.text(20, 20, 'LAP: 1/5', { fontSize: '24px', color: '#fff' });
        this.speedText = this.add.text(20, 50, 'SPEED: 0', { fontSize: '24px', color: '#fff' });
        this.posText = this.add.text(20, 80, 'POS: 1/4', { fontSize: '24px', color: '#fff' });

        this.hudLayer.add([this.lapText, this.speedText, this.posText]);
    }

    updateHUD() {
        this.lapText.setText(`LAP: ${Math.min(this.player.stats.lap, this.maxLaps)}/${this.maxLaps}`);
        this.speedText.setText(`SPEED: ${Math.floor(this.player.stats.speed)}`);

        // Simple position calculation
        let pos = 1;
        const playerProgress = this.player.stats.lap * 1000 + this.player.stats.checkpoint;
        this.opponents.forEach(opp => {
            const oppProgress = opp.stats.lap * 1000 + opp.stats.checkpoint;
            if (oppProgress > playerProgress) pos++;
        });
        this.posText.setText(`POS: ${pos}/4`);
    }

    updateMiniMap() {
        // Handled by the camera follow usually, but we need to show icons
        // In a real mini-map we'd use icons, here we just show the scene
    }

    startCountdown() {
        let count = 3;
        const txt = this.add.text(640, 360, '3', { fontSize: '120px', fontWeight: 'bold' }).setOrigin(0.5).setScrollFactor(0);

        const timer = this.time.addEvent({
            delay: 1000,
            callback: () => {
                count--;
                if (count === 0) {
                    txt.setText('GO!');
                    this.isRacing = true;
                    this.time.delayedCall(1000, () => txt.destroy());
                } else if (count > 0) {
                    txt.setText(count);
                }
            },
            repeat: 3
        });
    }

    endRace() {
        this.isRacing = false;
        let pos = 1;
        const playerProgress = this.player.stats.lap * 1000 + this.player.stats.checkpoint;
        this.opponents.forEach(opp => {
            if (opp.stats.lap * 1000 + opp.stats.checkpoint > playerProgress) pos++;
        });

        const rewards = [500, 300, 100, 0];
        const reward = rewards[pos - 1] || 0;
        SaveManager.addCoins(reward);

        const endText = this.add.text(640, 360, `FINISH! ${pos}º PLACE\nREWARD: $${reward}`, {
            fontSize: '64px', align: 'center', backgroundColor: '#000', padding: 20
        }).setOrigin(0.5).setScrollFactor(0);

        this.time.delayedCall(3000, () => {
            this.scene.start('MenuScene');
        });
    }
}
