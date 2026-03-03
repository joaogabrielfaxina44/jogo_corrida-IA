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
        this.trackWidth = 400; // Pista larga conforme solicitado
        this.stats = (window.gameStats) ? window.gameStats : SaveManager.load();
    }

    preload() {
        // Carrega assets com caminhos relativos para GitHub Pages
        this.load.image('player_car', './assets/car_player.png');
        this.load.image('enemy_car', './assets/car_enemy.png');
        this.load.image('item_box', './assets/item_box.png');
        this.load.image('oil_spill', './assets/oil.png');
    }

    create() {
        const { width, height } = this.scale;

        // 1. Gerar Pista (Mundo 4000x4000)
        this.trackPoints = TrackGenerator.generate(4000, 4000, 15);

        // 2. Criar Grupo de Barreiras (Física Estática)
        this.barriers = this.physics.add.staticGroup();
        this.renderTrackAndBarriers();

        // 3. Configurar Mundo Físico
        this.physics.world.setBounds(0, 0, 4000, 4000);

        // 4. Criar Carros
        this.player = this.createCar(this.trackPoints[0].x, this.trackPoints[0].y, 'player_car', true);

        // Spawn de 3 Rivais
        const spawnDistance = 60;
        for (let i = 0; i < 3; i++) {
            const opp = this.createCar(
                this.trackPoints[0].x + (i + 1) * spawnDistance,
                this.trackPoints[0].y + 40,
                'enemy_car',
                false
            );
            this.opponents.push(opp);
        }

        // 5. Câmera (Focada no Player)
        this.cameras.main.setBounds(0, 0, 4000, 4000);
        this.cameras.main.startFollow(this.player, true, 0.2, 0.2);
        this.cameras.main.centerOn(this.player.x, this.player.y);

        // 6. Colisões
        this.physics.add.collider(this.player, this.barriers);
        this.opponents.forEach(opp => {
            this.physics.add.collider(opp, this.barriers);
            this.physics.add.collider(this.player, opp);
        });

        // 7. HUD e Itens
        this.createHUD();
        this.spawnItems();
        this.startCountdown();
    }

    createCar(x, y, key, isPlayer) {
        const car = this.physics.add.sprite(x, y, key);

        // Fallback: Se a imagem não for encontrada (erro no GitHub ou assets não commitados)
        if (!this.textures.exists(key) || this.textures.get(key).key === '__MISSING') {
            const textureName = key + '_fallback';
            if (!this.textures.exists(textureName)) {
                const graphics = this.make.graphics();
                graphics.fillStyle(isPlayer ? 0x00a3ff : 0xff3333);
                graphics.fillRect(0, 0, 40, 60);
                graphics.generateTexture(textureName, 40, 60);
            }
            car.setTexture(textureName);
        }

        car.setCollideWorldBounds(true);
        car.setDrag(0.96); // Deslize estilo arcade
        car.depth = 10;

        // Hitbox refinada (ajustada para carros virados)
        car.body.setSize(30, 45);

        car.stats = {
            speed: 0,
            maxSpeed: (isPlayer ? 480 * (1 + (this.stats.engineLevel - 1) * 0.05) : 380 + Math.random() * 60),
            acceleration: (isPlayer ? 14 * (1 + (this.stats.accelerationLevel - 1) * 0.1) : 10 + Math.random() * 4),
            lap: 1,
            checkpoint: 0,
            isStunned: false
        };

        return car;
    }

    renderTrackAndBarriers() {
        const graphics = this.add.graphics();

        // Grama (Fundo)
        graphics.lineStyle(this.trackWidth + 60, 0x1a5e1a, 1);
        graphics.beginPath();
        graphics.moveTo(this.trackPoints[0].x, this.trackPoints[0].y);
        this.trackPoints.forEach(p => graphics.lineTo(p.x, p.y));
        graphics.closePath();
        graphics.strokePath();

        // Asfalto
        graphics.lineStyle(this.trackWidth, 0x333333, 1);
        graphics.strokePath();

        // Linha branca suave nas bordas
        graphics.lineStyle(this.trackWidth - 10, 0xffffff, 0.05);
        graphics.strokePath();

        // Linha de Chegada
        const p1 = this.trackPoints[0];
        const p2 = this.trackPoints[1];
        const angle = Phaser.Math.Angle.Between(p1.x, p1.y, p2.x, p2.y);
        this.add.rectangle(p1.x, p1.y, this.trackWidth, 20, 0xff0000)
            .setRotation(angle + Math.PI / 2)
            .setDepth(1);

        // Criar Barreiras Físicas (Círculos em cadeia - Mais preciso em curvas)
        const halfWidth = this.trackWidth / 2 + 10;
        const step = 40;

        for (let i = 0; i < this.trackPoints.length; i++) {
            const pt1 = this.trackPoints[i];
            const pt2 = this.trackPoints[(i + 1) % this.trackPoints.length];
            const segmentDist = Phaser.Math.Distance.Between(pt1.x, pt1.y, pt2.x, pt2.y);
            const segmentAngle = Phaser.Math.Angle.Between(pt1.x, pt1.y, pt2.x, pt2.y);
            const normal = segmentAngle + Math.PI / 2;

            for (let d = 0; d < segmentDist; d += step) {
                const curX = pt1.x + Math.cos(segmentAngle) * d;
                const curY = pt1.y + Math.sin(segmentAngle) * d;

                // Parede Externa
                this.addBarrier(curX + Math.cos(normal) * halfWidth, curY + Math.sin(normal) * halfWidth);
                // Parede Interna
                this.addBarrier(curX - Math.cos(normal) * halfWidth, curY - Math.sin(normal) * halfWidth);
            }
        }
    }

    addBarrier(x, y) {
        const b = this.add.circle(x, y, 20, 0x000000, 0); // Invisível
        this.physics.add.existing(b, true);
        this.barriers.add(b);
        b.body.setCircle(20);
    }

    update() {
        if (!this.player) return;

        if (this.isRacing) {
            this.handlePlayerMovement();
            this.handleAI();
            this.checkProgress();
            this.updateHUD();
        }
    }

    handlePlayerMovement() {
        if (this.player.stats.isStunned) return;

        const cursors = this.input.keyboard.createCursorKeys();
        let moveX = 0;
        let moveY = 0;

        if (cursors.left.isDown) moveX = -1;
        else if (cursors.right.isDown) moveX = 1;

        if (cursors.up.isDown) moveY = -1;
        else if (cursors.down.isDown) moveY = 1;

        if (moveX !== 0 || moveY !== 0) {
            // Rotacionar suavemente para a direção do movimento
            const targetRotation = Math.atan2(moveY, moveX);
            this.player.rotation = Phaser.Math.Angle.RotateTo(this.player.rotation, targetRotation, 0.15);

            // Acelerar
            this.player.stats.speed = Math.min(this.player.stats.speed + this.player.stats.acceleration, this.player.stats.maxSpeed);
        } else {
            // Drag natural
            this.player.stats.speed *= 0.96;
        }

        this.player.setVelocity(
            Math.cos(this.player.rotation) * this.player.stats.speed,
            Math.sin(this.player.rotation) * this.player.stats.speed
        );
    }

    handleAI() {
        this.opponents.forEach(opp => {
            if (opp.stats.isStunned) return;

            const targetIdx = (opp.stats.checkpoint + 1) % this.trackPoints.length;
            const target = this.trackPoints[targetIdx];
            const angleToTarget = Phaser.Math.Angle.Between(opp.x, opp.y, target.x, target.y);

            opp.rotation = Phaser.Math.Angle.RotateTo(opp.rotation, angleToTarget, 0.08);
            opp.stats.speed = Math.min(opp.stats.speed + opp.stats.acceleration, opp.stats.maxSpeed * 0.9);

            opp.setVelocity(
                Math.cos(opp.rotation) * opp.stats.speed,
                Math.sin(opp.rotation) * opp.stats.speed
            );
        });
    }

    checkProgress() {
        [this.player, ...this.opponents].forEach(car => {
            const nextIdx = (car.stats.checkpoint + 1) % this.trackPoints.length;
            const target = this.trackPoints[nextIdx];

            if (Phaser.Math.Distance.Between(car.x, car.y, target.x, target.y) < 300) {
                car.stats.checkpoint = nextIdx;
                if (nextIdx === 0) {
                    car.stats.lap++;
                    if (car === this.player && car.stats.lap > this.maxLaps) this.endRace();
                }
            }
        });
    }

    spawnItems() {
        for (let i = 0; i < 20; i++) {
            const pt = this.trackPoints[Phaser.Math.Between(0, this.trackPoints.length - 1)];
            const item = this.physics.add.sprite(
                pt.x + Phaser.Math.Between(-150, 150),
                pt.y + Phaser.Math.Between(-150, 150),
                'item_box'
            );

            // Item Fallback
            if (!this.textures.exists('item_box') || this.textures.get('item_box').key === '__MISSING') {
                item.setTexture('__WHITE').setTint(0xffff00);
            }

            this.physics.add.overlap(this.player, item, () => {
                item.destroy();
                this.applyItemEffect(Phaser.Utils.Array.GetRandom(['turbo', 'oil', 'projectile']));
            });
        }
    }

    applyItemEffect(type) {
        if (type === 'turbo') {
            const baseMax = this.player.stats.maxSpeed;
            this.player.stats.maxSpeed *= 1.7;
            this.player.setTint(0x00ffff);
            this.time.delayedCall(3000, () => {
                this.player.stats.maxSpeed = baseMax;
                this.player.clearTint();
            });
        } else if (type === 'oil') {
            const oil = this.physics.add.sprite(this.player.x, this.player.y, 'oil_spill');
            if (!this.textures.exists('oil_spill')) oil.setTexture('__WHITE').setTint(0x000000);
            this.opponents.forEach(o => this.physics.add.overlap(o, oil, () => {
                this.stunCar(o);
                oil.destroy();
            }));
        } else if (type === 'projectile') {
            const proj = this.physics.add.sprite(this.player.x, this.player.y, 'item_box').setTint(0xff0000);
            proj.setVelocity(Math.cos(this.player.rotation) * 1000, Math.sin(this.player.rotation) * 1000);
            this.opponents.forEach(o => this.physics.add.overlap(o, proj, () => {
                this.stunCar(o);
                proj.destroy();
            }));
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

    updateHUD() {
        this.lapText.setText(`LAP: ${Math.min(this.player.stats.lap, this.maxLaps)}/${this.maxLaps}`);
        this.speedText.setText(`SPEED: ${Math.floor(this.player.stats.speed)}`);

        // Posição
        let pos = 1;
        const pScore = this.player.stats.lap * 1000 + this.player.stats.checkpoint;
        this.opponents.forEach(o => {
            if ((o.stats.lap * 1000 + o.stats.checkpoint) > pScore) pos++;
        });
        this.posText.setText(`POS: ${pos}/4`);
    }

    createHUD() {
        const hud = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
        this.lapText = this.add.text(30, 30, 'LAP: 1/5', { fontSize: '32px', color: '#fff', stroke: '#000', strokeThickness: 5 });
        this.speedText = this.add.text(30, 70, 'SPEED: 0', { fontSize: '28px', color: '#00ffa3', stroke: '#000', strokeThickness: 4 });
        this.posText = this.add.text(30, 110, 'POS: 1/4', { fontSize: '28px', color: '#ffea00', stroke: '#000', strokeThickness: 4 });
        hud.add([this.lapText, this.speedText, this.posText]);
    }

    startCountdown() {
        let count = 3;
        const txt = this.add.text(640, 360, '3', { fontSize: '180px', color: '#fff', stroke: '#000', strokeThickness: 15 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(200);

        this.time.addEvent({
            delay: 1000,
            repeat: 3,
            callback: () => {
                if (count === 0) {
                    txt.setText('GO!');
                    this.isRacing = true;
                    this.time.delayedCall(1000, () => txt.destroy());
                } else if (count > 0) {
                    txt.setText(count);
                }
                count--;
            }
        });
    }

    endRace() {
        this.isRacing = false;
        this.add.text(640, 360, 'FINISH!', { fontSize: '120px', backgroundColor: '#000', padding: 20 })
            .setOrigin(0.5).setScrollFactor(0).setDepth(200);

        SaveManager.addCoins(500); // Recompensa padrão para teste
        this.time.delayedCall(3000, () => this.scene.start('MenuScene'));
    }
}
