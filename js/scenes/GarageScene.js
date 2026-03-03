class GarageScene extends Phaser.Scene {
    constructor() {
        super('GarageScene');
    }

    create() {
        const { width, height } = this.scale;

        // Background
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x0a0a0c, 0x0a0a0c, 0x1a1a2e, 0x1a1a2e, 1);
        graphics.fillRect(0, 0, width, height);

        this.add.text(width / 2, 80, 'GARAGE', {
            fontFamily: 'Outfit',
            fontSize: '48px',
            fontWeight: '900',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.updateUI();

        // Back Button
        this.createButton(width / 2, height - 80, 'BACK TO MENU', () => {
            this.scene.start('MenuScene');
        });
    }

    updateUI() {
        if (this.uiGroup) this.uiGroup.destroy(true);
        this.uiGroup = this.add.group();

        const { width, height } = this.scale;
        const stats = window.gameStats;

        // Coins
        const coinsText = this.add.text(width / 2, 140, `BALANCE: $${stats.coins}`, {
            fontFamily: 'Outfit',
            fontSize: '32px',
            color: '#00ffa3'
        }).setOrigin(0.5);
        this.uiGroup.add(coinsText);

        // Engine Upgrade
        const engineCost = stats.engineLevel * 1000;
        this.createUpgradeRow(width / 2, 280, 'MOTOR', stats.engineLevel, engineCost, () => {
            if (SaveManager.upgradeEngine()) {
                this.updateUI();
            } else {
                this.flashError();
            }
        });

        // Acceleration Upgrade
        const accelCost = stats.accelerationLevel * 1000;
        this.createUpgradeRow(width / 2, 400, 'ACELERAÇÃO', stats.accelerationLevel, accelCost, () => {
            if (SaveManager.upgradeAcceleration()) {
                this.updateUI();
            } else {
                this.flashError();
            }
        });
    }

    createUpgradeRow(x, y, label, level, cost, callback) {
        const row = this.add.container(x, y);

        const text = this.add.text(-250, 0, `${label} (Lvl ${level})`, {
            fontFamily: 'Outfit', fontSize: '24px', color: '#ffffff'
        }).setOrigin(0, 0.5);

        const btnBg = this.add.rectangle(150, 0, 200, 50, 0x00ffa3, 0.2)
            .setStrokeStyle(2, 0x00ffa3);

        const btnText = this.add.text(150, 0, `BUY $${cost}`, {
            fontFamily: 'Outfit', fontSize: '20px', fontWeight: '700', color: '#00ffa3'
        }).setOrigin(0.5);

        btnBg.setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);

        row.add([text, btnBg, btnText]);
        this.uiGroup.add(row);
    }

    createButton(x, y, label, callback) {
        const bg = this.add.rectangle(x, y, 250, 50, 0xffffff, 0.1)
            .setStrokeStyle(1, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', callback);

        const txt = this.add.text(x, y, label, {
            fontFamily: 'Outfit', fontSize: '20px', color: '#ffffff'
        }).setOrigin(0.5);
    }

    flashError() {
        this.cameras.main.shake(200, 0.005);
    }
}
