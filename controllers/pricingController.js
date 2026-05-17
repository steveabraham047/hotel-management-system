const db = require('../config/db');

const defaultRules = {
    surge_threshold: 80,
    surge_multiplier: 1.25,
    weekend_multiplier: 1.15,
    season_multiplier: 1.1,
    season_enabled: 0
};

const ensurePricingTables = async (executor = db) => {
    await executor.execute(`
        CREATE TABLE IF NOT EXISTS pricing_rules (
            rule_key VARCHAR(80) PRIMARY KEY,
            rule_value DECIMAL(10,2) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    for (const [key, value] of Object.entries(defaultRules)) {
        await executor.execute(
            `INSERT IGNORE INTO pricing_rules (rule_key, rule_value) VALUES (?, ?)`,
            [key, value]
        );
    }
};

const getPricingRules = async (executor = db) => {
    await ensurePricingTables(executor);
    const [rows] = await executor.execute('SELECT rule_key, rule_value FROM pricing_rules');
    return rows.reduce((rules, row) => {
        rules[row.rule_key] = Number(row.rule_value);
        return rules;
    }, { ...defaultRules });
};

const getOccupancyRate = async (executor = db) => {
    const [rows] = await executor.execute(
        `SELECT
            COUNT(*) AS total_rooms,
            SUM(CASE WHEN LOWER(status) = 'occupied' THEN 1 ELSE 0 END) AS occupied_rooms
         FROM rooms`
    );
    const totalRooms = Number(rows[0]?.total_rooms || 0);
    const occupiedRooms = Number(rows[0]?.occupied_rooms || 0);
    return {
        totalRooms,
        occupiedRooms,
        occupancyRate: totalRooms === 0 ? 0 : Math.round((occupiedRooms / totalRooms) * 100)
    };
};

const calculateDynamicPrice = (basePrice, rules, occupancyRate, dateValue = new Date()) => {
    const date = new Date(dateValue);
    const day = date.getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;
    const surgeApplies = occupancyRate >= Number(rules.surge_threshold || defaultRules.surge_threshold);
    const weekendMultiplier = isWeekend ? Number(rules.weekend_multiplier || 1) : 1;
    const surgeMultiplier = surgeApplies ? Number(rules.surge_multiplier || 1) : 1;
    const seasonMultiplier = Number(rules.season_enabled) ? Number(rules.season_multiplier || 1) : 1;
    const multiplier = weekendMultiplier * surgeMultiplier * seasonMultiplier;
    const dynamicPrice = Math.round(Number(basePrice || 0) * multiplier);

    return {
        base_price: Number(basePrice || 0),
        dynamic_price: dynamicPrice,
        multiplier: Number(multiplier.toFixed(2)),
        reasons: {
            weekend: isWeekend,
            surge: surgeApplies,
            season: Boolean(Number(rules.season_enabled))
        }
    };
};

const getPricingDashboard = async (req, res) => {
    try {
        const rules = await getPricingRules();
        const occupancy = await getOccupancyRate();
        const [rooms] = await db.execute(
            `SELECT room_id, room_number, type, status, price_per_night
             FROM rooms
             ORDER BY CAST(room_number AS UNSIGNED), room_number`
        );

        res.json({
            rules,
            occupancy,
            rooms: rooms.map((room) => ({
                ...room,
                ...calculateDynamicPrice(room.price_per_night, rules, occupancy.occupancyRate)
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updatePricingRules = async (req, res) => {
    try {
        await ensurePricingTables();
        const allowedKeys = Object.keys(defaultRules);
        for (const key of allowedKeys) {
            if (req.body[key] === undefined) continue;
            await db.execute(
                `INSERT INTO pricing_rules (rule_key, rule_value)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE rule_value = VALUES(rule_value)`,
                [key, Number(req.body[key])]
            );
        }

        const rules = await getPricingRules();
        res.json({ message: 'Pricing rules updated.', rules });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    ensurePricingTables,
    getPricingRules,
    getOccupancyRate,
    calculateDynamicPrice,
    getPricingDashboard,
    updatePricingRules
};
