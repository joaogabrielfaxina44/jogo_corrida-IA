const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MenuScene, GarageScene, RaceScene],
    backgroundColor: '#0a0a0c',
    pixelArt: false,
    antialias: true
};

const game = new Phaser.Game(config);

// Globals
window.gameStats = SaveManager.load();
