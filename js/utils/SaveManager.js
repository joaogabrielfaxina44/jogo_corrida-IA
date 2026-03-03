class SaveManager {
    static STORAGE_KEY = 'turbo_sprint_save';

    static load() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
        return {
            coins: 0,
            engineLevel: 1,
            accelerationLevel: 1,
            unlockedCars: ['player_car']
        };
    }

    static save(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        window.gameStats = data;
    }

    static addCoins(amount) {
        const stats = this.load();
        stats.coins += amount;
        this.save(stats);
    }

    static upgradeEngine() {
        const stats = this.load();
        const cost = stats.engineLevel * 1000;
        if (stats.coins >= cost) {
            stats.coins -= cost;
            stats.engineLevel++;
            this.save(stats);
            return true;
        }
        return false;
    }

    static upgradeAcceleration() {
        const stats = this.load();
        const cost = stats.accelerationLevel * 1000;
        if (stats.coins >= cost) {
            stats.coins -= cost;
            stats.accelerationLevel++;
            this.save(stats);
            return true;
        }
        return false;
    }
}
