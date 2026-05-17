const db = require('../config/db');
const { getPricingRules, getOccupancyRate, calculateDynamicPrice } = require('./pricingController');

const fallbackByType = {
    Suite: {
        title: 'Terrace Garden Suite',
        capacity: 3,
        rating: 4.9,
        popular: true,
        image_url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A calm private suite with garden-facing lounge space, warm textures, and quiet evening service.',
        amenities: ['Private terrace', 'King bed', 'Rain shower', 'Breakfast included'],
        included: ['Airport assistance', 'Evening turn-down', 'Welcome drink', 'High-speed Wi-Fi'],
        policy: 'Free cancellation until 24 hours before arrival. Check-in after 2 PM.'
    },
    Deluxe: {
        title: 'Signature King Room',
        capacity: 2,
        rating: 4.8,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A refined king room with soft lighting, premium linens, and a work-friendly corner.',
        amenities: ['King bed', 'Work desk', 'Smart TV', 'City view'],
        included: ['Daily breakfast', 'Wi-Fi', 'Tea service', 'Late checkout on request'],
        policy: 'Flexible date changes subject to availability. Check-out by 11 AM.'
    },
    Premium: {
        title: 'Signature Premium Room',
        capacity: 2,
        rating: 4.8,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A refined premium room with soft lighting, premium linens, and a work-friendly corner.',
        amenities: ['King bed', 'Work desk', 'Smart TV', 'City view'],
        included: ['Daily breakfast', 'Wi-Fi', 'Tea service', 'Late checkout on request'],
        policy: 'Flexible date changes subject to availability. Check-out by 11 AM.'
    },
    Family: {
        title: 'Family Residence',
        capacity: 5,
        rating: 4.9,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1598928636135-d146006ff4be?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1598928636135-d146006ff4be?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490359683-658d34c8f11f?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A spacious residence with connected sleeping zones, generous seating, and family-friendly service touches.',
        amenities: ['Two bedrooms', 'Living area', 'Mini pantry', 'Kids amenities'],
        included: ['Breakfast for four', 'Kids welcome kit', 'Wi-Fi', 'Priority housekeeping'],
        policy: 'Free cancellation until 48 hours before arrival. Extra bed available on request.'
    },
    Standard: {
        title: 'Classic Comfort Room',
        capacity: 2,
        rating: 4.7,
        popular: false,
        image_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1566665797739-1674de7a421a?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'A calm and efficient room for short stays, business travel, and quiet city breaks.',
        amenities: ['Queen bed', 'Wi-Fi', 'Smart TV', 'Tea service'],
        included: ['Wi-Fi', 'Daily housekeeping', 'Tea service', 'Front desk support'],
        policy: 'Free cancellation until 24 hours before arrival. Check-out by 11 AM.'
    },
    Luxury: {
        title: 'Presidential Retreat',
        capacity: 4,
        rating: 5,
        popular: true,
        image_url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1400&auto=format&fit=crop',
        gallery: [
            'https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1400&auto=format&fit=crop',
            'https://images.unsplash.com/photo-1540518614846-7eded433c457?q=80&w=1400&auto=format&fit=crop'
        ],
        description: 'The flagship suite experience with private dining, dedicated service, and skyline views.',
        amenities: ['Private dining', 'Butler service', 'Soaking bath', 'Skyline view'],
        included: ['Personal concierge', 'Club lounge access', 'Chef-curated breakfast', 'Airport transfer'],
        policy: 'Deposit required. Free date change up to 72 hours before arrival.'
    }
};

const defaultOffers = [
    {
        offer_code: 'GOLDEN-WEEKEND',
        title: 'Golden Weekend Escape',
        tag: 'Weekend Deal',
        discount_label: '20% off',
        discount_type: 'PERCENT',
        discount_value: 20,
        description: 'Includes breakfast, late checkout, and a room upgrade when available.',
        starts_at: '2026-01-01',
        ends_at: '2026-12-31',
        is_active: 1
    },
    {
        offer_code: 'HONEYMOON',
        title: 'Honeymoon Indulgence',
        tag: 'Romantic',
        discount_label: 'Rs 4,000 value',
        discount_type: 'FIXED',
        discount_value: 4000,
        description: 'Flower setup, candlelight dinner credit, and spa welcome ritual.',
        starts_at: '2026-01-01',
        ends_at: '2026-12-31',
        is_active: 1
    },
    {
        offer_code: 'FESTIVAL-LUXE',
        title: 'Festival Luxury Saver',
        tag: 'Festival',
        discount_label: '15% off',
        discount_type: 'PERCENT',
        discount_value: 15,
        description: 'Stay two nights and unlock dining credits for signature restaurants.',
        starts_at: '2026-01-01',
        ends_at: '2026-12-31',
        is_active: 1
    }
];

const parseJsonList = (value, fallback = []) => {
    if (!value) return fallback;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch {
        return fallback;
    }
};

const normalizeType = (type) => fallbackByType[type] ? type : 'Standard';

const ensurePublicTables = async () => {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS room_public_details (
            room_id INT PRIMARY KEY,
            title VARCHAR(160) NOT NULL,
            capacity INT DEFAULT 2,
            rating DECIMAL(2,1) DEFAULT 4.8,
            popular TINYINT(1) DEFAULT 0,
            image_url TEXT,
            gallery_json TEXT,
            description TEXT,
            amenities_json TEXT,
            included_json TEXT,
            policy TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS hotel_offers (
            offer_code VARCHAR(80) PRIMARY KEY,
            title VARCHAR(160) NOT NULL,
            tag VARCHAR(80) NOT NULL,
            discount_label VARCHAR(80) NOT NULL,
            discount_type VARCHAR(24) NOT NULL,
            discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
            description TEXT,
            starts_at DATE NULL,
            ends_at DATE NULL,
            is_active TINYINT(1) DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [rooms] = await db.execute('SELECT room_id, room_number, type FROM rooms');
    for (const room of rooms) {
        const fallback = fallbackByType[normalizeType(room.type)];
        await db.execute(
            `INSERT IGNORE INTO room_public_details
             (room_id, title, capacity, rating, popular, image_url, gallery_json, description, amenities_json, included_json, policy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                room.room_id,
                `${fallback.title} ${room.room_number}`,
                fallback.capacity,
                fallback.rating,
                fallback.popular ? 1 : 0,
                fallback.image_url,
                JSON.stringify(fallback.gallery),
                fallback.description,
                JSON.stringify(fallback.amenities),
                JSON.stringify(fallback.included),
                fallback.policy
            ]
        );
    }

    for (const offer of defaultOffers) {
        await db.execute(
            `INSERT IGNORE INTO hotel_offers
             (offer_code, title, tag, discount_label, discount_type, discount_value, description, starts_at, ends_at, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                offer.offer_code,
                offer.title,
                offer.tag,
                offer.discount_label,
                offer.discount_type,
                offer.discount_value,
                offer.description,
                offer.starts_at,
                offer.ends_at,
                offer.is_active
            ]
        );
    }
};

const buildAvailabilityClause = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) {
        return {
            sql: "LOWER(r.status) = 'available'",
            params: []
        };
    }

    return {
        sql: `LOWER(r.status) <> 'maintenance'
              AND NOT EXISTS (
                SELECT 1 FROM bookings b
                WHERE b.room_id = r.room_id
                  AND b.status IN ('Active', 'Pending', 'Confirmed')
                  AND NOT (b.check_out <= ? OR b.check_in >= ?)
              )`,
        params: [checkIn, checkOut]
    };
};

const mapRoom = (room, pricingContext = null) => {
    const typeFallback = fallbackByType[normalizeType(room.type)];
    const gallery = parseJsonList(room.gallery_json, typeFallback.gallery);
    const amenities = parseJsonList(room.amenities_json, typeFallback.amenities);
    const included = parseJsonList(room.included_json, typeFallback.included);
    const dynamic = pricingContext
        ? calculateDynamicPrice(room.price_per_night, pricingContext.rules, pricingContext.occupancyRate, pricingContext.date)
        : {
            base_price: Number(room.price_per_night),
            dynamic_price: Number(room.price_per_night),
            multiplier: 1,
            reasons: { weekend: false, surge: false, season: false }
        };

    return {
        id: `room-${room.room_id}`,
        room_id: room.room_id,
        room_number: room.room_number,
        title: room.title || `${typeFallback.title} ${room.room_number}`,
        type: room.type,
        price: dynamic.dynamic_price,
        price_per_night: Number(room.price_per_night),
        base_price: dynamic.base_price,
        dynamic_price: dynamic.dynamic_price,
        price_multiplier: dynamic.multiplier,
        pricing_reasons: dynamic.reasons,
        capacity: Number(room.capacity || typeFallback.capacity),
        rating: Number(room.rating || typeFallback.rating),
        popular: Boolean(room.popular),
        image: room.image_url || typeFallback.image_url,
        gallery,
        description: room.description || typeFallback.description,
        amenities,
        included,
        policy: room.policy || typeFallback.policy,
        status: room.status,
        available: Boolean(room.available)
    };
};

const getPublicRooms = async (req, res) => {
    const { check_in, check_out, type, capacity, max_price } = req.query;

    try {
        await ensurePublicTables();
        const rules = await getPricingRules();
        const occupancy = await getOccupancyRate();
        const availability = buildAvailabilityClause(check_in, check_out);
        const params = [...availability.params];
        const filters = [`(${availability.sql})`];

        if (type && type !== 'Any') {
            filters.push('r.type = ?');
            params.push(type);
        }

        if (capacity) {
            filters.push('COALESCE(d.capacity, 2) >= ?');
            params.push(Number(capacity));
        }

        if (max_price) {
            filters.push('r.price_per_night <= ?');
            params.push(Number(max_price));
        }

        const [rooms] = await db.execute(
            `SELECT
                r.room_id,
                r.room_number,
                r.type,
                r.price_per_night,
                r.status,
                d.title,
                d.capacity,
                d.rating,
                d.popular,
                d.image_url,
                d.gallery_json,
                d.description,
                d.amenities_json,
                d.included_json,
                d.policy,
                CASE WHEN ${availability.sql} THEN 1 ELSE 0 END AS available
             FROM rooms r
             LEFT JOIN room_public_details d ON d.room_id = r.room_id
             WHERE ${filters.join(' AND ')}
             ORDER BY d.popular DESC, r.price_per_night ASC, CAST(r.room_number AS UNSIGNED), r.room_number`,
            [...availability.params, ...params]
        );

        res.json(rooms.map((room) => mapRoom(room, {
            rules,
            occupancyRate: occupancy.occupancyRate,
            date: check_in || new Date()
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getPublicOffers = async (req, res) => {
    try {
        await ensurePublicTables();
        const [offers] = await db.execute(
            `SELECT offer_code, title, tag, discount_label, discount_type, discount_value, description, starts_at, ends_at
             FROM hotel_offers
             WHERE is_active = 1
               AND (starts_at IS NULL OR starts_at <= CURDATE())
               AND (ends_at IS NULL OR ends_at >= CURDATE())
             ORDER BY ends_at ASC, title ASC`
        );

        res.json(offers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    ensurePublicTables,
    buildAvailabilityClause,
    getPublicRooms,
    getPublicOffers
};
