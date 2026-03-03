class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    preload() {
        // Essential assets
    }

    create() {
        const { width, height } = this.scale;

        // Background Gradient (Graphic)
        const graphics = this.add.graphics();
        graphics.fillGradientStyle(0x0a0a0c, 0x0a0a0c, 0x1a1a2e, 0x1a1a2e, 1);
        graphics.fillRect(0, 0, width, height);

        // Title
        const title = this.add.text(width / 2, height * 0.3, 'TURBO SPRINT', {
            fontFamily: 'Outfit',
            fontSize: '84px',
            fontWeight: '900',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Subtitle/Glow effect
        this.tweens.add({
            targets: title,
            alpha: 0.8,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Buttons
        this.createButton(width / 2, height * 0.55, 'START RACE', () => {
            console.log("Switching to RaceScene...");
            this.scene.start('RaceScene');
        });

        this.createButton(width / 2, height * 0.68, 'GARAGE', () => {
            console.log("Switching to GarageScene...");
            this.scene.start('GarageScene');
        });

        // Coins display
        const stats = window.gameStats || SaveManager.load();
        this.add.text(width - 50, 50, `Coins: $${stats.coins}`, {
            fontFamily: 'Outfit',
            fontSize: '24px',
            color: '#00ffa3'
        }).setOrigin(1, 0.5);
    }

    createButton(x, y, label, callback) {
        const btn = this.add.container(x, y);

        const bg = this.add.rectangle(0, 0, 300, 60, 0x00a3ff, 0.2)
            .setStrokeStyle(2, 0x00a3ff);

        const text = this.add.text(0, 0, label, {
            fontFamily: 'Outfit',
            fontSize: '24px',
            fontWeight: '700',
            color: '#00a3ff'
        }).setOrigin(0.5);

        btn.add([bg, text]);

        bg.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                bg.setFillStyle(0x00a3ff, 0.4);
                text.setColor('#ffffff');
            })
            .on('pointerout', () => {
                bg.setFillStyle(0x00a3ff, 0.2);
                text.setColor('#00a3ff');
            })
            .on('pointerdown', callback);

        return btn;
    }
}
