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
        this.stats = (window.SaveManager) ? SaveManager.load() : { engineLevel: 1, accelerationLevel: 1, coins: 0 };
        this.trackWidth = 350;
    }

    preload() {
        this.load.image('player_car', './assets/car_player.png');
        this.load.image('enemy_car', './assets/car_enemy.png');
        this.load.image('item_box', './assets/item_box.png');
        this.load.image('oil_spill', './assets/oil.png');
    }

    create() {
        const { width, height } = this.scale;

        // 1. Gerar Pista
        this.trackPoints = TrackGenerator.generate(4000, 4000, 12);

        // 2. Renderizar Visual da Pista
        this.renderTrackVisual();

        // 3. Configurar Física
        this.physics.world.setBounds(0, 0, 4000, 4000);
        this.barriers = this.physics.add.staticGroup();
        this.createOptimizedBarriers();

        // 4. Criar Carros
        this.player = this.createCar(this.trackPoints[0].x, this.trackPoints[0].y, 'player_car', true);
        for (let i = 0; i < 3; i++) {
            const opp = this.createCar(this.trackPoints[0].x + (i + 1) * 70, this.trackPoints[0].y + 50, 'enemy_car', false);
            this.opponents.push(opp);
        }

        // 5. Colididores
        this.physics.add.collider(this.player, this.barriers);
        this.opponents.forEach(opp => {
            this.physics.add.collider(opp, this.barriers);
            this.physics.add.collider(this.player, opp);
        });

        // 6. Câmera
        this.cameras.main.setBounds(0, 0, 4000, 4000);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // 7. Interface e Itens
        this.createHUD();
        this.spawnItems();
        this.startCountdown();
    }

    createCar(x, y, key, isPlayer) {
        const car = this.physics.add.sprite(x, y, key);

        // Fallback se a imagem sumir
        if (!this.textures.exists(key) || this.textures.get(key).key === '__MISSING') {
            const rect = this.add.rectangle(0, 0, 40, 60, isPlayer ? 0x00a3ff : 0xff3333);
            const textureName = key + '_fallback';
            if (!this.textures.exists(textureName)) {
                rect.generateTexture(textureName, 40, 60);
            }
            car.setTexture(textureName);
            rect.destroy();
        }

        car.setCollideWorldBounds(true);
        car.setDrag(0.95);
        car.depth = 10;

        car.stats = {
            speed: 0,
            maxSpeed: (isPlayer ? 450 * (1 + (this.stats.engineLevel - 1) * 0.05) : 380 + Math.random() * 50),
            acceleration: (isPlayer ? 12 * (1 + (this.stats.accelerationLevel - 1) * 0.1) : 9 + Math.random() * 4),
            lap: 1,
            checkpoint: 0,
            isStunned: false
        };

        return car;
    }

    renderTrackVisual() {
        const graphics = this.add.graphics();

        // Asfalto
        graphics.lineStyle(this.trackWidth, 0x222222, 1);
        graphics.beginPath();
        graphics.moveTo(this.trackPoints[0].x, this.trackPoints[0].y);
        this.trackPoints.forEach(p => graphics.lineTo(p.x, p.y));
        graphics.closePath();
        graphics.strokePath();

        // Faixas
        graphics.lineStyle(5, 0xffffff, 0.1);
        graphics.strokePath();

        // Linha de Chegada
        const p1 = this.trackPoints[0];
        const p2 = this.trackPoints[1];
        const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
        this.add.rectangle(p1.x, p1.y, this.trackWidth, 20, 0xff0000).setRotation(angle + Math.PI / 2);
    }

    createOptimizedBarriers() {
        const halfWidth = this.trackWidth / 2 + 15;

        for (let i = 0; i < this.trackPoints.length; i++) {
            const p1 = this.trackPoints[i];
            const p2 = this.trackPoints[(i + 1) % this.trackPoints.length];
            const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
            const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
            const normal = angle + Math.PI / 2;

            // Barreira Externa e Interna (Retângulos em vez de círculos)
            this.addBarrierRect(p1.x + Math.cos(normal) * halfWidth, p1.y + Math.sin(normal) * halfWidth, angle, dist);
            this.addBarrierRect(p1.x - Math.cos(normal) * halfWidth, p1.y - Math.sin(normal) * halfWidth, angle, dist);
        }
    }

    addBarrierRect(x, y, angle, length) {
        const b = this.add.rectangle(x, y, length, 20, 0x00ffa3, 0.2);
        b.setRotation(angle);
        b.setOrigin(0, 0.5);
        this.physics.add.existing(b, true);
        this.barriers.add(b);
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
        let mx = 0, my = 0;

        if (cursors.left.isDown) mx = -1;
        else if (cursors.right.isDown) mx = 1;
        if (cursors.up.isDown) my = -1;
        else if (cursors.down.isDown) my = 1;

        if (mx !== 0 || my !== 0) {
            const target = Math.atan2(my, mx);
            this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, target, 0.15);
            this.player.stats.speed = Math.min(this.player.stats.speed + this.player.stats.acceleration, this.player.stats.maxSpeed);
        } else {
            this.player.stats.speed *= 0.97;
        }

        this.player.setVelocity(Math.cos(this.player.rotation) * this.player.stats.speed, Math.sin(this.player.rotation) * this.player.stats.speed);
    }

    handleAIBehavior(car) {
        if (car.stats.isStunned) return;
        const target = this.trackPoints[(car.stats.checkpoint + 1) % this.trackPoints.length];
        const angle = Phaser.Math.Angle.Between(car.x, car.y, target.x, target.y);
        car.rotation = Phaser.Math.Angle.RotateTo(car.rotation, angle, 0.08);
        car.stats.speed = Math.min(car.stats.speed + car.stats.acceleration, car.stats.maxSpeed * 0.85);
        car.setVelocity(Math.cos(car.rotation) * car.stats.speed, Math.sin(car.rotation) * car.stats.speed);
    }

    checkLapProgress(car) {
        const next = (car.stats.checkpoint + 1) % this.trackPoints.length;
        if (Phaser.Math.Distance.Between(car.x, car.y, this.trackPoints[next].x, this.trackPoints[next].y) < 300) {
            car.stats.checkpoint = next;
            if (next === 0) {
                car.stats.lap++;
                if (car === this.player && car.stats.lap > this.maxLaps) this.endRace();
            }
        }
    }

    spawnItems() {
        for (let i = 0; i < 15; i++) {
            const p = this.trackPoints[Phaser.Math.Between(0, this.trackPoints.length - 1)];
            const item = this.physics.add.sprite(p.x + Phaser.Math.Between(-100, 100), p.y + Phaser.Math.Between(-100, 100), 'item_box');
            this.physics.add.overlap(this.player, item, () => {
                item.destroy();
                this.applyEffect(Phaser.Utils.Array.GetRandom(['turbo', 'oil', 'projectile']));
            });
        }
    }

    applyEffect(type) {
        if (type === 'turbo') {
            const old = this.player.stats.maxSpeed;
            this.player.stats.maxSpeed *= 1.6;
            this.player.setTint(0x00ffff);
            this.time.delayedCall(3000, () => { this.player.stats.maxSpeed = old; this.player.clearTint(); });
        } else if (type === 'oil') {
            const oil = this.physics.add.sprite(this.player.x, this.player.y, 'oil_spill');
            this.opponents.forEach(o => this.physics.add.overlap(o, oil, () => { this.stunCar(o); oil.destroy(); }));
        } else if (type === 'projectile') {
            const p = this.physics.add.sprite(this.player.x, this.player.y, 'item_box').setTint(0xff0000);
            p.setVelocity(Math.cos(this.player.rotation) * 800, Math.sin(this.player.rotation) * 800);
            this.opponents.forEach(o => this.physics.add.overlap(o, p, () => { this.stunCar(o); p.destroy(); }));
            this.time.delayedCall(2000, () => p.destroy());
        }
    }

    stunCar(car) {
        car.stats.isStunned = true;
        car.setTint(0xff0000); car.setVelocity(0, 0);
        this.time.delayedCall(1500, () => { car.stats.isStunned = false; car.clearTint(); });
    }

    createHUD() {
        this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
        this.lapT = this.add.text(20, 20, 'LAP: 1/5', { fontSize: '28px', color: '#fff' });
        this.speedT = this.add.text(20, 60, 'SPEED: 0', { fontSize: '28px', color: '#fff' });
        this.hud.add([this.lapT, this.speedT]);
    }

    updateHUD() {
        this.lapT.setText(`LAP: ${Math.min(this.player.stats.lap, 5)}/5`);
        this.speedT.setText(`SPEED: ${Math.floor(this.player.stats.speed)}`);
    }

    startCountdown() {
        let c = 3;
        const t = this.add.text(640, 360, '3', { fontSize: '150px', color: '#fff' }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        this.time.addEvent({
            delay: 1000, repeat: 3, callback: () => {
                if (c === 0) { t.setText('GO!'); this.isRacing = true; this.time.delayedCall(1000, () => t.destroy()); }
                else { t.setText(c); }
                c--;
            }
        });
    }

    endRace() {
        this.isRacing = false;
        this.add.text(640, 360, 'FINISH!', { fontSize: '120px', backgroundColor: '#000' }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
        this.time.delayedCall(3000, () => this.scene.start('MenuScene'));
    }
}
